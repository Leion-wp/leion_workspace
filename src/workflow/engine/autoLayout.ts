import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from '../types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

/**
 * Compute a left-to-right dagre layout for the given nodes and edges.
 * Returns a new array of nodes with updated positions.
 */
export function autoLayout(
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
): Node<WorkflowNodeData>[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 120 });

    for (const node of nodes) {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    return nodes.map((node) => {
        const dagreNode = g.node(node.id);
        return {
            ...node,
            position: {
                x: dagreNode.x - NODE_WIDTH / 2,
                y: dagreNode.y - NODE_HEIGHT / 2,
            },
        };
    });
}
