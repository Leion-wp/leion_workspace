import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttpNode } from '../executors/httpExecutor';
import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';

function makeNode(overrides: Partial<WorkflowNodeData> = {}): Node<WorkflowNodeData> {
    return {
        id: 'http-1',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { label: 'HTTP', ...overrides },
    };
}

function makeContext(): ExecutionContext {
    return {
        workflowId: 'wf-1',
        executionId: 'exec-1',
        status: 'running',
        stepResults: {},
        variables: {},
        logs: [],
    };
}

const deps: ExecutorDependencies = {
    callTool: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe('executeHttpNode', () => {
    it('throws if no URL configured', async () => {
        const node = makeNode({ httpUrl: '' });
        await expect(executeHttpNode(node, makeContext(), deps)).rejects.toThrow('has no URL configured');
    });

    it('dry-run returns mock result without fetching', async () => {
        const node = makeNode({ httpUrl: 'https://example.com', httpMethod: 'GET' });
        const ctx = makeContext();
        const dryDeps: ExecutorDependencies = { ...deps, dryRun: true };
        const result = await executeHttpNode(node, ctx, dryDeps) as Record<string, unknown>;
        expect(result.dryRun).toBe(true);
        expect(result.method).toBe('GET');
        expect(result.url).toBe('https://example.com');
        expect(ctx.logs[0]).toContain('[DRY-RUN]');
    });

    it('performs GET fetch and returns JSON body', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: { get: (k: string) => k === 'content-type' ? 'application/json' : null, entries: () => [] },
            json: async () => ({ data: 'ok' }),
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

        const node = makeNode({ httpUrl: 'https://api.example.com/test', httpMethod: 'GET' });
        const result = await executeHttpNode(node, makeContext(), deps) as Record<string, unknown>;
        expect(result.status).toBe(200);
        expect((result.body as Record<string, unknown>).data).toBe('ok');
    });

    it('throws on non-ok HTTP response', async () => {
        const mockResponse = {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: { get: () => null, entries: () => [] },
            text: async () => 'not found',
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

        const node = makeNode({ httpUrl: 'https://api.example.com/missing', httpMethod: 'GET' });
        await expect(executeHttpNode(node, makeContext(), deps)).rejects.toThrow('404');
    });

    it('includes body for POST requests', async () => {
        let capturedInit: RequestInit | undefined;
        const mockResponse = {
            ok: true,
            status: 201,
            headers: { get: () => 'application/json', entries: () => [] },
            json: async () => ({ id: 1 }),
        };
        vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
            capturedInit = init;
            return Promise.resolve(mockResponse);
        }));

        const node = makeNode({
            httpUrl: 'https://api.example.com/create',
            httpMethod: 'POST',
            httpBody: '{"name":"test"}',
        });
        await executeHttpNode(node, makeContext(), deps);
        expect(capturedInit?.body).toBe('{"name":"test"}');
    });
});
