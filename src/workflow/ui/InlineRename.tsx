import { useEffect, useRef, useState } from 'react';
import { useWorkflowStore } from '../store';
import './InlineRename.css';

export interface InlineRenameState {
    nodeId: string;
    x: number;
    y: number;
    currentLabel: string;
}

interface InlineRenameProps {
    rename: InlineRenameState;
    onClose: () => void;
}

export function InlineRename({ rename, onClose }: InlineRenameProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(rename.currentLabel);
    const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const commit = () => {
        const trimmed = value.trim();
        if (trimmed) {
            updateNodeData(rename.nodeId, { label: trimmed });
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div
            className="inline-rename-overlay"
            style={{ left: rename.x, top: rename.y }}
        >
            <input
                ref={inputRef}
                className="inline-rename-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commit}
            />
        </div>
    );
}
