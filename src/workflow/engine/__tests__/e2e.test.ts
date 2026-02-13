/**
 * End-to-end workflow execution tests.
 * These test complete multi-node workflow runs through GraphEngine.
 */
import { describe, it, expect, vi } from 'vitest';
import { GraphEngine } from '../GraphEngine';
import { createWorkflowDefinition } from '../../types';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData, ExecutorDependencies } from '../../types';

function node(id: string, type: string, data: Partial<WorkflowNodeData> = {}): Node<WorkflowNodeData> {
    return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } };
}

function edge(id: string, source: string, target: string, sourceHandle?: string): Edge {
    return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

const noopDeps: ExecutorDependencies = {
    callTool: vi.fn().mockResolvedValue({ result: 'ok' }),
};

function makeEngine(nodes: Node<WorkflowNodeData>[], edges: Edge[], deps = noopDeps) {
    const def = createWorkflowDefinition('test', 'Test', nodes, edges);
    return new GraphEngine(def, deps);
}

// ─────────────────────────────────────────────────────────────
// 1. Linear chain: Start → Tool → Transform → End
// ─────────────────────────────────────────────────────────────
describe('E2E: Linear workflow', () => {
    it('runs start → tool → transform → end successfully', async () => {
        const nodes = [
            node('start', 'start'),
            node('tool-1', 'tool', { toolName: 'my-tool' }),
            node('transform-1', 'transform', { transformCode: 'return { doubled: inputs.x * 2 };', inputs: { x: 5 } }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'tool-1'),
            edge('e2', 'tool-1', 'transform-1'),
            edge('e3', 'transform-1', 'end'),
        ];

        const engine = makeEngine(nodes, edges);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['tool-1'].status).toBe('success');
        expect(ctx.stepResults['transform-1'].status).toBe('success');
        expect((ctx.stepResults['transform-1'].output as Record<string, unknown>).doubled).toBe(10);
    });
});

// ─────────────────────────────────────────────────────────────
// 2. Condition branching: true → Tool A, false → Tool B
// ─────────────────────────────────────────────────────────────
describe('E2E: Condition branching', () => {
    it('takes the true branch when condition is truthy', async () => {
        const nodes = [
            node('start', 'start'),
            node('cond', 'condition', { conditionExpression: 'true' }),
            node('tool-yes', 'tool', { toolName: 'yes-tool' }),
            node('tool-no', 'tool', { toolName: 'no-tool' }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'cond'),
            edge('e2', 'cond', 'tool-yes', 'true'),
            edge('e3', 'cond', 'tool-no', 'false'),
            edge('e4', 'tool-yes', 'end'),
        ];

        const engine = makeEngine(nodes, edges);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['tool-yes'].status).toBe('success');
        // pruned branches are skipped, not executed
        expect(ctx.stepResults['tool-no']?.status).not.toBe('success');
    });

    it('takes the false branch when condition is falsy', async () => {
        const nodes = [
            node('start', 'start'),
            node('cond', 'condition', { conditionExpression: 'false' }),
            node('tool-yes', 'tool', { toolName: 'yes-tool' }),
            node('tool-no', 'tool', { toolName: 'no-tool' }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'cond'),
            edge('e2', 'cond', 'tool-yes', 'true'),
            edge('e3', 'cond', 'tool-no', 'false'),
            edge('e4', 'tool-no', 'end'),
        ];

        const engine = makeEngine(nodes, edges);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['tool-no'].status).toBe('success');
        expect(ctx.stepResults['tool-yes']?.status).not.toBe('success');
    });
});

// ─────────────────────────────────────────────────────────────
// 3. Parallel execution: two tools run in parallel, then merge
// ─────────────────────────────────────────────────────────────
describe('E2E: Parallel + merge', () => {
    it('executes parallel branches and merges', async () => {
        const callOrder: string[] = [];
        const parallelDeps: ExecutorDependencies = {
            callTool: vi.fn((name: string) => {
                callOrder.push(name);
                return Promise.resolve({ name });
            }),
        };

        const nodes = [
            node('start', 'start'),
            node('tool-a', 'tool', { toolName: 'tool-a' }),
            node('tool-b', 'tool', { toolName: 'tool-b' }),
            node('merge', 'merge'),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'tool-a'),
            edge('e2', 'start', 'tool-b'),
            edge('e3', 'tool-a', 'merge'),
            edge('e4', 'tool-b', 'merge'),
            edge('e5', 'merge', 'end'),
        ];

        const engine = makeEngine(nodes, edges, parallelDeps);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['tool-a'].status).toBe('success');
        expect(ctx.stepResults['tool-b'].status).toBe('success');
        const mergeOutput = ctx.stepResults['merge'].output as Record<string, unknown>;
        expect(mergeOutput.merged).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────
// 4. Loop node executes and passes items downstream
// ─────────────────────────────────────────────────────────────
describe('E2E: Loop node', () => {
    it('executes loop and produces results array', async () => {
        const nodes = [
            node('start', 'start'),
            node('loop', 'loop', { loopCount: 4, loopBodyCode: 'return item + 10;' }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'loop'),
            edge('e2', 'loop', 'end'),
        ];

        const engine = makeEngine(nodes, edges);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        const loopOut = ctx.stepResults['loop'].output as Record<string, unknown>;
        expect(loopOut.count).toBe(4);
        expect(loopOut.results).toEqual([10, 11, 12, 13]);
    });
});

// ─────────────────────────────────────────────────────────────
// 5. Continue-on-error: failing tool doesn't stop execution
// ─────────────────────────────────────────────────────────────
describe('E2E: Continue on error', () => {
    it('continues execution when node has continueOnError=true', async () => {
        const failDeps: ExecutorDependencies = {
            callTool: vi.fn().mockRejectedValue(new Error('tool failed')),
        };

        const nodes = [
            node('start', 'start'),
            node('failing-tool', 'tool', { toolName: 'bad-tool', continueOnError: true }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'failing-tool'),
            edge('e2', 'failing-tool', 'end'),
        ];

        const engine = makeEngine(nodes, edges, failDeps);
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['failing-tool'].status).toBe('error');
        expect(ctx.stepResults['end'].status).toBe('success');
    });
});

// ─────────────────────────────────────────────────────────────
// 6. Template references: data flows between nodes via DataMapper
// ─────────────────────────────────────────────────────────────
describe('E2E: Data references', () => {
    it('passes output of one node as input to next via template', async () => {
        let capturedArgs: Record<string, unknown> | undefined;
        const dataDeps: ExecutorDependencies = {
            callTool: vi.fn((name: string, args: Record<string, unknown>) => {
                if (name === 'consumer') capturedArgs = args;
                return Promise.resolve({ value: 42 });
            }),
        };

        const nodes = [
            node('start', 'start'),
            node('producer', 'tool', { toolName: 'producer' }),
            node('consumer', 'tool', {
                toolName: 'consumer',
                inputs: { received: '{{steps.producer.output.value}}' },
            }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'producer'),
            edge('e2', 'producer', 'consumer'),
            edge('e3', 'consumer', 'end'),
        ];

        const engine = makeEngine(nodes, edges, dataDeps);
        await engine.execute();

        expect(capturedArgs?.received).toBe(42);
    });
});

// ─────────────────────────────────────────────────────────────
// 7. Abort mid-execution
// ─────────────────────────────────────────────────────────────
describe('E2E: Abort', () => {
    it('stops execution when abort() is called before execution', async () => {
        const nodes = [
            node('start', 'start'),
            node('tool-1', 'tool', { toolName: 'my-tool' }),
            node('end', 'end'),
        ];
        const edges = [
            edge('e1', 'start', 'tool-1'),
            edge('e2', 'tool-1', 'end'),
        ];

        const engine = makeEngine(nodes, edges);
        // Abort before execute starts
        engine.abort();
        const ctx = await engine.execute();

        expect(ctx.status).toBe('aborted');
    });

    it('abort flag prevents further node execution', async () => {
        let toolCallCount = 0;
        let resolveFirst!: (v: unknown) => void;

        const slowDeps: ExecutorDependencies = {
            callTool: vi.fn(() => {
                toolCallCount++;
                return new Promise((r) => { resolveFirst = r; });
            }),
        };

        const nodes = [
            node('start', 'start'),
            node('tool-a', 'tool', { toolName: 'a' }),
            node('tool-b', 'tool', { toolName: 'b' }),
            node('end', 'end'),
        ];
        // Sequential: start → tool-a → tool-b → end
        const edges = [
            edge('e1', 'start', 'tool-a'),
            edge('e2', 'tool-a', 'tool-b'),
            edge('e3', 'tool-b', 'end'),
        ];

        const engine = makeEngine(nodes, edges, slowDeps);
        const promise = engine.execute();

        // Wait for tool-a to start, then abort and unblock it
        await new Promise((r) => setTimeout(r, 10));
        engine.abort();
        if (resolveFirst) resolveFirst({ result: 'ok' });

        const ctx = await promise;
        // tool-b should NOT have been called
        expect(toolCallCount).toBeLessThanOrEqual(1);
        expect(ctx.status).toBe('aborted');
    });
});
