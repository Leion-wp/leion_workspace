import { useState } from 'react';
import { Cable, Plus, Trash2, ArrowRight } from 'lucide-react';
import './LiveWirePanel.css';

interface LiveWire {
    id: string;
    sourceType: string;
    sourcePaneId: string;
    targetType: string;
    targetPaneId: string;
    label?: string;
    active: boolean;
}

const WIRE_SOURCES = [
    { value: 'terminal-stdout', label: 'Terminal stdout' },
    { value: 'editor-content', label: 'Editor content' },
    { value: 'browser-selection', label: 'Browser selection' },
];

const WIRE_TARGETS = [
    { value: 'chat-prompt', label: 'Chat input' },
    { value: 'editor-insert', label: 'Editor insert' },
    { value: 'terminal-input', label: 'Terminal stdin' },
];

export function LiveWirePanel() {
    const [wires, setWires] = useState<LiveWire[]>([]);

    const addWire = () => {
        setWires((prev) => [...prev, {
            id: `wire-${Date.now()}`,
            sourceType: 'terminal-stdout',
            sourcePaneId: '',
            targetType: 'chat-prompt',
            targetPaneId: '',
            active: false,
        }]);
    };

    const removeWire = (id: string) => {
        setWires((prev) => prev.filter((w) => w.id !== id));
    };

    const updateWire = (id: string, updates: Partial<LiveWire>) => {
        setWires((prev) => prev.map((w) => w.id === id ? { ...w, ...updates } : w));
    };

    return (
        <div className="livewire-panel">
            <div className="livewire-header">
                <Cable size={14} />
                <span>Live Wires</span>
                <span className="livewire-hint">Direct pane connections without workflows</span>
            </div>
            <div className="livewire-list">
                {wires.length === 0 && (
                    <div className="livewire-empty">
                        No live wires. Create connections between panes for real-time data flow.
                    </div>
                )}
                {wires.map((wire) => (
                    <div key={wire.id} className={`livewire-row ${wire.active ? 'active' : ''}`}>
                        <div className="livewire-row-body">
                            <div className="livewire-endpoint">
                                <select value={wire.sourceType} onChange={(e) => updateWire(wire.id, { sourceType: e.target.value })}>
                                    {WIRE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <input
                                    placeholder="Pane ID"
                                    value={wire.sourcePaneId}
                                    onChange={(e) => updateWire(wire.id, { sourcePaneId: e.target.value })}
                                />
                            </div>
                            <ArrowRight size={14} className="livewire-arrow" />
                            <div className="livewire-endpoint">
                                <select value={wire.targetType} onChange={(e) => updateWire(wire.id, { targetType: e.target.value })}>
                                    {WIRE_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <input
                                    placeholder="Pane ID"
                                    value={wire.targetPaneId}
                                    onChange={(e) => updateWire(wire.id, { targetPaneId: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="livewire-controls">
                            <label className="livewire-toggle">
                                <input
                                    type="checkbox"
                                    checked={wire.active}
                                    onChange={(e) => updateWire(wire.id, { active: e.target.checked })}
                                />
                                {wire.active ? 'LIVE' : 'OFF'}
                            </label>
                            <button className="livewire-remove" onClick={() => removeWire(wire.id)}>
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <button className="livewire-add" onClick={addWire}>
                <Plus size={12} /> Add Wire
            </button>
        </div>
    );
}
