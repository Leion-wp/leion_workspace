import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';

/**
 * Race node — a structural FLOW fork marker.
 *
 * The Race node itself performs no computation. It is a semantic marker
 * that signals the start of competing parallel branches. All outgoing edges
 * run concurrently (handled automatically by the GraphEngine's topological
 * level-based parallel execution).
 *
 * Pattern:
 *   Race → [Branch A nodes] → Merge(first-complete)
 *       └─ [Branch B nodes] → Merge(first-complete)
 *
 * The downstream Merge node with strategy "first-complete" collects the
 * first available result. All branches run, but only the fastest result
 * is used downstream.
 *
 * Output: { raced: true, timestamp: number }
 */
export async function executeRaceNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const outgoingCount = (dependencies.getIncomingEdges
        ? [] // race uses outgoing, not incoming
        : []
    ).length;

    context.logs.push(`Race "${node.id}": forking into parallel branches (${outgoingCount} branches)`);
    return { raced: true, timestamp: Date.now(), nodeId: node.id };
}
