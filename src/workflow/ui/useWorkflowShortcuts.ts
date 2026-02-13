import { useEffect, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useWorkflowStore } from '../store';
import { autoLayout } from '../engine/autoLayout';

/**
 * Keyboard shortcuts for the workflow editor.
 *
 * - Delete/Backspace → delete selected nodes and edges
 * - Ctrl+Z → undo
 * - Ctrl+Shift+Z / Ctrl+Y → redo
 * - Ctrl+D → duplicate selected node
 * - Ctrl+E → run workflow
 * - Ctrl+Shift+L → auto-layout
 * - Ctrl+Shift+F → zoom to fit
 */
export function useWorkflowShortcuts() {
    const { fitView } = useReactFlow();

    const handleAutoLayout = useCallback(() => {
        const { nodes, edges, setNodes } = useWorkflowStore.getState();
        const layoutedNodes = autoLayout(nodes, edges);
        setNodes(layoutedNodes);
        setTimeout(() => fitView({ padding: 0.2 }), 50);
    }, [fitView]);

    const handleFitView = useCallback(() => {
        fitView({ padding: 0.2 });
    }, [fitView]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Don't intercept shortcuts when typing in inputs/textareas
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const isCtrl = e.ctrlKey || e.metaKey;

            // Delete selected nodes/edges
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const { nodes, edges, setNodes, setEdges, selectedNodeId, setSelectedNodeId } = useWorkflowStore.getState();
                const selectedNodes = nodes.filter((n) => n.selected);
                if (selectedNodes.length > 0) {
                    e.preventDefault();
                    const selectedIds = new Set(selectedNodes.map((n) => n.id));
                    setNodes(nodes.filter((n) => !selectedIds.has(n.id)));
                    setEdges(edges.filter((edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target)));
                    if (selectedNodeId && selectedIds.has(selectedNodeId)) {
                        setSelectedNodeId(null);
                    }
                }
                return;
            }

            // Ctrl+D → duplicate selected node
            if (isCtrl && e.key === 'd') {
                e.preventDefault();
                const { nodes, addNode } = useWorkflowStore.getState();
                const selected = nodes.filter((n) => n.selected);
                for (const original of selected) {
                    const newNode = {
                        ...original,
                        id: `node-${original.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        position: { x: original.position.x + 40, y: original.position.y + 40 },
                        selected: false,
                        data: { ...original.data },
                    };
                    addNode(newNode);
                }
                return;
            }

            // Ctrl+Z → undo
            if (isCtrl && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useWorkflowStore.temporal.getState().undo();
                return;
            }

            // Ctrl+Shift+Z or Ctrl+Y → redo
            if ((isCtrl && e.key === 'z' && e.shiftKey) || (isCtrl && e.key === 'y')) {
                e.preventDefault();
                useWorkflowStore.temporal.getState().redo();
                return;
            }

            // Ctrl+E → run workflow
            if (isCtrl && e.key === 'e') {
                e.preventDefault();
                const { isExecuting, runWorkflow, stopWorkflow } = useWorkflowStore.getState();
                if (isExecuting) {
                    stopWorkflow();
                } else {
                    runWorkflow();
                }
                return;
            }

            // Ctrl+Shift+L → auto-layout
            if (isCtrl && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                handleAutoLayout();
                return;
            }

            // Ctrl+Shift+F → zoom to fit
            if (isCtrl && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                handleFitView();
                return;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleAutoLayout, handleFitView]);

    return { handleAutoLayout, handleFitView };
}
