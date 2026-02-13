import type { Node } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutorDependencies,
} from '../../types';

/**
 * Comment node: no-op. Does not affect execution.
 * Returns null — just a documentation placeholder.
 */
export async function executeCommentNode(
    _node: Node<WorkflowNodeData>,
    _context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    return null;
}
