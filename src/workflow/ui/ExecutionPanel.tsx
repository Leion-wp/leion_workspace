import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Trash2, Play } from 'lucide-react';
import { useWorkflowStore } from '../store';
import type { StepResult } from '../types';
import './ExecutionPanel.css';

type TabId = 'logs' | 'results';

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '[Unable to display — circular reference]';
    }
}

export function ExecutionPanel() {
    const executionLogs = useWorkflowStore((s) => s.executionLogs);
    const executionContext = useWorkflowStore((s) => s.executionContext);
    const isExecuting = useWorkflowStore((s) => s.isExecuting);
    const clearExecutionLogs = useWorkflowStore((s) => s.clearExecutionLogs);
    const setExecutionPanelOpen = useWorkflowStore((s) => s.setExecutionPanelOpen);
    const pausedAtNodeId = useWorkflowStore((s) => s.pausedAtNodeId);
    const resolveBreakpoint = useWorkflowStore((s) => s.resolveBreakpoint);

    const [activeTab, setActiveTab] = useState<TabId>('logs');
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'logs') {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [executionLogs, activeTab]);

    const handleClose = useCallback(() => {
        setExecutionPanelOpen(false);
    }, [setExecutionPanelOpen]);

    const handleClear = useCallback(() => {
        clearExecutionLogs();
    }, [clearExecutionLogs]);

    const executionStatus = isExecuting
        ? 'running'
        : executionContext?.status ?? 'idle';

    const stepResults = executionContext?.stepResults ?? {};

    return (
        <div className="execution-panel">
            <div className="execution-panel-header">
                <div className="execution-panel-tabs">
                    <button
                        className={`execution-panel-tab${activeTab === 'logs' ? ' active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Logs
                    </button>
                    <button
                        className={`execution-panel-tab${activeTab === 'results' ? ' active' : ''}`}
                        onClick={() => setActiveTab('results')}
                    >
                        Results
                    </button>
                </div>
                <div className="execution-panel-header-right">
                    <span className={`execution-panel-status status-${executionStatus}`}>
                        {executionStatus}
                    </span>
                    <button
                        className="execution-panel-icon-btn"
                        onClick={handleClear}
                        title="Clear logs"
                    >
                        <Trash2 size={14} />
                    </button>
                    <button
                        className="execution-panel-icon-btn"
                        onClick={handleClose}
                        title="Close panel"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
            {pausedAtNodeId && (
                <div className="execution-panel-breakpoint-banner">
                    <span>⏸ Paused at node <strong>{pausedAtNodeId}</strong></span>
                    <button
                        className="execution-panel-continue-btn"
                        onClick={() => resolveBreakpoint(pausedAtNodeId)}
                    >
                        <Play size={12} /> Continue
                    </button>
                </div>
            )}
            <div className="execution-panel-body">
                {activeTab === 'logs' ? (
                    <LogsTab logs={executionLogs} logEndRef={logEndRef} />
                ) : (
                    <ResultsTab stepResults={stepResults} />
                )}
            </div>
        </div>
    );
}

function LogsTab({ logs, logEndRef }: {
    logs: string[];
    logEndRef: React.RefObject<HTMLDivElement>;
}) {
    if (logs.length === 0) {
        return <div className="execution-panel-empty">No logs yet. Run the workflow to see output.</div>;
    }

    return (
        <div className="execution-panel-logs">
            {logs.map((log, i) => (
                <div key={i} className="execution-panel-log-line">
                    <span className="execution-panel-log-index">{i + 1}</span>
                    <span className="execution-panel-log-text">{log}</span>
                </div>
            ))}
            <div ref={logEndRef} />
        </div>
    );
}

function ResultsTab({ stepResults }: { stepResults: Record<string, StepResult> }) {
    const entries = Object.values(stepResults);

    if (entries.length === 0) {
        return <div className="execution-panel-empty">No results yet. Run the workflow to see step outputs.</div>;
    }

    return (
        <div className="execution-panel-results">
            {entries.map((result) => (
                <div key={result.nodeId} className="execution-panel-result">
                    <div className="execution-panel-result-header">
                        <span className="execution-panel-result-node">{result.nodeId}</span>
                        <span className={`execution-panel-result-status status-${result.status}`}>
                            {result.status}
                        </span>
                        <span className="execution-panel-result-duration">
                            {result.endTime - result.startTime}ms
                        </span>
                    </div>
                    {result.error && (
                        <div className="execution-panel-result-error">{result.error}</div>
                    )}
                    {result.output !== null && result.output !== undefined && (
                        <pre className="execution-panel-result-output">
                            <code>{safeStringify(result.output)}</code>
                        </pre>
                    )}
                </div>
            ))}
        </div>
    );
}
