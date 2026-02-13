import type { Node } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutorDependencies,
} from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Delay node: waits a configurable number of milliseconds.
 * Useful for rate limiting or timed workflows.
 *
 * Config:
 *   - delayMs: fixed delay in milliseconds (default: 1000)
 *   - delayExpression: template expression that resolves to a number (overrides delayMs)
 *   - delayJitter: random ± jitter in milliseconds added to the delay
 */
export async function executeDelayNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    let ms = node.data.delayMs ?? 1000;

    // If delayExpression is set, resolve it and use as the delay
    if (node.data.delayExpression?.trim()) {
        const resolved = resolveValue(node.data.delayExpression, context);
        const parsed = Number(resolved);
        if (!Number.isNaN(parsed) && parsed >= 0) {
            ms = parsed;
        } else {
            context.logs.push(`Delay "${node.id}": delayExpression resolved to non-numeric "${resolved}", using delayMs=${ms}`);
        }
    }

    // Apply jitter if configured
    const jitter = node.data.delayJitter;
    if (jitter && jitter > 0) {
        const jitterAmount = Math.round((Math.random() * 2 - 1) * jitter);
        ms = Math.max(0, ms + jitterAmount);
    }

    context.logs.push(`Delay "${node.id}": waiting ${ms}ms`);

    await new Promise((resolve) => setTimeout(resolve, ms));

    return { delayed: ms };
}
