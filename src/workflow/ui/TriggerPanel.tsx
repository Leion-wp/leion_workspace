import { useState } from 'react';
import { Plus, Trash2, Zap, Clock, FileSearch, Terminal } from 'lucide-react';
import { useWorkflowStore } from '../store';
import type { WorkflowTrigger, FileWatchTrigger, TerminalTrigger, TimerTrigger } from '../types';
import './TriggerPanel.css';

export function TriggerPanel() {
    const triggers = useWorkflowStore((s) => s.triggers);
    const addTrigger = useWorkflowStore((s) => s.addTrigger);
    const removeTrigger = useWorkflowStore((s) => s.removeTrigger);
    const updateTrigger = useWorkflowStore((s) => s.updateTrigger);
    const [addType, setAddType] = useState<'filewatch' | 'terminal' | 'timer'>('filewatch');

    const handleAdd = () => {
        const id = `trigger-${Date.now()}`;
        if (addType === 'filewatch') {
            addTrigger({ type: 'filewatch', id, glob: '**/*.ts', events: ['change'], enabled: false });
        } else if (addType === 'terminal') {
            addTrigger({ type: 'terminal', id, terminalPaneId: '', pattern: 'error', enabled: false });
        } else {
            addTrigger({ type: 'timer', id, intervalMs: 30000, enabled: false });
        }
    };

    return (
        <div className="trigger-panel">
            <div className="trigger-panel-header">
                <Zap size={14} />
                <span>Triggers</span>
            </div>
            <div className="trigger-list">
                {triggers.length === 0 && (
                    <div className="trigger-empty">No triggers configured. Triggers auto-run this workflow on events.</div>
                )}
                {triggers.map((t) => (
                    <TriggerRow key={t.id} trigger={t} onUpdate={updateTrigger} onRemove={removeTrigger} />
                ))}
            </div>
            <div className="trigger-add">
                <select value={addType} onChange={(e) => setAddType(e.target.value as 'filewatch' | 'terminal' | 'timer')}>
                    <option value="filewatch">File Watch</option>
                    <option value="terminal">Terminal Event</option>
                    <option value="timer">Timer</option>
                </select>
                <button onClick={handleAdd} className="trigger-add-btn">
                    <Plus size={12} /> Add
                </button>
            </div>
        </div>
    );
}

function TriggerRow({ trigger, onUpdate, onRemove }: {
    trigger: WorkflowTrigger;
    onUpdate: (id: string, updates: Partial<WorkflowTrigger>) => void;
    onRemove: (id: string) => void;
}) {
    const Icon = trigger.type === 'filewatch' ? FileSearch : trigger.type === 'terminal' ? Terminal : Clock;

    return (
        <div className={`trigger-row ${trigger.enabled ? 'enabled' : ''}`}>
            <Icon size={12} className="trigger-type-icon" />
            <div className="trigger-row-content">
                {trigger.type === 'filewatch' && (
                    <>
                        <input
                            className="trigger-input"
                            value={(trigger as FileWatchTrigger).glob}
                            onChange={(e) => onUpdate(trigger.id, { glob: e.target.value } as Partial<FileWatchTrigger>)}
                            placeholder="Glob pattern (e.g. src/**/*.ts)"
                        />
                        <input
                            className="trigger-input small"
                            value={(trigger as FileWatchTrigger).cwd ?? ''}
                            onChange={(e) => onUpdate(trigger.id, { cwd: e.target.value } as Partial<FileWatchTrigger>)}
                            placeholder="Working dir (optional)"
                        />
                    </>
                )}
                {trigger.type === 'terminal' && (
                    <>
                        <input
                            className="trigger-input small"
                            value={(trigger as TerminalTrigger).terminalPaneId}
                            onChange={(e) => onUpdate(trigger.id, { terminalPaneId: e.target.value } as Partial<TerminalTrigger>)}
                            placeholder="Pane ID"
                        />
                        <input
                            className="trigger-input"
                            value={(trigger as TerminalTrigger).pattern}
                            onChange={(e) => onUpdate(trigger.id, { pattern: e.target.value } as Partial<TerminalTrigger>)}
                            placeholder="Regex pattern"
                        />
                    </>
                )}
                {trigger.type === 'timer' && (
                    <input
                        className="trigger-input"
                        type="number"
                        value={(trigger as TimerTrigger).intervalMs}
                        onChange={(e) => onUpdate(trigger.id, { intervalMs: Number(e.target.value) } as Partial<TimerTrigger>)}
                        placeholder="Interval (ms)"
                    />
                )}
            </div>
            <label className="trigger-toggle">
                <input
                    type="checkbox"
                    checked={trigger.enabled}
                    onChange={(e) => onUpdate(trigger.id, { enabled: e.target.checked })}
                />
                <span className="trigger-toggle-label">{trigger.enabled ? 'ON' : 'OFF'}</span>
            </label>
            <button className="trigger-remove-btn" onClick={() => onRemove(trigger.id)}>
                <Trash2 size={12} />
            </button>
        </div>
    );
}
