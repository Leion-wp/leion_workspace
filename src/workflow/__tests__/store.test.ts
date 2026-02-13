import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useWorkflowStore } from '../store';
import type { Node } from 'reactflow';
import type { WorkflowNodeData } from '../types';
import { mcpClient } from '../../services/mcp';

// Reset store state between tests
beforeEach(() => {
    const store = useWorkflowStore.getState();
    store.setNodes([]);
    store.setEdges([]);
    store.setWorkflowName('Untitled Workflow');
    store.setSelectedNodeId(null);
    // Clear history and execution history via direct set
    useWorkflowStore.setState({ history: [], executionHistory: [] });
    useWorkflowStore.temporal.getState().clear();
});

function makeNode(id: string, type = 'tool'): Node<WorkflowNodeData> {
    return {
        id,
        type,
        position: { x: 0, y: 0 },
        data: { label: id },
    };
}

describe('WorkflowStore — nodes/edges', () => {
    it('addNode adds a node', () => {
        const { addNode, nodes } = useWorkflowStore.getState();
        expect(nodes).toHaveLength(0);
        addNode(makeNode('n1'));
        expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });

    it('setNodes replaces all nodes', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.getState().setNodes([makeNode('n2'), makeNode('n3')]);
        expect(useWorkflowStore.getState().nodes.map((n) => n.id)).toEqual(['n2', 'n3']);
    });

    it('updateNodeData patches data', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.getState().updateNodeData('n1', { label: 'Updated' });
        const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'n1');
        expect(node?.data.label).toBe('Updated');
    });

    it('addEdge adds an edge', () => {
        useWorkflowStore.getState().addEdge({ id: 'e1', source: 'n1', target: 'n2' });
        expect(useWorkflowStore.getState().edges).toHaveLength(1);
    });
});

describe('WorkflowStore — variables', () => {
    it('setVariable adds a variable', () => {
        useWorkflowStore.getState().setVariable('x', 42);
        expect(useWorkflowStore.getState().variables.x).toBe(42);
    });

    it('removeVariable deletes a variable', () => {
        useWorkflowStore.getState().setVariable('x', 42);
        useWorkflowStore.getState().removeVariable('x');
        expect(useWorkflowStore.getState().variables.x).toBeUndefined();
    });
});

describe('WorkflowStore — undo/redo', () => {
    it('undoes a node addition', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.temporal.getState().undo();
        expect(useWorkflowStore.getState().nodes).toHaveLength(0);
    });

    it('redoes after undo', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.temporal.getState().undo();
        useWorkflowStore.temporal.getState().redo();
        expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });
});

describe('WorkflowStore — checkpoints', () => {
    it('saveCheckpoint stores a snapshot', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.getState().saveCheckpoint('Test');
        expect(useWorkflowStore.getState().history).toHaveLength(1);
        expect(useWorkflowStore.getState().history[0].label).toBe('Test');
    });

    it('restoreCheckpoint restores state', () => {
        useWorkflowStore.getState().addNode(makeNode('n1'));
        useWorkflowStore.getState().saveCheckpoint('Before');
        useWorkflowStore.getState().addNode(makeNode('n2'));
        expect(useWorkflowStore.getState().nodes).toHaveLength(2);
        useWorkflowStore.getState().restoreCheckpoint(0);
        expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });
});

describe('WorkflowStore — templates', () => {
    it('loadTemplate replaces workflow', () => {
        useWorkflowStore.getState().addNode(makeNode('old'));
        useWorkflowStore.getState().loadTemplate('blank');
        const nodes = useWorkflowStore.getState().nodes;
        expect(nodes.some((n) => n.id === 'old')).toBe(false);
        expect(nodes[0].type).toBe('start');
    });

    it('loadTemplate ignores unknown template id', () => {
        useWorkflowStore.getState().addNode(makeNode('existing'));
        useWorkflowStore.getState().loadTemplate('does-not-exist');
        // Should not change anything
        expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });
});

describe('WorkflowStore — theme', () => {
    it('toggleTheme switches between dark and light', () => {
        const { toggleTheme } = useWorkflowStore.getState();
        expect(useWorkflowStore.getState().theme).toBe('dark');
        toggleTheme();
        expect(useWorkflowStore.getState().theme).toBe('light');
        toggleTheme();
        expect(useWorkflowStore.getState().theme).toBe('dark');
    });
});

describe('WorkflowStore — dry-run', () => {
    it('toggleDryRun flips the dryRun flag', () => {
        expect(useWorkflowStore.getState().dryRun).toBe(false);
        useWorkflowStore.getState().toggleDryRun();
        expect(useWorkflowStore.getState().dryRun).toBe(true);
        useWorkflowStore.getState().toggleDryRun();
        expect(useWorkflowStore.getState().dryRun).toBe(false);
    });
});

describe('WorkflowStore — local tool routing', () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;

    afterEach(() => {
        vi.restoreAllMocks();
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
    });

    it('routes db:* tool calls through workflowTools bridge instead of MCP', async () => {
        const workflowCall = vi.fn(async (name: string) => {
            if (name === 'db:connect') return { success: true };
            if (name === 'db:query') return { success: true, rows: [], columns: [] };
            return { success: true };
        });

        (globalThis as unknown as {
            window: { platform: { workflowTools: { call: (n: string, a: Record<string, unknown>) => Promise<unknown> } } };
        }).window = {
            platform: {
                workflowTools: {
                    call: workflowCall,
                },
            },
        };

        const mcpSpy = vi.spyOn(mcpClient, 'callTool').mockResolvedValue({ ok: true });

        const nodes: Node<WorkflowNodeData>[] = [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
                id: 'db-1',
                type: 'db-query',
                position: { x: 0, y: 0 },
                data: {
                    label: 'DB Query',
                    databasePath: ':memory:',
                    databaseSql: 'SELECT 1 as one',
                },
            },
            { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: 'End' } },
        ];

        useWorkflowStore.getState().setNodes(nodes);
        useWorkflowStore.getState().setEdges([
            { id: 'e1', source: 'start', target: 'db-1' },
            { id: 'e2', source: 'db-1', target: 'end' },
        ]);

        await useWorkflowStore.getState().runWorkflow();

        expect(workflowCall).toHaveBeenCalledWith('db:connect', expect.objectContaining({ path: ':memory:' }));
        expect(workflowCall).toHaveBeenCalledWith('db:query', expect.objectContaining({ sql: 'SELECT 1 as one' }));
        expect(mcpSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^db:/), expect.anything());
    });
});
