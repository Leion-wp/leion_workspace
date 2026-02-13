import { useRef, useState, useCallback, useEffect } from 'react';
import { useWorkflowStore } from '../store';
import { usePaneStateStore } from '../../panes/paneStateStore';

interface VariableInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    nodeId?: string;
    className?: string;
    rows?: number;
}

interface Suggestion {
    label: string;
    value: string;
    description?: string;
}

export function VariableInput({
    value,
    onChange,
    placeholder,
    multiline = false,
    className,
    rows = 3,
}: VariableInputProps) {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [triggerPos, setTriggerPos] = useState(0);

    const nodes = useWorkflowStore((s) => s.nodes);
    const variables = useWorkflowStore((s) => s.variables);
    const envVars = useWorkflowStore((s) => s.envVars);
    const paneStates = usePaneStateStore((s) => s.paneStates);

    // Build suggestions from available context
    const allSuggestions: Suggestion[] = [
        // Step results from nodes
        ...nodes
            .filter((n) => n.type !== 'start' && n.type !== 'comment')
            .map((n) => ({
                label: `steps.${n.id}.output`,
                value: `steps.${n.id}.output`,
                description: n.data.label,
            })),
        // Variables
        ...Object.keys(variables).map((key) => ({
            label: `variables.${key}`,
            value: `variables.${key}`,
            description: String(variables[key] ?? ''),
        })),
        // Env vars
        ...Object.keys(envVars).map((key) => ({
            label: `env.${key}`,
            value: `env.${key}`,
            description: envVars[key],
        })),
        // Pane ambient states
        ...Object.entries(paneStates).flatMap(([paneId, state]) => {
            const fields = Object.keys(state).filter((k) => k !== 'type');
            return fields.map((field) => ({
                label: `panes.${paneId}.${field}`,
                value: `panes.${paneId}.${field}`,
                description: `${state.type} · ${field}`,
            }));
        }),
    ];

    const filtered = filterText
        ? allSuggestions.filter((s) => s.label.toLowerCase().includes(filterText.toLowerCase()))
        : allSuggestions;

    const insertSuggestion = useCallback(
        (suggestion: Suggestion) => {
            const el = inputRef.current;
            if (!el) return;

            const cursorPos = el.selectionStart ?? value.length;
            // Replace from the {{ trigger position to cursor with the full template
            const before = value.slice(0, triggerPos);
            const after = value.slice(cursorPos);
            const newValue = `${before}{{${suggestion.value}}}${after}`;
            onChange(newValue);
            setShowDropdown(false);
            setFilterText('');

            // Restore focus and set cursor after inserted text
            requestAnimationFrame(() => {
                el.focus();
                const newCursor = before.length + suggestion.value.length + 4; // {{ + }} = 4 chars
                el.setSelectionRange(newCursor, newCursor);
            });
        },
        [value, onChange, triggerPos],
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value;
            const cursor = e.target.selectionStart ?? newValue.length;
            onChange(newValue);

            // Detect if "{{" was just typed
            const textBeforeCursor = newValue.slice(0, cursor);
            const lastTwoChars = textBeforeCursor.slice(-2);

            if (lastTwoChars === '{{') {
                setTriggerPos(cursor - 2);
                setFilterText('');
                setSelectedIndex(0);
                setShowDropdown(true);
            } else if (showDropdown) {
                // Check if we're still inside a {{ ... expression
                const triggerSlice = textBeforeCursor.slice(triggerPos + 2);
                if (triggerSlice.includes('}}') || (cursor <= triggerPos)) {
                    setShowDropdown(false);
                } else {
                    setFilterText(triggerSlice);
                    setSelectedIndex(0);
                }
            }
        },
        [onChange, showDropdown, triggerPos],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (!showDropdown) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (filtered[selectedIndex]) {
                    e.preventDefault();
                    insertSuggestion(filtered[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                setShowDropdown(false);
            }
        },
        [showDropdown, filtered, selectedIndex, insertSuggestion],
    );

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handler = (e: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDropdown]);

    const sharedProps = {
        ref: inputRef as React.Ref<HTMLInputElement & HTMLTextAreaElement>,
        className,
        value,
        placeholder,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
    };

    return (
        <div style={{ position: 'relative', display: 'block', width: '100%' }}>
            {multiline ? (
                <textarea {...sharedProps} rows={rows} style={{ width: '100%', boxSizing: 'border-box' }} />
            ) : (
                <input {...sharedProps} type="text" style={{ width: '100%', boxSizing: 'border-box' }} />
            )}
            {showDropdown && filtered.length > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 9999,
                        background: 'var(--bg-secondary, #161b22)',
                        border: '1px solid var(--border-color, #30363d)',
                        borderRadius: 6,
                        minWidth: 280,
                        maxHeight: 220,
                        overflowY: 'auto',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {filtered.map((s, i) => (
                        <div
                            key={s.value}
                            style={{
                                padding: '6px 10px',
                                cursor: 'pointer',
                                background: i === selectedIndex ? 'var(--accent-color, #1f6feb)' : 'transparent',
                                color: i === selectedIndex ? '#fff' : 'var(--text-primary, #e6edf3)',
                                fontSize: 12,
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}
                            onMouseEnter={() => setSelectedIndex(i)}
                            onClick={() => insertSuggestion(s)}
                        >
                            <span style={{ fontFamily: 'monospace' }}>{`{{${s.label}}}`}</span>
                            {s.description && (
                                <span style={{ opacity: 0.6, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                                    {s.description}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
