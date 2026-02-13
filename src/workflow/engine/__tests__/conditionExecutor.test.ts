import { describe, it, expect, vi } from 'vitest';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { executeConditionNode } from '../executors/conditionExecutor';

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
    return {
        workflowId: 'wf-test',
        executionId: 'exec-test',
        status: 'running',
        stepResults: {},
        variables: {},
        logs: [],
        ...overrides,
    };
}

function makeConditionNode(expression: string): Node<WorkflowNodeData> {
    return {
        id: 'cond-1',
        type: 'condition',
        position: { x: 0, y: 0 },
        data: { label: 'Condition', conditionExpression: expression },
    };
}

function makeDeps(): ExecutorDependencies {
    return { callTool: vi.fn().mockResolvedValue({}) };
}

describe('executeConditionNode', () => {
    it('evaluates "true" string as true', async () => {
        const result = await executeConditionNode(
            makeConditionNode('true'),
            makeContext(),
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(true);
    });

    it('evaluates "false" string as false', async () => {
        const result = await executeConditionNode(
            makeConditionNode('false'),
            makeContext(),
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(false);
    });

    it('evaluates "1" as true', async () => {
        const result = await executeConditionNode(
            makeConditionNode('1'),
            makeContext(),
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(true);
    });

    it('evaluates "0" as false', async () => {
        const result = await executeConditionNode(
            makeConditionNode('0'),
            makeContext(),
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(false);
    });

    it('throws on empty expression', async () => {
        await expect(executeConditionNode(
            makeConditionNode(''),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('has no expression');
    });

    it('evaluates a non-empty string as true', async () => {
        const result = await executeConditionNode(
            makeConditionNode('hello'),
            makeContext(),
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(true);
    });

    it('resolves template expressions from step results', async () => {
        const ctx = makeContext({
            stepResults: {
                'tool-1': {
                    nodeId: 'tool-1',
                    status: 'success',
                    output: { status: 'ok' },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });

        const result = await executeConditionNode(
            makeConditionNode('{{steps.tool-1.output.status}}'),
            ctx,
            makeDeps(),
        ) as { result: boolean };

        // "ok" is a non-empty string → true
        expect(result.result).toBe(true);
    });

    it('resolves template to a number and evaluates truthiness', async () => {
        const ctx = makeContext({
            stepResults: {
                'tool-1': {
                    nodeId: 'tool-1',
                    status: 'success',
                    output: { count: 0 },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });

        const result = await executeConditionNode(
            makeConditionNode('{{steps.tool-1.output.count}}'),
            ctx,
            makeDeps(),
        ) as { result: boolean };

        // 0 → false
        expect(result.result).toBe(false);
    });

    it('resolves variable references', async () => {
        const ctx = makeContext({
            variables: { enabled: 'true' },
        });

        const result = await executeConditionNode(
            makeConditionNode('{{variables.enabled}}'),
            ctx,
            makeDeps(),
        ) as { result: boolean };

        expect(result.result).toBe(true);
    });

    it('logs the condition evaluation', async () => {
        const ctx = makeContext();

        await executeConditionNode(
            makeConditionNode('true'),
            ctx,
            makeDeps(),
        );

        expect(ctx.logs.some(l => l.includes('Condition "cond-1"'))).toBe(true);
    });

    it('throws when expression is whitespace-only', async () => {
        await expect(executeConditionNode(
            makeConditionNode('   '),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('has no expression');
    });
});
