import { describe, it, expect, vi } from 'vitest';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { getNodeExecutor } from '../NodeExecutor';

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

function makeNode(overrides: Partial<Node<WorkflowNodeData>> & { data: WorkflowNodeData }): Node<WorkflowNodeData> {
    return {
        id: 'test-node',
        type: 'tool',
        position: { x: 0, y: 0 },
        ...overrides,
    };
}

function makeDeps(callTool?: ExecutorDependencies['callTool']): ExecutorDependencies {
    return {
        callTool: callTool ?? vi.fn().mockResolvedValue({ result: 'ok' }),
    };
}

describe('getNodeExecutor', () => {
    it('returns an executor for "start"', () => {
        expect(typeof getNodeExecutor('start')).toBe('function');
    });

    it('returns an executor for "tool"', () => {
        expect(typeof getNodeExecutor('tool')).toBe('function');
    });

    it('returns an executor for "end"', () => {
        expect(typeof getNodeExecutor('end')).toBe('function');
    });

    it('throws for an unknown type', () => {
        expect(() => getNodeExecutor('unknown')).toThrow('Unknown node type: "unknown"');
    });
});

describe('executeStartNode', () => {
    it('returns started:true with a timestamp', async () => {
        const executor = getNodeExecutor('start');
        const result = await executor(
            makeNode({ type: 'start', data: { label: 'Start' } }),
            makeContext(),
            makeDeps(),
        );
        expect(result).toMatchObject({ started: true });
        expect((result as Record<string, unknown>).timestamp).toBeTypeOf('number');
    });
});

describe('executeEndNode', () => {
    it('returns completed:true with a summary of step results (no circular ref)', async () => {
        const executor = getNodeExecutor('end');
        const stepResults = {
            start1: { nodeId: 'start1', status: 'success' as const, output: {}, startTime: 0, endTime: 1 },
            tool1: { nodeId: 'tool1', status: 'error' as const, output: null, error: 'fail', startTime: 1, endTime: 2 },
        };
        const ctx = makeContext({ stepResults });
        const result = await executor(
            makeNode({ type: 'end', data: { label: 'End' } }),
            ctx,
            makeDeps(),
        ) as Record<string, unknown>;

        expect(result.completed).toBe(true);
        expect(result.nodeCount).toBe(2);
        expect(result.summary).toEqual({
            start1: { status: 'success', error: undefined },
            tool1: { status: 'error', error: 'fail' },
        });

        // Must be JSON-serializable (no circular reference)
        expect(() => JSON.stringify(result)).not.toThrow();
    });
});

describe('executeToolNode', () => {
    it('calls callTool with the tool name and resolved inputs', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ content: 'data' });
        const executor = getNodeExecutor('tool');
        const node = makeNode({
            id: 'tool-1',
            type: 'tool',
            data: {
                label: 'my_tool',
                toolName: 'my_tool',
                inputs: { path: '/tmp' },
            },
        });

        const result = await executor(node, makeContext(), makeDeps(mockCallTool));

        expect(mockCallTool).toHaveBeenCalledWith('my_tool', { path: '/tmp' });
        expect(result).toEqual({ content: 'data' });
    });

    it('falls back to label when toolName is missing', async () => {
        const mockCallTool = vi.fn().mockResolvedValue('ok');
        const executor = getNodeExecutor('tool');
        const node = makeNode({
            type: 'tool',
            data: { label: 'fallback_tool' },
        });

        await executor(node, makeContext(), makeDeps(mockCallTool));
        expect(mockCallTool).toHaveBeenCalledWith('fallback_tool', {});
    });

    it('throws when both toolName and label are empty', async () => {
        const executor = getNodeExecutor('tool');
        const node = makeNode({
            type: 'tool',
            data: { label: '', toolName: '' },
        });

        await expect(executor(node, makeContext(), makeDeps())).rejects.toThrow('missing a tool name');
    });

    it('resolves template inputs before calling callTool', async () => {
        const mockCallTool = vi.fn().mockResolvedValue('ok');
        const executor = getNodeExecutor('tool');
        const ctx = makeContext({
            stepResults: {
                prev: {
                    nodeId: 'prev',
                    status: 'success',
                    output: { file: 'readme.md' },
                    startTime: 0,
                    endTime: 1,
                },
            },
        });
        const node = makeNode({
            type: 'tool',
            data: {
                label: 'read_file',
                toolName: 'read_file',
                inputs: { path: '{{steps.prev.output.file}}' },
            },
        });

        await executor(node, ctx, makeDeps(mockCallTool));
        expect(mockCallTool).toHaveBeenCalledWith('read_file', { path: 'readme.md' });
    });

    it('propagates callTool errors', async () => {
        const mockCallTool = vi.fn().mockRejectedValue(new Error('MCP timeout'));
        const executor = getNodeExecutor('tool');
        const node = makeNode({
            type: 'tool',
            data: { label: 'failing_tool', toolName: 'failing_tool' },
        });

        await expect(executor(node, makeContext(), makeDeps(mockCallTool))).rejects.toThrow('MCP timeout');
    });
});
