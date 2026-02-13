import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../types';
import { createWorkflowDefinition } from '../types';

/**
 * Serialize the current workflow state into a WorkflowDefinition,
 * stripping runtime-only fields (executionStatus).
 */
export function serializeWorkflow(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    name: string,
    variables?: Record<string, unknown>,
) {
    const cleanNodes = nodes.map((node) => {
        const { executionStatus: _, ...cleanData } = node.data;
        return { ...node, data: cleanData as WorkflowNodeData };
    });

    return createWorkflowDefinition(
        `wf-${Date.now()}`,
        name,
        cleanNodes,
        edges,
        variables,
    );
}

/**
 * Produce a plain object suitable for pane data persistence
 * via updatePane(id, { data: serializeToSaveData(...) }).
 */
export function serializeToSaveData(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    name: string,
    variables: Record<string, unknown>,
): Record<string, unknown> {
    const cleanNodes = nodes.map((node) => {
        const { executionStatus: _, ...cleanData } = node.data;
        return { ...node, data: cleanData };
    });

    return {
        workflowNodes: cleanNodes,
        workflowEdges: edges,
        workflowName: name,
        workflowVariables: variables,
    };
}

/**
 * Restore workflow state from pane data.
 * Returns null if the data is missing or malformed.
 */
export function deserializeFromSaveData(
    data: Record<string, unknown> | null | undefined,
): {
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
    name: string;
    variables: Record<string, unknown>;
} | null {
    if (!data) return null;

    const nodes = data.workflowNodes;
    const edges = data.workflowEdges;
    const name = data.workflowName;
    const variables = data.workflowVariables;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) return null;

    return {
        nodes: (nodes as Node<WorkflowNodeData>[]).map((node) => ({
            ...node,
            data: { ...node.data, executionStatus: 'idle' as const },
        })),
        edges: edges as Edge[],
        name: typeof name === 'string' ? name : 'Untitled Workflow',
        variables: (typeof variables === 'object' && variables !== null)
            ? variables as Record<string, unknown>
            : {},
    };
}
