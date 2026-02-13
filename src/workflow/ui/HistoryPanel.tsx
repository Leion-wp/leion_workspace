import { useCallback } from 'react';
import { History, RotateCcw, Save } from 'lucide-react';
import { useWorkflowStore } from '../store';
import './HistoryPanel.css';

export function HistoryPanel() {
    const history = useWorkflowStore((s) => s.history);
    const saveCheckpoint = useWorkflowStore((s) => s.saveCheckpoint);
    const restoreCheckpoint = useWorkflowStore((s) => s.restoreCheckpoint);

    const handleSave = useCallback(() => {
        saveCheckpoint();
    }, [saveCheckpoint]);

    const handleRestore = useCallback((index: number) => {
        if (confirm(`Restore to "${history[index].label}"? This will replace your current workflow.`)) {
            restoreCheckpoint(index);
        }
    }, [history, restoreCheckpoint]);

    return (
        <div className="history-panel">
            <div className="history-panel-header">
                <History size={13} />
                <span>History</span>
                <button
                    className="history-panel-save-btn"
                    onClick={handleSave}
                    title="Save checkpoint"
                >
                    <Save size={12} />
                    Save checkpoint
                </button>
            </div>
            {history.length === 0 ? (
                <div className="history-panel-empty">No checkpoints yet. Click "Save checkpoint" to create one.</div>
            ) : (
                <div className="history-panel-list">
                    {history.map((snap, i) => (
                        <div key={snap.timestamp} className="history-panel-item">
                            <div className="history-panel-item-info">
                                <span className="history-panel-item-label">{snap.label}</span>
                                <span className="history-panel-item-time">
                                    {new Date(snap.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <button
                                className="history-panel-restore-btn"
                                onClick={() => handleRestore(i)}
                                title="Restore this checkpoint"
                            >
                                <RotateCcw size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
