/**
 * WorkflowWorkerBridge — offloads CPU-heavy workflow computations to a Web Worker
 * while keeping IPC-dependent operations on the main thread.
 *
 * The bridge wraps three operations:
 * 1. Template resolution (DataMapper.resolveValue) — offloaded for large payloads
 * 2. Transform node code evaluation — always offloaded (sandboxed)
 * 3. Condition expression evaluation — offloaded for consistency
 *
 * If the worker cannot be created (e.g. in test environments, SSR, or errors),
 * the bridge falls back to synchronous main-thread execution.
 *
 * Usage:
 *   const bridge = new WorkflowWorkerBridge();
 *   const resolved = await bridge.resolveTemplate(template, serializableContext);
 *   bridge.dispose(); // when done, terminate the worker
 */

import type { ExecutionContext } from '../types';
import { resolveValue } from './DataMapper';

// ---- Message Protocol Types ----

export interface SerializableContext {
    workflowId: string;
    executionId: string;
    status: 'idle' | 'running' | 'success' | 'error' | 'aborted';
    stepResults: Record<string, SerializableStepResult>;
    variables: Record<string, unknown>;
    logs: string[];
    currentNodeId?: string;
    envVars?: Record<string, string>;
    paneStates?: Record<string, unknown>;
}

export interface SerializableStepResult {
    nodeId: string;
    status: 'success' | 'error' | 'skipped';
    output: unknown;
    error?: string;
    startTime: number;
    endTime: number;
}

export type WorkerRequest =
    | { type: 'resolve-template'; id: string; template: string; context: SerializableContext }
    | { type: 'evaluate-condition'; id: string; expression: string; variables: Record<string, unknown> }
    | { type: 'evaluate-transform'; id: string; code: string; input: unknown; variables: Record<string, unknown> };

export type WorkerResponse =
    | { type: 'result'; id: string; value: unknown }
    | { type: 'error'; id: string; error: string };

// ---- Helpers ----

let requestCounter = 0;

function generateRequestId(): string {
    return `wr-${++requestCounter}-${Date.now()}`;
}

/**
 * Extract a JSON-serializable subset of ExecutionContext.
 * Strips out functions, Maps, Sets, and other non-serializable values.
 */
export function toSerializableContext(context: ExecutionContext): SerializableContext {
    return {
        workflowId: context.workflowId,
        executionId: context.executionId,
        status: context.status,
        stepResults: { ...context.stepResults },
        variables: { ...context.variables },
        logs: [...context.logs],
        currentNodeId: context.currentNodeId,
        envVars: context.envVars ? { ...context.envVars } : undefined,
        paneStates: context.paneStates ? { ...context.paneStates } : undefined,
    };
}

// ---- Fallback implementations (main-thread, no worker) ----

function evaluateAsBooleanFallback(value: unknown): boolean {
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === 'true' || trimmed === '1') return true;
        if (trimmed === 'false' || trimmed === '0' || trimmed === '') return false;
        return true;
    }
    return Boolean(value);
}

function evaluateTransformFallback(code: string, input: unknown, variables: Record<string, unknown>): unknown {
    // eslint-disable-next-line no-new-func
    const fn = new Function('inputs', 'variables', code);
    return fn(input, variables);
}

// ---- Bridge Class ----

export class WorkflowWorkerBridge {
    private worker: Worker | null = null;
    private pendingRequests = new Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }>();
    private disposed = false;

    /**
     * Minimum template string length to justify offloading to the worker.
     * Below this threshold, main-thread resolution is likely faster due to
     * the overhead of serialization + postMessage round-trip.
     */
    private readonly offloadThreshold: number;

    /**
     * Maximum time (ms) to wait for a worker response before falling back.
     */
    private readonly timeoutMs: number;

    constructor(options?: { offloadThreshold?: number; timeoutMs?: number }) {
        this.offloadThreshold = options?.offloadThreshold ?? 1024;
        this.timeoutMs = options?.timeoutMs ?? 10000;
        this.initWorker();
    }

    /** Whether the worker is available for offloading. */
    get isWorkerAvailable(): boolean {
        return this.worker !== null && !this.disposed;
    }

    /**
     * Resolve a template string using the worker (if available and payload is large enough),
     * otherwise fall back to main-thread resolution.
     *
     * Returns the resolved value and any warnings generated during resolution.
     */
    async resolveTemplate(
        template: string,
        context: ExecutionContext,
    ): Promise<{ resolved: unknown; warnings: string[] }> {
        // For small templates, main-thread is faster than serialization overhead
        if (!this.isWorkerAvailable || template.length < this.offloadThreshold) {
            const resolved = resolveValue(template, context);
            return { resolved, warnings: [] };
        }

        try {
            const serializableCtx = toSerializableContext(context);
            const result = await this.sendRequest({
                type: 'resolve-template',
                id: generateRequestId(),
                template,
                context: serializableCtx,
            });
            const typed = result as { resolved: unknown; warnings: string[] };
            return typed;
        } catch {
            // Worker failed — fall back to main thread
            const resolved = resolveValue(template, context);
            return { resolved, warnings: [] };
        }
    }

    /**
     * Evaluate a condition expression using the worker (if available),
     * otherwise fall back to main-thread evaluation.
     */
    async evaluateCondition(
        expression: string,
        context: ExecutionContext,
    ): Promise<boolean> {
        if (!this.isWorkerAvailable) {
            const resolved = resolveValue(expression, context);
            return evaluateAsBooleanFallback(resolved);
        }

        try {
            const result = await this.sendRequest({
                type: 'evaluate-condition',
                id: generateRequestId(),
                expression,
                variables: { ...context.variables },
            });
            return Boolean(result);
        } catch {
            // Fall back to main-thread
            const resolved = resolveValue(expression, context);
            return evaluateAsBooleanFallback(resolved);
        }
    }

    /**
     * Evaluate transform node code using the worker (if available),
     * otherwise fall back to main-thread evaluation.
     *
     * The worker provides better isolation for user-provided code.
     */
    async evaluateTransform(
        code: string,
        input: unknown,
        variables: Record<string, unknown>,
    ): Promise<unknown> {
        if (!this.isWorkerAvailable) {
            return evaluateTransformFallback(code, input, variables);
        }

        try {
            const result = await this.sendRequest({
                type: 'evaluate-transform',
                id: generateRequestId(),
                code,
                input,
                variables,
            });
            return result;
        } catch (err) {
            // For transform errors, we propagate instead of falling back,
            // because the error is likely in the user's code, not in the worker.
            throw err;
        }
    }

    /**
     * Terminate the worker and reject all pending requests.
     * Must be called when the bridge is no longer needed.
     */
    dispose(): void {
        this.disposed = true;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('WorkflowWorkerBridge disposed'));
            this.pendingRequests.delete(id);
        }

        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    // ---- Private Methods ----

    private initWorker(): void {
        try {
            // Vite handles Web Workers via this URL pattern
            this.worker = new Worker(
                new URL('./workflow.worker.ts', import.meta.url),
                { type: 'module' },
            );

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                this.handleResponse(event.data);
            };

            this.worker.onerror = (event: ErrorEvent) => {
                console.warn('[WorkflowWorkerBridge] Worker error:', event.message);
                // Don't terminate on single errors — let individual requests time out
            };
        } catch (err) {
            console.warn(
                '[WorkflowWorkerBridge] Failed to create worker, using main-thread fallback:',
                err instanceof Error ? err.message : err,
            );
            this.worker = null;
        }
    }

    private handleResponse(response: WorkerResponse): void {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) return; // Stale response after timeout

        this.pendingRequests.delete(response.id);

        if (response.type === 'error') {
            pending.reject(new Error(response.error));
        } else {
            pending.resolve(response.value);
        }
    }

    private sendRequest(request: WorkerRequest): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not available'));
                return;
            }

            const id = request.id;

            // Set up timeout
            const timer = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Worker request "${request.type}" timed out after ${this.timeoutMs}ms`));
                }
            }, this.timeoutMs);

            // Store the pending request with cleanup for the timer
            this.pendingRequests.set(id, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });

            // Send to worker
            this.worker.postMessage(request);
        });
    }
}
