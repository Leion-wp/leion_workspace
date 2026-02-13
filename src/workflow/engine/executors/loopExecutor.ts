import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

/**
 * Loop node — iterates over an array expression or a fixed count.
 *
 * Config:
 *   - loopItemsExpression: template that resolves to an array (e.g. "{{steps.tool-1.output.items}}")
 *   - loopCount: fallback fixed iteration count (default: 3)
 *   - loopBodyCode: optional JS snippet run per iteration; receives (item, index, accumulator)
 *   - loopBreakCondition: JS expression that stops iteration when truthy
 *   - loopMaxIterations: hard cap on iterations regardless of items length
 *   - loopParallel: run all iterations concurrently (up to loopConcurrency)
 *   - loopConcurrency: max concurrent iterations when loopParallel is true
 *   - loopAccumulatorInit: JSON string for initial accumulator value
 *
 * Output: { items: unknown[], results: unknown[], count: number }
 */
export async function executeLoopNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        loopItemsExpression,
        loopCount,
        loopBodyCode,
        loopBreakCondition,
        loopMaxIterations,
        loopParallel = false,
        loopConcurrency = 4,
        loopAccumulatorInit,
    } = node.data;

    // Resolve the items to iterate over
    let items: unknown[];

    if (loopItemsExpression?.trim()) {
        const resolved = resolveValue(loopItemsExpression, context);
        if (Array.isArray(resolved)) {
            items = resolved;
        } else {
            throw new Error(`Loop node "${node.id}" expression did not resolve to an array`);
        }
    } else {
        const count = loopCount ?? 3;
        items = Array.from({ length: count }, (_, i) => i);
    }

    // Apply max iterations cap
    if (loopMaxIterations && loopMaxIterations > 0 && items.length > loopMaxIterations) {
        context.logs.push(`Loop "${node.id}": capping ${items.length} items to loopMaxIterations=${loopMaxIterations}`);
        items = items.slice(0, loopMaxIterations);
    }

    // Parse initial accumulator
    let initialAccumulator: unknown = [];
    if (loopAccumulatorInit?.trim()) {
        try {
            initialAccumulator = JSON.parse(loopAccumulatorInit);
        } catch {
            initialAccumulator = loopAccumulatorInit;
        }
    }

    const results: unknown[] = [];
    const code = loopBodyCode?.trim() ?? '';

    // Break condition function (created once if specified)
    type BreakFn = (item: unknown, index: number, acc: unknown, vars: unknown) => boolean;
    let breakFn: BreakFn | null = null;
    if (loopBreakCondition?.trim()) {
        try {
            breakFn = new Function('item', 'index', 'accumulator', 'variables', `return !!(${loopBreakCondition})`) as BreakFn;
        } catch {
            context.logs.push(`Loop "${node.id}": invalid break condition expression, ignoring`);
        }
    }

    if (loopParallel && code) {
        // Parallel execution with concurrency limit
        const fn = new Function('item', 'index', 'accumulator', 'variables', code);
        const concurrency = Math.max(1, loopConcurrency ?? 4);
        let i = 0;
        while (i < items.length) {
            const batch = items.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map((item, batchIdx) => {
                    const idx = i + batchIdx;
                    return Promise.resolve(fn(item, idx, initialAccumulator, context.variables));
                })
            );
            results.push(...batchResults);
            i += concurrency;
        }
    } else if (code) {
        const fn = new Function('item', 'index', 'accumulator', 'variables', code);
        for (let i = 0; i < items.length; i++) {
            // Check break condition before each iteration
            if (breakFn && breakFn(items[i], i, results, context.variables)) {
                context.logs.push(`Loop "${node.id}": break condition met at index ${i}`);
                break;
            }
            const result = fn(items[i], i, results, context.variables);
            results.push(result);
        }
    } else {
        // No body code — just pass items through, respecting break condition
        for (let i = 0; i < items.length; i++) {
            if (breakFn && breakFn(items[i], i, results, context.variables)) {
                context.logs.push(`Loop "${node.id}": break condition met at index ${i}`);
                break;
            }
            results.push(items[i]);
        }
    }

    context.logs.push(`Loop "${node.id}": iterated ${results.length} times (of ${items.length} items)`);

    return { items, results, count: results.length };
}
