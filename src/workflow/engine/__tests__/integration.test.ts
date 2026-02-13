import { describe, it, expect, vi } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData, ExecutorDependencies } from '../../types';
import { GraphEngine } from '../GraphEngine';

describe('Workflow Engine Integration', () => {
    it('executes Start -> ToolA(list_directory) -> ToolB(read_file with interpolation) -> End', async () => {
        const mockCallTool = vi.fn()
            .mockResolvedValueOnce({ content: [{ text: 'file_list.txt' }] })
            .mockResolvedValueOnce({ content: [{ text: 'file contents here' }] });

        const nodes: Node<WorkflowNodeData>[] = [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 0, y: 0 },
                data: { label: 'Start' },
            },
            {
                id: 'tool-1',
                type: 'tool',
                position: { x: 200, y: 0 },
                data: {
                    label: 'list_directory',
                    toolName: 'list_directory',
                    inputs: { path: '/tmp' },
                },
            },
            {
                id: 'tool-2',
                type: 'tool',
                position: { x: 400, y: 0 },
                data: {
                    label: 'read_file',
                    toolName: 'read_file',
                    inputs: { path: '{{steps.tool-1.output.content.0.text}}' },
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 600, y: 0 },
                data: { label: 'End' },
            },
        ];

        const edges: Edge[] = [
            { id: 'e1', source: 'start-1', target: 'tool-1' },
            { id: 'e2', source: 'tool-1', target: 'tool-2' },
            { id: 'e3', source: 'tool-2', target: 'end-1' },
        ];

        const definition = {
            id: 'test-wf',
            name: 'Integration Test',
            nodes,
            edges,
            variables: {},
        };

        const deps: ExecutorDependencies = { callTool: mockCallTool };

        const callbackLog: string[] = [];
        const engine = new GraphEngine(definition, deps, {
            onNodeStart: (id) => callbackLog.push(`start:${id}`),
            onNodeComplete: (id) => callbackLog.push(`complete:${id}`),
            onExecutionComplete: () => callbackLog.push('done'),
            onLog: (msg) => callbackLog.push(`log:${msg}`),
        });

        // Validation
        const validation = engine.validate();
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);

        // Execution
        const context = await engine.execute();

        // Status
        expect(context.status).toBe('success');

        // All nodes executed
        expect(context.stepResults['start-1'].status).toBe('success');
        expect(context.stepResults['tool-1'].status).toBe('success');
        expect(context.stepResults['tool-2'].status).toBe('success');
        expect(context.stepResults['end-1'].status).toBe('success');

        // Tool calls
        expect(mockCallTool).toHaveBeenCalledTimes(2);
        expect(mockCallTool).toHaveBeenNthCalledWith(1, 'list_directory', { path: '/tmp' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
        // Second tool receives interpolated value from first tool's output
        expect(mockCallTool).toHaveBeenNthCalledWith(2, 'read_file', { path: 'file_list.txt' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));

        // Tool outputs stored correctly
        expect(context.stepResults['tool-1'].output).toEqual({
            content: [{ text: 'file_list.txt' }],
        });
        expect(context.stepResults['tool-2'].output).toEqual({
            content: [{ text: 'file contents here' }],
        });

        // Callbacks fired in correct order
        expect(callbackLog).toContain('start:start-1');
        expect(callbackLog).toContain('complete:tool-2');
        expect(callbackLog[callbackLog.length - 1]).toBe('done');

        // Timing data present
        for (const result of Object.values(context.stepResults)) {
            expect(result.startTime).toBeTypeOf('number');
            expect(result.endTime).toBeTypeOf('number');
            expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
        }
    });

    it('handles workflow variables in tool inputs', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ success: true });

        const nodes: Node<WorkflowNodeData>[] = [
            {
                id: 'start',
                type: 'start',
                position: { x: 0, y: 0 },
                data: { label: 'Start' },
            },
            {
                id: 'tool',
                type: 'tool',
                position: { x: 200, y: 0 },
                data: {
                    label: 'create_file',
                    toolName: 'create_file',
                    inputs: {
                        path: '{{variables.outputDir}}/result.txt',
                        content: 'Generated by {{variables.author}}',
                    },
                },
            },
            {
                id: 'end',
                type: 'end',
                position: { x: 400, y: 0 },
                data: { label: 'End' },
            },
        ];

        const edges: Edge[] = [
            { id: 'e1', source: 'start', target: 'tool' },
            { id: 'e2', source: 'tool', target: 'end' },
        ];

        const definition = {
            id: 'var-test',
            name: 'Variable Test',
            nodes,
            edges,
            variables: { outputDir: '/home/user', author: 'Leion' },
        };

        const engine = new GraphEngine(definition, { callTool: mockCallTool });
        const context = await engine.execute();

        expect(context.status).toBe('success');
        expect(mockCallTool).toHaveBeenCalledWith('create_file', {
            path: '/home/user/result.txt',
            content: 'Generated by Leion',
        }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
});
