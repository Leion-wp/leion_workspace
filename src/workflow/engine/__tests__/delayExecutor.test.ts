import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { executeDelayNode } from '../executors/delayExecutor';

function makeContext(): ExecutionContext {
    return {
        workflowId: 'wf-test',
        executionId: 'exec-test',
        status: 'running',
        stepResults: {},
        variables: {},
        logs: [],
    };
}

function makeDelayNode(ms?: number): Node<WorkflowNodeData> {
    return {
        id: 'delay-1',
        type: 'delay',
        position: { x: 0, y: 0 },
        data: { label: 'Delay', delayMs: ms },
    };
}

function makeDeps(): ExecutorDependencies {
    return { callTool: vi.fn().mockResolvedValue({}) };
}

describe('executeDelayNode', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns delayed duration', async () => {
        const promise = executeDelayNode(makeDelayNode(500), makeContext(), makeDeps());
        vi.advanceTimersByTime(500);
        const result = await promise;

        expect(result).toEqual({ delayed: 500 });
    });

    it('defaults to 1000ms when delayMs not set', async () => {
        const promise = executeDelayNode(makeDelayNode(), makeContext(), makeDeps());
        vi.advanceTimersByTime(1000);
        const result = await promise;

        expect(result).toEqual({ delayed: 1000 });
    });

    it('logs the delay', async () => {
        const ctx = makeContext();
        const promise = executeDelayNode(makeDelayNode(200), ctx, makeDeps());
        vi.advanceTimersByTime(200);
        await promise;

        expect(ctx.logs.some(l => l.includes('waiting 200ms'))).toBe(true);
    });
});
