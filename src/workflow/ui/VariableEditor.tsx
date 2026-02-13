import { useCallback, useState } from 'react';
import { Plus, Trash2, Variable } from 'lucide-react';
import { useWorkflowStore } from '../store';
import './VariableEditor.css';

export function VariableEditor() {
    const variables = useWorkflowStore((s) => s.variables);
    const setVariable = useWorkflowStore((s) => s.setVariable);
    const removeVariable = useWorkflowStore((s) => s.removeVariable);

    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    const handleAdd = useCallback(() => {
        const key = newKey.trim();
        if (!key) return;
        setVariable(key, newValue);
        setNewKey('');
        setNewValue('');
    }, [newKey, newValue, setVariable]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    }, [handleAdd]);

    const handleValueChange = useCallback((key: string, value: string) => {
        setVariable(key, value);
    }, [setVariable]);

    const handleRemove = useCallback((key: string) => {
        removeVariable(key);
    }, [removeVariable]);

    const entries = Object.entries(variables);

    return (
        <div className="variable-editor">
            <div className="variable-editor-header">
                <div className="variable-editor-title">
                    <Variable size={14} />
                    <span>Variables</span>
                </div>
            </div>
            <div className="variable-editor-body">
                <div className="variable-editor-hint">
                    Define workflow variables accessible via <code>{'{{variables.key}}'}</code>
                </div>

                {entries.length > 0 && (
                    <div className="variable-editor-list">
                        {entries.map(([key, value]) => (
                            <div key={key} className="variable-editor-row">
                                <span className="variable-editor-key">{key}</span>
                                <input
                                    className="variable-editor-value"
                                    type="text"
                                    value={String(value ?? '')}
                                    onChange={(e) => handleValueChange(key, e.target.value)}
                                />
                                <button
                                    className="variable-editor-remove"
                                    onClick={() => handleRemove(key)}
                                    title={`Remove ${key}`}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="variable-editor-add-row">
                    <input
                        className="variable-editor-add-key"
                        type="text"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Key"
                    />
                    <input
                        className="variable-editor-add-value"
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Value"
                    />
                    <button
                        className="variable-editor-add-btn"
                        onClick={handleAdd}
                        disabled={!newKey.trim()}
                        title="Add variable"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {entries.length === 0 && (
                    <div className="variable-editor-empty">
                        No variables defined yet.
                    </div>
                )}
            </div>
        </div>
    );
}
