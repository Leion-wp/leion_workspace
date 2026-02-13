import { describe, it, expect, vi } from 'vitest';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { executeTransformNode } from '../executors/transformExecutor';

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

function makeTransformNode(code: string, inputs?: Record<string, unknown>): Node<WorkflowNodeData> {
    return {
        id: 'transform-1',
        type: 'transform',
        position: { x: 0, y: 0 },
        data: { label: 'Transform', transformCode: code, inputs },
    };
}

function makeDeps(): ExecutorDependencies {
    return { callTool: vi.fn().mockResolvedValue({}) };
}

describe('executeTransformNode', () => {
    it('executes simple return statement', async () => {
        const result = await executeTransformNode(
            makeTransformNode('return { sum: 1 + 2 };'),
            makeContext(),
            makeDeps(),
        );

        expect(result).toEqual({ sum: 3 });
    });

    it('has access to inputs parameter', async () => {
        const result = await executeTransformNode(
            makeTransformNode('return inputs.a + inputs.b;', { a: '10', b: '20' }),
            makeContext(),
            makeDeps(),
        );

        expect(result).toBe('1020'); // string concat since inputs are strings
    });

    it('has access to variables parameter', async () => {
        const result = await executeTransformNode(
            makeTransformNode('return variables.name;'),
            makeContext({ variables: { name: 'Alice' } }),
            makeDeps(),
        );

        expect(result).toBe('Alice');
    });

    it('resolves template expressions in inputs', async () => {
        const ctx = makeContext({
            stepResults: {
                'tool-1': {
                    nodeId: 'tool-1',
                    status: 'success',
                    output: { value: 42 },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });

        const result = await executeTransformNode(
            makeTransformNode(
                'return { doubled: inputs.val * 2 };',
                { val: '{{steps.tool-1.output.value}}' },
            ),
            ctx,
            makeDeps(),
        );

        expect(result).toEqual({ doubled: 84 });
    });

    it('throws on empty code', async () => {
        await expect(executeTransformNode(
            makeTransformNode(''),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('has no code');
    });

    it('throws on whitespace-only code', async () => {
        await expect(executeTransformNode(
            makeTransformNode('   '),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('has no code');
    });

    it('wraps syntax errors with meaningful message', async () => {
        await expect(executeTransformNode(
            makeTransformNode('return {{{;'),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('code error');
    });

    it('wraps runtime errors with meaningful message', async () => {
        await expect(executeTransformNode(
            makeTransformNode('return nonExistentVar.foo;'),
            makeContext(),
            makeDeps(),
        )).rejects.toThrow('code error');
    });

    it('can return undefined (no return statement)', async () => {
        const result = await executeTransformNode(
            makeTransformNode('const x = 1;'),
            makeContext(),
            makeDeps(),
        );

        expect(result).toBeUndefined();
    });
});
