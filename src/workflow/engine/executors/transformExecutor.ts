import type { Node } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutorDependencies,
} from '../../types';
import { resolveValue } from '../DataMapper';
import type { WorkflowWorkerBridge } from '../WorkflowWorkerBridge';

/**
 * Optional shared bridge instance. When set, transform evaluation is offloaded
 * to a Web Worker for better isolation and to keep the main thread responsive.
 * When null, evaluation runs on the main thread (original behavior).
 */
let sharedBridge: WorkflowWorkerBridge | null = null;

/**
 * Set the shared WorkflowWorkerBridge instance for transform evaluation.
 * Pass null to disable worker offloading and revert to main-thread execution.
 */
export function setTransformWorkerBridge(bridge: WorkflowWorkerBridge | null): void {
    sharedBridge = bridge;
}

/**
 * Get the current shared WorkflowWorkerBridge instance (if any).
 */
export function getTransformWorkerBridge(): WorkflowWorkerBridge | null {
    return sharedBridge;
}

/**
 * Transform node: executes user-provided JavaScript code.
 * The code has access to `inputs` (resolved) and `variables`.
 * Must return a value — that becomes the node's output.
 *
 * When a WorkflowWorkerBridge is available (via setTransformWorkerBridge),
 * the code evaluation is offloaded to a Web Worker for:
 * - Better isolation of user-provided code
 * - Keeping the main/UI thread responsive during long computations
 *
 * Security: Runs in the same JS context (Electron desktop app = user's machine),
 * or in the worker's sandboxed context when a bridge is available.
 */
export async function executeTransformNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const code = node.data.transformCode ?? '';

    if (!code.trim()) {
        throw new Error(`Transform node "${node.id}" has no code`);
    }

    const rawInputs = node.data.inputs ?? {};
    const resolvedInputs = resolveValue(rawInputs, context) as Record<string, unknown>;

    // If a worker bridge is available, offload evaluation
    if (sharedBridge?.isWorkerAvailable) {
        try {
            return await sharedBridge.evaluateTransform(
                code,
                resolvedInputs,
                { ...context.variables },
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Transform node "${node.id}" code error: ${message}`);
        }
    }

    // Fallback: main-thread evaluation (original behavior)
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('inputs', 'variables', code);
        const result = fn(resolvedInputs, context.variables);
        return result;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Transform node "${node.id}" code error: ${message}`);
    }
}
