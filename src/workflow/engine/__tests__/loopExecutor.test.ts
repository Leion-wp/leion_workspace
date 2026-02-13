import { describe, it, expect } from 'vitest';
import { executeLoopNode } from '../executors/loopExecutor';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';

function makeNode(overrides: Partial<WorkflowNodeData> = {}): Node<WorkflowNodeData> {
    return {
        id: 'loop-1',
        type: 'loop',
        position: { x: 0, y: 0 },
        data: { label: 'Loop', ...overrides },
    };
}

function makeContext(extra: Partial<ExecutionContext> = {}): ExecutionContext {
    return {
        workflowId: 'wf-1',
        executionId: 'exec-1',
        status: 'running',
        stepResults: {},
        variables: {},
        logs: [],
        ...extra,
    };
}

const deps: ExecutorDependencies = { callTool: async () => ({}) };

describe('executeLoopNode', () => {
    it('iterates fixed count and passes items through without body code', async () => {
        const node = makeNode({ loopCount: 3 });
        const result = await executeLoopNode(node, makeContext(), deps) as Record<string, unknown>;
        expect(result.count).toBe(3);
        expect((result.items as unknown[]).length).toBe(3);
        expect(result.results).toEqual([0, 1, 2]);
    });

    it('runs body code per iteration', async () => {
        const node = makeNode({ loopCount: 4, loopBodyCode: 'return item * item;' });
        const result = await executeLoopNode(node, makeContext(), deps) as Record<string, unknown>;
        expect(result.results).toEqual([0, 1, 4, 9]);
    });

    it('iterates over array from loopItemsExpression', async () => {
        const node = makeNode({ loopItemsExpression: '{{steps.prev.output.list}}' });
        const ctx = makeContext({
            stepResults: {
                prev: {
                    nodeId: 'prev',
                    status: 'success',
                    output: { list: ['a', 'b', 'c'] },
                    error: undefined,
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        const result = await executeLoopNode(node, ctx, deps) as Record<string, unknown>;
        expect(result.count).toBe(3);
        expect(result.results).toEqual(['a', 'b', 'c']);
    });

    it('throws when expression does not resolve to array', async () => {
        const node = makeNode({ loopItemsExpression: '{{steps.prev.output.value}}' });
        const ctx = makeContext({
            stepResults: {
                prev: {
                    nodeId: 'prev',
                    status: 'success',
                    output: { value: 'not-an-array' },
                    error: undefined,
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        await expect(executeLoopNode(node, ctx, deps)).rejects.toThrow('did not resolve to an array');
    });

    it('body code can accumulate values', async () => {
        const node = makeNode({
            loopCount: 3,
            loopBodyCode: 'return accumulator.length + 1;',
        });
        const result = await executeLoopNode(node, makeContext(), deps) as Record<string, unknown>;
        expect(result.results).toEqual([1, 2, 3]);
    });

    it('logs the iteration count', async () => {
        const node = makeNode({ loopCount: 5 });
        const ctx = makeContext();
        await executeLoopNode(node, ctx, deps);
        expect(ctx.logs[0]).toContain('5');
    });
});
