import { describe, it, expect, vi } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData, ExecutorDependencies } from '../../types';
import { GraphEngine } from '../GraphEngine';

function makeNodes(...specs: { id: string; type: string; data?: Partial<WorkflowNodeData> }[]): Node<WorkflowNodeData>[] {
    return specs.map((s, i) => ({
        id: s.id,
        type: s.type,
        position: { x: i * 200, y: 0 },
        data: {
            label: s.id,
            toolName: s.type === 'tool' ? s.id : undefined,
            ...s.data,
        },
    }));
}

function makeEdges(...pairs: ([string, string] | [string, string, string])[]): Edge[] {
    return pairs.map((pair, i) => ({
        id: `e${i}`,
        source: pair[0],
        target: pair[1],
        ...(pair[2] ? { sourceHandle: pair[2] } : {}),
    }));
}

function makeDeps(callTool?: ExecutorDependencies['callTool']): ExecutorDependencies {
    return {
        callTool: callTool ?? vi.fn().mockResolvedValue({ result: 'ok' }),
    };
}

function makeDef(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    variables?: Record<string, unknown>,
) {
    return {
        id: 'wf-test',
        name: 'Test Workflow',
        nodes,
        edges,
        variables: variables ?? {},
    };
}

// --- Validation tests ---

describe('GraphEngine.validate', () => {
    it('passes for a valid Start -> Tool -> End graph', () => {
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tool1', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'tool1'], ['tool1', 'end']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('fails when no start node exists', () => {
        const nodes = makeNodes(
            { id: 'tool1', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['tool1', 'end']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Workflow must have exactly one start node');
    });

    it('fails when multiple start nodes exist', () => {
        const nodes = makeNodes(
            { id: 'start1', type: 'start' },
            { id: 'start2', type: 'start' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start1', 'end'], ['start2', 'end']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('2 start nodes');
    });

    it('fails when no end node exists', () => {
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tool1', type: 'tool' },
        );
        const edges = makeEdges(['start', 'tool1']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Workflow must have exactly one end node');
    });

    it('fails when a cycle is detected', () => {
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'a', type: 'tool' },
            { id: 'b', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        // Cycle: a -> b -> a
        const edges = makeEdges(['start', 'a'], ['a', 'b'], ['b', 'a'], ['b', 'end']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Workflow contains a cycle');
    });

    it('fails when an edge references a non-existent node', () => {
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'ghost']);
        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps());

        const result = engine.validate();
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('unknown target node "ghost"');
    });
});

// --- Topological sort (tested indirectly via execution order) ---

describe('GraphEngine.execute - ordering', () => {
    it('executes nodes in topological order for a linear graph', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'toolA', type: 'tool' },
            { id: 'toolB', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'toolA'], ['toolA', 'toolB'], ['toolB', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        await engine.execute();

        expect(executionOrder).toEqual(['start', 'toolA', 'toolB', 'end']);
    });

    it('handles branching: both branches execute between start and end', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'branchA', type: 'tool' },
            { id: 'branchB', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'branchA'],
            ['start', 'branchB'],
            ['branchA', 'end'],
            ['branchB', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        await engine.execute();

        // Deterministic: sorted by nodeId when multiple nodes have inDegree=0
        expect(executionOrder).toEqual(['start', 'branchA', 'branchB', 'end']);
    });
});

// --- Execution tests ---

describe('GraphEngine.execute', () => {
    it('completes a simple pipeline with mock callTool', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ content: 'data' });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tool1', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'tool1'], ['tool1', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['start'].status).toBe('success');
        expect(ctx.stepResults['tool1'].status).toBe('success');
        expect(ctx.stepResults['end'].status).toBe('success');
        expect(mockCallTool).toHaveBeenCalledTimes(1);
    });

    it('stops execution when a tool node fails', async () => {
        const mockCallTool = vi.fn()
            .mockRejectedValueOnce(new Error('Tool failed'))
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'fail', type: 'tool' },
            { id: 'skip', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'fail'], ['fail', 'skip'], ['skip', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('error');
        expect(ctx.stepResults['fail'].status).toBe('error');
        expect(ctx.stepResults['fail'].error).toBe('Tool failed');
        // skip and end should not have been executed
        expect(ctx.stepResults['skip']).toBeUndefined();
        expect(ctx.stepResults['end']).toBeUndefined();
    });

    it('fires callbacks in correct order', async () => {
        const events: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tool1', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'tool1'], ['tool1', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => events.push(`start:${id}`),
            onNodeComplete: (id) => events.push(`complete:${id}`),
            onExecutionComplete: () => events.push('done'),
        });

        await engine.execute();

        expect(events).toEqual([
            'start:start', 'complete:start',
            'start:tool1', 'complete:tool1',
            'start:end', 'complete:end',
            'done',
        ]);
    });

    it('aborts execution when abort() is called', async () => {
        let resolveFirstTool: (val: unknown) => void;
        const slowTool = new Promise((resolve) => { resolveFirstTool = resolve; });

        const mockCallTool = vi.fn()
            .mockImplementationOnce(() => slowTool)
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'slow', type: 'tool' },
            { id: 'after', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'slow'], ['slow', 'after'], ['after', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));

        // Start execution and abort after the slow tool resolves
        const executePromise = engine.execute();

        // Let the slow tool complete, but abort before next node
        resolveFirstTool!({ ok: true });
        engine.abort();

        const ctx = await executePromise;

        expect(ctx.status).toBe('aborted');
        expect(ctx.logs).toContain('Execution aborted');
    });

    it('throws on invalid graph', async () => {
        const nodes = makeNodes({ id: 'tool1', type: 'tool' });
        const engine = new GraphEngine(makeDef(nodes, []), makeDeps());

        await expect(engine.execute()).rejects.toThrow('Workflow validation failed');
    });
});

// --- Condition branching tests ---

describe('GraphEngine.execute - condition branching', () => {
    it('executes only the true branch when condition is true', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'cond', type: 'condition', data: { label: 'Cond', conditionExpression: 'true' } },
            { id: 'toolTrue', type: 'tool' },
            { id: 'toolFalse', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'cond'],
            ['cond', 'toolTrue', 'true'],
            ['cond', 'toolFalse', 'false'],
            ['toolTrue', 'end'],
            ['toolFalse', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(executionOrder).toContain('toolTrue');
        expect(executionOrder).not.toContain('toolFalse');
        expect(ctx.stepResults['toolFalse'].status).toBe('skipped');
    });

    it('executes only the false branch when condition is false', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'cond', type: 'condition', data: { label: 'Cond', conditionExpression: 'false' } },
            { id: 'toolTrue', type: 'tool' },
            { id: 'toolFalse', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'cond'],
            ['cond', 'toolTrue', 'true'],
            ['cond', 'toolFalse', 'false'],
            ['toolTrue', 'end'],
            ['toolFalse', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(executionOrder).toContain('toolFalse');
        expect(executionOrder).not.toContain('toolTrue');
        expect(ctx.stepResults['toolTrue'].status).toBe('skipped');
    });

    it('preserves convergence point — end node executes for both branches', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'cond', type: 'condition', data: { label: 'Cond', conditionExpression: 'true' } },
            { id: 'toolTrue', type: 'tool' },
            { id: 'toolFalse', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'cond'],
            ['cond', 'toolTrue', 'true'],
            ['cond', 'toolFalse', 'false'],
            ['toolTrue', 'end'],
            ['toolFalse', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        // End node should execute even though one branch was skipped
        expect(ctx.stepResults['end'].status).toBe('success');
    });

    it('handles nested condition branches', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'cond1', type: 'condition', data: { label: 'C1', conditionExpression: 'true' } },
            { id: 'cond2', type: 'condition', data: { label: 'C2', conditionExpression: 'false' } },
            { id: 'deepTrue', type: 'tool' },
            { id: 'deepFalse', type: 'tool' },
            { id: 'skippedBranch', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'cond1'],
            ['cond1', 'cond2', 'true'],
            ['cond1', 'skippedBranch', 'false'],
            ['cond2', 'deepTrue', 'true'],
            ['cond2', 'deepFalse', 'false'],
            ['deepTrue', 'end'],
            ['deepFalse', 'end'],
            ['skippedBranch', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        // cond1=true → cond2 executes, skippedBranch skipped
        expect(executionOrder).toContain('cond2');
        expect(executionOrder).not.toContain('skippedBranch');
        // cond2=false → deepFalse executes, deepTrue skipped
        expect(executionOrder).toContain('deepFalse');
        expect(executionOrder).not.toContain('deepTrue');
    });
});

// --- ContinueOnError tests ---

describe('GraphEngine.execute - continueOnError', () => {
    it('continues execution when continueOnError is true', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn()
            .mockRejectedValueOnce(new Error('Tool failed'))
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'fail', type: 'tool', data: { label: 'fail', toolName: 'fail', continueOnError: true } },
            { id: 'after', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'fail'], ['fail', 'after'], ['after', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        const ctx = await engine.execute();

        // Workflow should complete successfully despite the failing node
        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['fail'].status).toBe('error');
        expect(ctx.stepResults['fail'].error).toBe('Tool failed');
        expect(executionOrder).toContain('after');
        expect(ctx.stepResults['after'].status).toBe('success');
    });

    it('stops execution when continueOnError is false (default)', async () => {
        const mockCallTool = vi.fn()
            .mockRejectedValueOnce(new Error('Tool failed'))
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'fail', type: 'tool' },
            { id: 'after', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'fail'], ['fail', 'after'], ['after', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('error');
        expect(ctx.stepResults['after']).toBeUndefined();
    });
});

// --- Merge node tests ---

describe('GraphEngine.execute - merge node', () => {
    it('merge node collects outputs from both branches', async () => {
        const callIndex = { n: 0 };
        const mockCallTool = vi.fn().mockImplementation(() => {
            callIndex.n++;
            return Promise.resolve({ data: `result-${callIndex.n}` });
        });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'toolA', type: 'tool' },
            { id: 'toolB', type: 'tool' },
            { id: 'merge', type: 'merge', data: { label: 'Merge' } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'toolA'],
            ['start', 'toolB'],
            ['toolA', 'merge'],
            ['toolB', 'merge'],
            ['merge', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        const mergeOutput = ctx.stepResults['merge'].output as { merged: Record<string, unknown> };
        expect(mergeOutput.merged).toHaveProperty('toolA');
        expect(mergeOutput.merged).toHaveProperty('toolB');
    });
});

// --- Parallel execution tests ---

describe('GraphEngine.execute - parallel execution', () => {
    it('executes independent branches in parallel', async () => {
        const startTimes: Record<string, number> = {};
        const mockCallTool = vi.fn().mockImplementation(async () => {
            return { ok: true };
        });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'toolA', type: 'tool' },
            { id: 'toolB', type: 'tool' },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(
            ['start', 'toolA'],
            ['start', 'toolB'],
            ['toolA', 'end'],
            ['toolB', 'end'],
        );

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => { startTimes[id] = Date.now(); },
        });

        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        // Both toolA and toolB should have been started (parallel execution)
        expect(startTimes['toolA']).toBeDefined();
        expect(startTimes['toolB']).toBeDefined();
        expect(ctx.stepResults['toolA'].status).toBe('success');
        expect(ctx.stepResults['toolB'].status).toBe('success');
    });
});

// --- Comment node tests ---

describe('GraphEngine.execute - comment nodes', () => {
    it('comment nodes are excluded from execution', async () => {
        const executionOrder: string[] = [];
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tool1', type: 'tool' },
            { id: 'note', type: 'comment', data: { label: 'A note' } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'tool1'], ['tool1', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool), {
            onNodeStart: (id) => executionOrder.push(id),
        });

        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        // Comment node should not be executed
        expect(executionOrder).not.toContain('note');
        expect(ctx.stepResults['note']).toBeUndefined();
    });
});

// --- Transform node tests ---

describe('GraphEngine.execute - transform node', () => {
    it('executes a transform node in the pipeline', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'tx', type: 'transform', data: { label: 'TX', transformCode: 'return { result: 42 };' } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'tx'], ['tx', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['tx'].output).toEqual({ result: 42 });
    });
});

// --- Delay node tests ---

describe('GraphEngine.execute - delay node', () => {
    it('executes a delay node in the pipeline', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true });
        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'wait', type: 'delay', data: { label: 'Wait', delayMs: 10 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'wait'], ['wait', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['wait'].output).toEqual({ delayed: 10 });
    });
});

// --- Retry tests ---

describe('GraphEngine.execute - retry', () => {
    it('retries a failing node and succeeds on second attempt', async () => {
        const mockCallTool = vi.fn()
            .mockRejectedValueOnce(new Error('Transient error'))
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'flaky', type: 'tool', data: { label: 'flaky', toolName: 'flaky', retryCount: 2, retryDelayMs: 10 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'flaky'], ['flaky', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['flaky'].status).toBe('success');
        expect(mockCallTool).toHaveBeenCalledTimes(2); // failed once, succeeded once
    });

    it('fails after exhausting all retries', async () => {
        const mockCallTool = vi.fn().mockRejectedValue(new Error('Always fails'));

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'fail', type: 'tool', data: { label: 'fail', toolName: 'fail', retryCount: 2, retryDelayMs: 10 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'fail'], ['fail', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('error');
        expect(ctx.stepResults['fail'].status).toBe('error');
        expect(mockCallTool).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('logs retry attempts', async () => {
        const mockCallTool = vi.fn()
            .mockRejectedValueOnce(new Error('Transient'))
            .mockResolvedValue({ ok: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'flaky', type: 'tool', data: { label: 'flaky', toolName: 'flaky', retryCount: 1, retryDelayMs: 10 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'flaky'], ['flaky', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.logs.some(l => l.includes('Retrying node "flaky"'))).toBe(true);
    });
});

// --- Timeout tests ---

describe('GraphEngine.execute - timeout', () => {
    it('times out a slow node', async () => {
        const mockCallTool = vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 5000))
        );

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'slow', type: 'tool', data: { label: 'slow', toolName: 'slow', timeoutMs: 50 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'slow'], ['slow', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('error');
        expect(ctx.stepResults['slow'].status).toBe('error');
        expect(ctx.stepResults['slow'].error).toContain('timed out');
    });

    it('does not timeout fast nodes', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ fast: true });

        const nodes = makeNodes(
            { id: 'start', type: 'start' },
            { id: 'fast', type: 'tool', data: { label: 'fast', toolName: 'fast', timeoutMs: 5000 } },
            { id: 'end', type: 'end' },
        );
        const edges = makeEdges(['start', 'fast'], ['fast', 'end']);

        const engine = new GraphEngine(makeDef(nodes, edges), makeDeps(mockCallTool));
        const ctx = await engine.execute();

        expect(ctx.status).toBe('success');
        expect(ctx.stepResults['fast'].status).toBe('success');
    });
});
