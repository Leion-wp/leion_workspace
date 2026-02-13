/**
 * Web Worker for offloading CPU-heavy workflow operations.
 *
 * Handles:
 * - Template resolution (DataMapper.resolveValue) for large payloads
 * - Transform node code evaluation (sandboxed in the worker)
 * - Condition expression evaluation
 *
 * Communication uses a typed request/response protocol with correlation IDs.
 * All data passed in/out must be JSON-serializable.
 */

// ---- Types (duplicated here to avoid import issues in worker context) ----

interface SerializableContext {
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

interface SerializableStepResult {
    nodeId: string;
    status: 'success' | 'error' | 'skipped';
    output: unknown;
    error?: string;
    startTime: number;
    endTime: number;
}

type WorkerRequest =
    | { type: 'resolve-template'; id: string; template: string; context: SerializableContext }
    | { type: 'evaluate-condition'; id: string; expression: string; variables: Record<string, unknown> }
    | { type: 'evaluate-transform'; id: string; code: string; input: unknown; variables: Record<string, unknown> };

type WorkerResponse =
    | { type: 'result'; id: string; value: unknown }
    | { type: 'error'; id: string; error: string };

// ---- Template resolution (re-implemented in worker context) ----

const INTERPOLATION_PATTERN = /\{\{([\w.\-]+)\}\}/g;
const SINGLE_EXPRESSION_PATTERN = /^\{\{([\w.\-]+)\}\}$/;

function resolvePath(root: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = root;

    for (const segment of segments) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;

        if (Array.isArray(current)) {
            const index = Number(segment);
            if (Number.isNaN(index)) return undefined;
            current = current[index];
        } else {
            current = (current as Record<string, unknown>)[segment];
        }
    }

    return current;
}

function buildLookupRoot(context: SerializableContext): Record<string, unknown> {
    return {
        steps: context.stepResults as unknown as Record<string, unknown>,
        variables: context.variables,
        env: context.envVars ?? {},
        panes: context.paneStates ?? {},
    };
}

function interpolateString(template: string, context: SerializableContext): { value: unknown; warnings: string[] } {
    const root = buildLookupRoot(context);
    const warnings: string[] = [];

    // Fast path: entire string is a single expression -> preserve raw type
    const singleMatch = SINGLE_EXPRESSION_PATTERN.exec(template);
    if (singleMatch) {
        const resolved = resolvePath(root, singleMatch[1]);
        if (resolved !== undefined) return { value: resolved, warnings };
        warnings.push(`Warning: unresolved template "{{${singleMatch[1]}}}"`);
        return { value: template, warnings };
    }

    // General case: replace all expressions within the string
    const replaced = template.replace(INTERPOLATION_PATTERN, (_match, path: string) => {
        const resolved = resolvePath(root, path);
        if (resolved === undefined) {
            warnings.push(`Warning: unresolved template "{{${path}}}"`);
            return _match;
        }
        if (typeof resolved === 'string') return resolved;
        return JSON.stringify(resolved);
    });

    return { value: replaced, warnings };
}

function resolveValueWorker(value: unknown, context: SerializableContext): { value: unknown; warnings: string[] } {
    if (typeof value === 'string') {
        return interpolateString(value, context);
    }

    if (Array.isArray(value)) {
        const allWarnings: string[] = [];
        const resolved = value.map((item) => {
            const r = resolveValueWorker(item, context);
            allWarnings.push(...r.warnings);
            return r.value;
        });
        return { value: resolved, warnings: allWarnings };
    }

    if (value !== null && typeof value === 'object') {
        const allWarnings: string[] = [];
        const resolved: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            const r = resolveValueWorker(val, context);
            allWarnings.push(...r.warnings);
            resolved[key] = r.value;
        }
        return { value: resolved, warnings: allWarnings };
    }

    return { value, warnings: [] };
}

// ---- Condition evaluation (mirrors conditionExecutor logic) ----

function evaluateAsBoolean(value: unknown): boolean {
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === 'true' || trimmed === '1') return true;
        if (trimmed === 'false' || trimmed === '0' || trimmed === '') return false;
        return true;
    }
    return Boolean(value);
}

function evaluateCondition(expression: string, variables: Record<string, unknown>): boolean {
    // Build a minimal context for resolving templates in the expression
    const context: SerializableContext = {
        workflowId: '',
        executionId: '',
        status: 'running',
        stepResults: {},
        variables,
        logs: [],
    };

    const { value } = resolveValueWorker(expression, context);
    return evaluateAsBoolean(value);
}

// ---- Transform evaluation ----

function evaluateTransform(code: string, input: unknown, variables: Record<string, unknown>): unknown {
    // eslint-disable-next-line no-new-func
    const fn = new Function('inputs', 'variables', code);
    return fn(input, variables);
}

// ---- Message handler ----

/** Minimal typed interface for the worker global scope. */
interface WorkerGlobalScopeMinimal {
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
    postMessage(message: WorkerResponse): void;
}

const workerSelf = self as unknown as WorkerGlobalScopeMinimal;

workerSelf.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    try {
        switch (request.type) {
            case 'resolve-template': {
                const { value, warnings } = resolveValueWorker(request.template, request.context);
                const response: WorkerResponse = {
                    type: 'result',
                    id: request.id,
                    value: { resolved: value, warnings },
                };
                workerSelf.postMessage(response);
                break;
            }

            case 'evaluate-condition': {
                const result = evaluateCondition(request.expression, request.variables);
                const response: WorkerResponse = {
                    type: 'result',
                    id: request.id,
                    value: result,
                };
                workerSelf.postMessage(response);
                break;
            }

            case 'evaluate-transform': {
                const result = evaluateTransform(request.code, request.input, request.variables);
                const response: WorkerResponse = {
                    type: 'result',
                    id: request.id,
                    value: result,
                };
                workerSelf.postMessage(response);
                break;
            }
        }
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const response: WorkerResponse = {
            type: 'error',
            id: request.id,
            error: errorMessage,
        };
        workerSelf.postMessage(response);
    }
};
