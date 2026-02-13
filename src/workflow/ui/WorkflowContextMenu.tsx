import { useCallback, useEffect, useRef } from 'react';
import { Copy, Trash2, Edit3, Unlink } from 'lucide-react';
import { useWorkflowStore } from '../store';
import './WorkflowContextMenu.css';

export interface ContextMenuState {
    nodeId: string;
    x: number;
    y: number;
}

interface WorkflowContextMenuProps {
    menu: ContextMenuState;
    onClose: () => void;
    onDuplicate: (nodeId: string) => void;
    onRename: (nodeId: string) => void;
}

export function WorkflowContextMenu({ menu, onClose, onDuplicate, onRename }: WorkflowContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const setNodes = useWorkflowStore((s) => s.setNodes);
    const setEdges = useWorkflowStore((s) => s.setEdges);
    const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

    // Close on outside click or Escape
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    const handleDelete = useCallback(() => {
        setNodes(nodes.filter((n) => n.id !== menu.nodeId));
        setEdges(edges.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
        setSelectedNodeId(null);
        onClose();
    }, [menu.nodeId, nodes, edges, setNodes, setEdges, setSelectedNodeId, onClose]);

    const handleDuplicate = useCallback(() => {
        onDuplicate(menu.nodeId);
        onClose();
    }, [menu.nodeId, onDuplicate, onClose]);

    const handleRename = useCallback(() => {
        onRename(menu.nodeId);
        onClose();
    }, [menu.nodeId, onRename, onClose]);

    const handleDisconnect = useCallback(() => {
        setEdges(edges.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
        onClose();
    }, [menu.nodeId, edges, setEdges, onClose]);

    return (
        <div
            ref={menuRef}
            className="workflow-context-menu"
            style={{ left: menu.x, top: menu.y }}
        >
            <button className="workflow-context-menu-item" onClick={handleRename}>
                <Edit3 size={13} />
                Rename
            </button>
            <button className="workflow-context-menu-item" onClick={handleDuplicate}>
                <Copy size={13} />
                Duplicate
                <span className="workflow-context-menu-shortcut">Ctrl+D</span>
            </button>
            <div className="workflow-context-menu-divider" />
            <button className="workflow-context-menu-item" onClick={handleDisconnect}>
                <Unlink size={13} />
                Disconnect
            </button>
            <button className="workflow-context-menu-item danger" onClick={handleDelete}>
                <Trash2 size={13} />
                Delete
                <span className="workflow-context-menu-shortcut">Del</span>
            </button>
        </div>
    );
}
