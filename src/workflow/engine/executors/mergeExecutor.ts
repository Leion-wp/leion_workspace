import type { Node } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutorDependencies,
} from '../../types';

/**
 * Merge node: collects outputs from all incoming source nodes.
 *
 * Config:
 *   - mergeStrategy: how to combine outputs
 *     - 'all' (default): { merged: { [sourceNodeId]: output } }
 *     - 'first-complete': return the first available (non-null) output
 *     - 'flatten': merge all object outputs into a single flat object
 *     - 'concat-arrays': concatenate all array outputs into one array
 *   - mergeSelectedInputs: if set, only include outputs from these source node IDs
 */
export async function executeMergeNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        mergeStrategy = 'all',
        mergeSelectedInputs,
    } = node.data;

    const incomingEdges = dependencies.getIncomingEdges?.(node.id) ?? [];
    const merged: Record<string, unknown> = {};

    for (const edge of incomingEdges) {
        // Skip if not in selected inputs filter
        if (mergeSelectedInputs && mergeSelectedInputs.length > 0 && !mergeSelectedInputs.includes(edge.source)) {
            continue;
        }
        const sourceResult = context.stepResults[edge.source];
        if (sourceResult && sourceResult.status === 'success') {
            merged[edge.source] = sourceResult.output;
        }
    }

    context.logs.push(`Merge "${node.id}": collected outputs from ${Object.keys(merged).length} source(s) strategy=${mergeStrategy}`);

    const values = Object.values(merged);

    switch (mergeStrategy) {
        case 'first-complete': {
            const first = values.find((v) => v !== null && v !== undefined);
            return { merged: first ?? null, strategy: 'first-complete' };
        }

        case 'flatten': {
            const flat: Record<string, unknown> = {};
            for (const value of values) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(flat, value);
                }
            }
            return { merged: flat, strategy: 'flatten' };
        }

        case 'concat-arrays': {
            const combined: unknown[] = [];
            for (const value of values) {
                if (Array.isArray(value)) {
                    combined.push(...value);
                } else if (value !== null && value !== undefined) {
                    combined.push(value);
                }
            }
            return { merged: combined, strategy: 'concat-arrays' };
        }

        case 'all':
        default:
            return { merged, strategy: 'all' };
    }
}
