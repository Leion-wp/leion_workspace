import { useCallback, useState, useEffect } from 'react';
import { Settings, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { WorkflowNodeData, StepResult } from '../types';
import { useWorkflowStore } from '../store';
import { useLayoutStore, getAllPaneIds } from '../../layout/store';
import type { Space } from '../../layout/store';
import './PropertyPanel.css';

interface PropertyPanelProps {
    nodeId: string;
    nodeData: WorkflowNodeData;
    nodeType?: string;
}

export function PropertyPanel({ nodeId, nodeData, nodeType }: PropertyPanelProps) {
    const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
    const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
    const executionContext = useWorkflowStore((s) => s.executionContext);
    const stepResult = executionContext?.stepResults[nodeId] ?? null;
    const hasBreakpoint = useWorkflowStore((s) => s.breakpoints.has(nodeId));
    const toggleBreakpoint = useWorkflowStore((s) => s.toggleBreakpoint);

    const handleClose = useCallback(() => {
        setSelectedNodeId(null);
    }, [setSelectedNodeId]);

    const handleInputChange = useCallback((fieldName: string, value: string) => {
        const currentInputs = nodeData.inputs ?? {};
        updateNodeData(nodeId, {
            inputs: { ...currentInputs, [fieldName]: value },
        });
    }, [nodeId, nodeData.inputs, updateNodeData]);

    const handleExpressionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(nodeId, { conditionExpression: e.target.value });
    }, [nodeId, updateNodeData]);

    const handleContinueOnErrorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(nodeId, { continueOnError: e.target.checked });
    }, [nodeId, updateNodeData]);

    const handleTransformCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(nodeId, { transformCode: e.target.value });
    }, [nodeId, updateNodeData]);

    const handleDelayMsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(nodeId, { delayMs: parseInt(e.target.value) || 1000 });
    }, [nodeId, updateNodeData]);

    const handleNumericChange = useCallback((field: string, value: string) => {
        const num = parseInt(value);
        updateNodeData(nodeId, { [field]: Number.isNaN(num) ? undefined : num });
    }, [nodeId, updateNodeData]);

    const isConditionNode = nodeType === 'condition' || nodeType === 'if' || nodeType === 'switch';
    const isTransformNode = nodeType === 'transform';
    const isDelayNode = nodeType === 'delay' || nodeType === 'pause';
    const isHttpNode = nodeType === 'http' || nodeType === 'fetch';
    const isLoopNode = nodeType === 'loop' || nodeType === 'repeat';
    const isTerminalNode = nodeType === 'terminal' || nodeType === 'run' || nodeType === 'send-input' || nodeType === 'read-terminal' || nodeType === 'wait-pattern';
    const isEditorNode = nodeType === 'editor' || nodeType === 'read-editor' || nodeType === 'write-editor' || nodeType === 'open-file' || nodeType === 'save-file' || nodeType === 'search-replace';
    const isChatNode = nodeType === 'chat' || nodeType === 'ask' || nodeType === 'new-chat' || nodeType === 'set-model' || nodeType === 'read-chat';
    const isSubworkflowNode = nodeType === 'subworkflow';
    const isMemoryReadNode = nodeType === 'memory-read' || nodeType === 'recall';
    const isMemoryWriteNode = nodeType === 'memory-write' || nodeType === 'remember' || nodeType === 'forget';
    const isVariableNode = nodeType === 'variable';
    const isRaceNode = nodeType === 'race';
    const isBrowserNode = nodeType === 'browser' || nodeType === 'navigate' || nodeType === 'click' || nodeType === 'fill' || nodeType === 'execute-js' || nodeType === 'scroll' || nodeType === 'extract' || nodeType === 'screenshot';
    const isSpaceNode = nodeType === 'space';
    const isMergeNode = nodeType === 'merge';
    const isFileNode = nodeType === 'file' || nodeType === 'read-file' || nodeType === 'write-file' || nodeType === 'list-files';
    const isNotifyNode = nodeType === 'notify';
    const isGitNode = nodeType === 'git' || nodeType === 'git-status' || nodeType === 'git-diff' || nodeType === 'git-commit';
    const isDatabaseNode = nodeType === 'database' || nodeType === 'db-query' || nodeType === 'db-insert';
    const isFormatNode = nodeType === 'format';
    const isValidateNode = nodeType === 'validate';
    const isParseNode = nodeType === 'parse';
    const isDiffNode = nodeType === 'diff';
    const isReadEnvNode = nodeType === 'read-env';
    const isToolNode = !!nodeData.toolName || !!nodeData.inputSchema;
    const showContinueOnError = isToolNode || isConditionNode || isTransformNode || isHttpNode || isLoopNode || isTerminalNode || isEditorNode || isChatNode || isBrowserNode || isDatabaseNode;
    const showRetryTimeout = isToolNode || isTransformNode || isHttpNode;

    // Derive the implicit action for primitive node types (used to pre-fill and hide action dropdowns)
    const impliedChatAction: WorkflowNodeData['chatAction'] | undefined =
        nodeType === 'ask' ? 'send-message' :
        nodeType === 'new-chat' ? 'new-conversation' :
        nodeType === 'set-model' ? 'set-model' :
        nodeType === 'read-chat' ? 'get-last-response' :
        undefined;
    const impliedTerminalAction: WorkflowNodeData['terminalAction'] | undefined =
        nodeType === 'run' ? 'run' :
        nodeType === 'send-input' ? 'send-input' :
        nodeType === 'read-terminal' ? 'wait-for-pattern' :
        nodeType === 'wait-pattern' ? 'wait-for-pattern' :
        undefined;
    const impliedEditorOperation: WorkflowNodeData['editorOperation'] | undefined =
        nodeType === 'read-editor' ? 'read' :
        nodeType === 'write-editor' ? 'write' :
        nodeType === 'open-file' ? 'open-file' :
        nodeType === 'save-file' ? 'save' :
        nodeType === 'search-replace' ? 'search-replace' :
        undefined;
    const impliedBrowserOperation: WorkflowNodeData['browserOperation'] | undefined =
        nodeType === 'navigate' ? 'navigate' :
        nodeType === 'click' ? 'click' :
        nodeType === 'fill' ? 'fill' :
        nodeType === 'execute-js' ? 'execute-js' :
        nodeType === 'scroll' ? 'scroll' :
        nodeType === 'extract' ? 'extract' :
        nodeType === 'screenshot' ? 'screenshot' :
        undefined;
    const impliedMemoryOperation: WorkflowNodeData['memoryOperation'] | undefined =
        nodeType === 'remember' ? 'write' :
        nodeType === 'forget' ? 'delete' :
        undefined;
    const impliedFileOperation: WorkflowNodeData['fileOperation'] | undefined =
        nodeType === 'read-file' ? 'read' :
        nodeType === 'write-file' ? 'write' :
        nodeType === 'list-files' ? 'list' :
        undefined;
    const impliedGitOperation: WorkflowNodeData['gitOperation'] | undefined =
        nodeType === 'git-status' ? 'status' :
        nodeType === 'git-diff' ? 'diff' :
        nodeType === 'git-commit' ? 'commit' :
        undefined;
    const impliedDatabaseOperation: WorkflowNodeData['databaseOperation'] | undefined =
        nodeType === 'db-query' ? 'query' :
        nodeType === 'db-insert' ? 'insert' :
        undefined;
    const impliedConditionMode: WorkflowNodeData['conditionMode'] | undefined =
        nodeType === 'if' ? 'binary' :
        nodeType === 'switch' ? 'switch' :
        undefined;

    // Terminal: space-aware pane selector
    const allSpaces = useLayoutStore((s) => s.spaces);
    const getInitialTerminalSpaceId = (spaces: Space[], paneId?: string) => {
        if (paneId) {
            const owner = spaces.find((s) => {
                const active = new Set(getAllPaneIds(s.layout));
                return active.has(paneId) && s.panes[paneId]?.type === 'terminal';
            });
            if (owner) return owner.id;
        }
        // Default: first space that has active terminal panes
        const withTerminal = spaces.find((s) => {
            const active = new Set(getAllPaneIds(s.layout));
            return [...active].some((id) => s.panes[id]?.type === 'terminal');
        });
        return withTerminal?.id ?? spaces[0]?.id ?? '';
    };
    const [terminalSpaceId, setTerminalSpaceId] = useState(() =>
        getInitialTerminalSpaceId(allSpaces, nodeData.terminalPaneId)
    );
    // Sync when node changes
    useEffect(() => {
        setTerminalSpaceId(getInitialTerminalSpaceId(allSpaces, nodeData.terminalPaneId));
    }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const selectedTerminalSpace = allSpaces.find((s) => s.id === terminalSpaceId);
    const activeInSpace = selectedTerminalSpace
        ? new Set(getAllPaneIds(selectedTerminalSpace.layout))
        : new Set<string>();
    const terminalPanesForSpace = selectedTerminalSpace
        ? Object.values(selectedTerminalSpace.panes).filter(
              (p) => activeInSpace.has(p.id) && p.type === 'terminal'
          )
        : [];

    // Editor: space-aware pane selector (reuses same pattern as terminal)
    const getInitialEditorSpaceId = (spaces: Space[], paneId?: string) => {
        if (paneId) {
            const owner = spaces.find((s) => {
                const active = new Set(getAllPaneIds(s.layout));
                return active.has(paneId) && s.panes[paneId]?.type === 'editor';
            });
            if (owner) return owner.id;
        }
        const withEditor = spaces.find((s) => {
            const active = new Set(getAllPaneIds(s.layout));
            return [...active].some((id) => s.panes[id]?.type === 'editor');
        });
        return withEditor?.id ?? allSpaces[0]?.id ?? '';
    };
    const [editorSpaceId, setEditorSpaceId] = useState(() =>
        getInitialEditorSpaceId(allSpaces, nodeData.editorPaneId)
    );
    useEffect(() => {
        setEditorSpaceId(getInitialEditorSpaceId(allSpaces, nodeData.editorPaneId));
    }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const selectedEditorSpace = allSpaces.find((s) => s.id === editorSpaceId);
    const activeInEditorSpace = selectedEditorSpace
        ? new Set(getAllPaneIds(selectedEditorSpace.layout))
        : new Set<string>();
    const editorPanesForSpace = selectedEditorSpace
        ? Object.values(selectedEditorSpace.panes).filter(
              (p) => activeInEditorSpace.has(p.id) && p.type === 'editor'
          )
        : [];

    // Chat pane selector (type === 'chat')
    const getInitialChatSpaceId = (spaces: Space[], paneId?: string) => {
        if (paneId) {
            const owner = spaces.find((s) => {
                const active = new Set(getAllPaneIds(s.layout));
                return active.has(paneId) && s.panes[paneId]?.type === 'chat';
            });
            if (owner) return owner.id;
        }
        const withChat = spaces.find((s) => {
            const active = new Set(getAllPaneIds(s.layout));
            return [...active].some((id) => s.panes[id]?.type === 'chat');
        });
        return withChat?.id ?? allSpaces[0]?.id ?? '';
    };
    const [chatSpaceId, setChatSpaceId] = useState(() =>
        getInitialChatSpaceId(allSpaces, nodeData.chatPaneId)
    );
    useEffect(() => {
        setChatSpaceId(getInitialChatSpaceId(allSpaces, nodeData.chatPaneId));
    }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const selectedChatSpace = allSpaces.find((s) => s.id === chatSpaceId);
    const activeInChatSpace = selectedChatSpace
        ? new Set(getAllPaneIds(selectedChatSpace.layout))
        : new Set<string>();
    const chatPanesForSpace = selectedChatSpace
        ? Object.values(selectedChatSpace.panes).filter(
              (p) => activeInChatSpace.has(p.id) && p.type === 'chat'
          )
        : [];

    // Browser pane selector (type === 'browser')
    const getInitialBrowserSpaceId = (spaces: Space[], paneId?: string) => {
        if (paneId) {
            const owner = spaces.find((s) => {
                const active = new Set(getAllPaneIds(s.layout));
                return active.has(paneId) && s.panes[paneId]?.type === 'browser';
            });
            if (owner) return owner.id;
        }
        const withBrowser = spaces.find((s) => {
            const active = new Set(getAllPaneIds(s.layout));
            return [...active].some((id) => s.panes[id]?.type === 'browser');
        });
        return withBrowser?.id ?? allSpaces[0]?.id ?? '';
    };
    const [browserSpaceId, setBrowserSpaceId] = useState(() =>
        getInitialBrowserSpaceId(allSpaces, nodeData.browserPaneId)
    );
    useEffect(() => {
        setBrowserSpaceId(getInitialBrowserSpaceId(allSpaces, nodeData.browserPaneId));
    }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const selectedBrowserSpace = allSpaces.find((s) => s.id === browserSpaceId);
    const activeInBrowserSpace = selectedBrowserSpace
        ? new Set(getAllPaneIds(selectedBrowserSpace.layout))
        : new Set<string>();
    const browserPanesForSpace = selectedBrowserSpace
        ? Object.values(selectedBrowserSpace.panes).filter(
              (p) => activeInBrowserSpace.has(p.id) && p.type === 'browser'
          )
        : [];

    const schema = nodeData.inputSchema as { properties?: Record<string, SchemaProperty> } | undefined;
    const properties = schema?.properties ?? {};
    const inputs = nodeData.inputs ?? {};

    return (
        <div className="workflow-property-panel">
            <div className="workflow-property-panel-header">
                <div className="workflow-property-panel-title">
                    <Settings size={14} />
                    <span>{nodeData.label}</span>
                </div>
                <button
                    className={`workflow-property-breakpoint-btn${hasBreakpoint ? ' active' : ''}`}
                    onClick={() => toggleBreakpoint(nodeId)}
                    title={hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint (pause before this node)'}
                >
                    ⏸
                </button>
                <button
                    className="workflow-property-panel-close"
                    onClick={handleClose}
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="workflow-property-panel-body">
                {nodeData.description && (
                    <div className="workflow-property-description">
                        {nodeData.description}
                    </div>
                )}

                {isConditionNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Condition</div>
                        {impliedConditionMode ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Mode</label>
                                <div className="workflow-property-implied">Action: {impliedConditionMode}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Mode</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.conditionMode ?? 'binary'}
                                    onChange={(e) => updateNodeData(nodeId, { conditionMode: e.target.value as 'binary' | 'switch' })}
                                >
                                    <option value="binary">Binary (true / false)</option>
                                    <option value="switch">Switch (multiple cases)</option>
                                </select>
                            </div>
                        )}
                        {(impliedConditionMode ?? nodeData.conditionMode ?? 'binary') === 'binary' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="condition-expression">
                                        Expression
                                    </label>
                                    <div className="workflow-property-field-hint">
                                        Use templates: <code>{'{{steps.nodeId.output.field}}'}</code>
                                    </div>
                                    <input
                                        id="condition-expression"
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.conditionExpression ?? ''}
                                        placeholder="e.g. {{steps.tool-1.output.status}}"
                                        onChange={handleExpressionChange}
                                    />
                                </div>
                                <div className="workflow-property-field-hint" style={{ marginTop: '4px' }}>
                                    Truthy values: non-empty strings, &quot;true&quot;, &quot;1&quot;, non-zero numbers.
                                </div>
                            </>
                        )}
                        {(impliedConditionMode ?? nodeData.conditionMode ?? 'binary') === 'switch' && (
                            <>
                                <div className="workflow-property-field-hint">
                                    Each case is evaluated in order. First matching case wins.
                                </div>
                                {(nodeData.conditionCases ?? []).map((c, idx) => (
                                    <div key={idx} className="workflow-property-field" style={{ border: '1px solid var(--border-color,#30363d)', borderRadius: 4, padding: 8, marginBottom: 4 }}>
                                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                            <input
                                                className="workflow-property-field-input"
                                                type="text"
                                                placeholder="Label"
                                                value={c.label}
                                                style={{ flex: 1 }}
                                                onChange={(e) => {
                                                    const updated = [...(nodeData.conditionCases ?? [])];
                                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                                    updateNodeData(nodeId, { conditionCases: updated });
                                                }}
                                            />
                                            <button
                                                style={{ padding: '2px 8px', cursor: 'pointer' }}
                                                onClick={() => {
                                                    const updated = (nodeData.conditionCases ?? []).filter((_, i) => i !== idx);
                                                    updateNodeData(nodeId, { conditionCases: updated });
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <input
                                            className="workflow-property-field-input"
                                            type="text"
                                            placeholder="Expression (e.g. {{steps.n.output.val}} === 'ok')"
                                            value={c.expression}
                                            onChange={(e) => {
                                                const updated = [...(nodeData.conditionCases ?? [])];
                                                updated[idx] = { ...updated[idx], expression: e.target.value };
                                                updateNodeData(nodeId, { conditionCases: updated });
                                            }}
                                        />
                                    </div>
                                ))}
                                <button
                                    className="workflow-property-field-input"
                                    style={{ cursor: 'pointer', marginTop: 4 }}
                                    onClick={() => {
                                        const updated = [...(nodeData.conditionCases ?? []), { label: `Case ${(nodeData.conditionCases ?? []).length + 1}`, expression: '' }];
                                        updateNodeData(nodeId, { conditionCases: updated });
                                    }}
                                >
                                    + Add case
                                </button>
                            </>
                        )}
                    </div>
                )}

                {isTransformNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Transform Code</div>
                        <div className="workflow-property-field">
                            <div className="workflow-property-field-hint">
                                Write JS code. Use <code>inputs</code> and <code>variables</code>.
                                Return a value.
                            </div>
                            <textarea
                                className="workflow-property-field-textarea"
                                value={nodeData.transformCode ?? ''}
                                onChange={handleTransformCodeChange}
                                rows={8}
                                placeholder={'// Example:\nreturn { total: inputs.a + inputs.b };'}
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {isDelayNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Delay</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="delay-ms">
                                Duration (ms)
                            </label>
                            <input
                                id="delay-ms"
                                className="workflow-property-field-input"
                                type="number"
                                min={0}
                                step={100}
                                value={nodeData.delayMs ?? 1000}
                                onChange={handleDelayMsChange}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="delay-expr">
                                Dynamic expression <span className="workflow-property-field-type">optional — overrides duration</span>
                            </label>
                            <div className="workflow-property-field-hint">
                                Template that resolves to ms, e.g. <code>{'{{steps.n.output.waitMs}}'}</code>
                            </div>
                            <input
                                id="delay-expr"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.delayExpression ?? ''}
                                placeholder="{{variables.delayMs}}"
                                onChange={(e) => updateNodeData(nodeId, { delayExpression: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="delay-jitter">
                                Jitter (± ms) <span className="workflow-property-field-type">optional</span>
                            </label>
                            <input
                                id="delay-jitter"
                                className="workflow-property-field-input"
                                type="number"
                                min={0}
                                step={50}
                                value={nodeData.delayJitter ?? 0}
                                onChange={(e) => handleNumericChange('delayJitter', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {isHttpNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">{nodeType === 'fetch' ? 'Fetch' : 'HTTP Request'}</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="http-method">Method</label>
                            <select
                                id="http-method"
                                className="workflow-property-field-input"
                                value={nodeData.httpMethod ?? 'GET'}
                                onChange={(e) => updateNodeData(nodeId, { httpMethod: e.target.value as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' })}
                            >
                                {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="http-url">URL</label>
                            <div className="workflow-property-field-hint">
                                Supports templates: <code>{'{{steps.node.output.url}}'}</code>
                            </div>
                            <input
                                id="http-url"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.httpUrl ?? ''}
                                placeholder="https://example.com/api"
                                onChange={(e) => updateNodeData(nodeId, { httpUrl: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="http-headers">
                                Headers <span className="workflow-property-field-type">JSON</span>
                            </label>
                            <textarea
                                id="http-headers"
                                className="workflow-property-field-textarea"
                                rows={3}
                                value={nodeData.httpHeaders ?? ''}
                                placeholder={'{"Authorization": "Bearer {{variables.token}}"}'}
                                onChange={(e) => updateNodeData(nodeId, { httpHeaders: e.target.value })}
                                spellCheck={false}
                            />
                        </div>
                        {(nodeData.httpMethod ?? 'GET') !== 'GET' && (nodeData.httpMethod ?? 'GET') !== 'DELETE' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="http-body">Body</label>
                                <textarea
                                    id="http-body"
                                    className="workflow-property-field-textarea"
                                    rows={4}
                                    value={nodeData.httpBody ?? ''}
                                    placeholder={'{"key": "value"}'}
                                    onChange={(e) => updateNodeData(nodeId, { httpBody: e.target.value })}
                                    spellCheck={false}
                                />
                            </div>
                        )}
                        {/* Advanced fields — only for compound 'http', hidden for primitive 'fetch' (≤5 rule) */}
                        {nodeType !== 'fetch' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="http-auth-type">Authentication</label>
                                    <select
                                        id="http-auth-type"
                                        className="workflow-property-field-input"
                                        value={nodeData.httpAuthType ?? 'none'}
                                        onChange={(e) => updateNodeData(nodeId, { httpAuthType: e.target.value as 'none' | 'bearer' | 'basic' | 'api-key' })}
                                    >
                                        <option value="none">None</option>
                                        <option value="bearer">Bearer Token</option>
                                        <option value="basic">Basic Auth (user:pass)</option>
                                        <option value="api-key">API Key</option>
                                    </select>
                                </div>
                                {(nodeData.httpAuthType ?? 'none') !== 'none' && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label" htmlFor="http-auth-value">
                                            {nodeData.httpAuthType === 'bearer' ? 'Token' : nodeData.httpAuthType === 'basic' ? 'username:password' : 'API Key value'}
                                        </label>
                                        <input
                                            id="http-auth-value"
                                            className="workflow-property-field-input"
                                            type="text"
                                            value={nodeData.httpAuthValue ?? ''}
                                            placeholder={nodeData.httpAuthType === 'bearer' ? 'Bearer token...' : nodeData.httpAuthType === 'basic' ? 'user:password' : 'api-key-value'}
                                            onChange={(e) => updateNodeData(nodeId, { httpAuthValue: e.target.value })}
                                        />
                                    </div>
                                )}
                                {nodeData.httpAuthType === 'api-key' && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label" htmlFor="http-auth-header">Header name</label>
                                        <input
                                            id="http-auth-header"
                                            className="workflow-property-field-input"
                                            type="text"
                                            value={nodeData.httpAuthHeader ?? ''}
                                            placeholder="X-API-Key"
                                            onChange={(e) => updateNodeData(nodeId, { httpAuthHeader: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="http-response-type">Response type</label>
                                    <select
                                        id="http-response-type"
                                        className="workflow-property-field-input"
                                        value={nodeData.httpResponseType ?? 'auto'}
                                        onChange={(e) => updateNodeData(nodeId, { httpResponseType: e.target.value as 'auto' | 'json' | 'text' })}
                                    >
                                        <option value="auto">Auto (detect from Content-Type)</option>
                                        <option value="json">Force JSON</option>
                                        <option value="text">Force text</option>
                                    </select>
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-continue-error">
                                        <input
                                            type="checkbox"
                                            checked={nodeData.httpFollowRedirects ?? true}
                                            onChange={(e) => updateNodeData(nodeId, { httpFollowRedirects: e.target.checked })}
                                        />
                                        Follow redirects
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isLoopNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">{nodeType === 'repeat' ? 'Repeat' : 'Loop'}</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="loop-items">
                                Items expression
                            </label>
                            <div className="workflow-property-field-hint">
                                Resolves to an array, e.g. <code>{'{{steps.http-1.output.body.items}}'}</code>
                            </div>
                            <input
                                id="loop-items"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.loopItemsExpression ?? ''}
                                placeholder="Leave empty to use fixed count"
                                onChange={(e) => updateNodeData(nodeId, { loopItemsExpression: e.target.value })}
                            />
                        </div>
                        {!nodeData.loopItemsExpression?.trim() && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="loop-count">
                                    Fixed count
                                </label>
                                <input
                                    id="loop-count"
                                    className="workflow-property-field-input"
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={nodeData.loopCount ?? 3}
                                    onChange={(e) => handleNumericChange('loopCount', e.target.value)}
                                />
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="loop-body">
                                Body code <span className="workflow-property-field-type">optional</span>
                            </label>
                            <div className="workflow-property-field-hint">
                                JS per iteration: receives <code>item</code>, <code>index</code>, <code>accumulator</code>, <code>variables</code>.
                            </div>
                            <textarea
                                id="loop-body"
                                className="workflow-property-field-textarea"
                                rows={5}
                                value={nodeData.loopBodyCode ?? ''}
                                onChange={(e) => updateNodeData(nodeId, { loopBodyCode: e.target.value })}
                                placeholder={'// example:\nreturn item * 2;'}
                                spellCheck={false}
                            />
                        </div>
                        {/* Advanced fields — only for compound 'loop', hidden for primitive 'repeat' (≤5 rule) */}
                        {nodeType !== 'repeat' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="loop-break">
                                        Break condition <span className="workflow-property-field-type">optional</span>
                                    </label>
                                    <div className="workflow-property-field-hint">
                                        JS expression — stops iteration when truthy. Has access to <code>item</code>, <code>index</code>, <code>accumulator</code>.
                                    </div>
                                    <input
                                        id="loop-break"
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.loopBreakCondition ?? ''}
                                        placeholder="item === null"
                                        onChange={(e) => updateNodeData(nodeId, { loopBreakCondition: e.target.value })}
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="loop-max">
                                        Max iterations <span className="workflow-property-field-type">optional</span>
                                    </label>
                                    <input
                                        id="loop-max"
                                        className="workflow-property-field-input"
                                        type="number"
                                        min={1}
                                        value={nodeData.loopMaxIterations ?? ''}
                                        placeholder="No limit"
                                        onChange={(e) => handleNumericChange('loopMaxIterations', e.target.value)}
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="loop-acc-init">
                                        Accumulator init <span className="workflow-property-field-type">JSON, optional</span>
                                    </label>
                                    <input
                                        id="loop-acc-init"
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.loopAccumulatorInit ?? ''}
                                        placeholder="[]"
                                        onChange={(e) => updateNodeData(nodeId, { loopAccumulatorInit: e.target.value })}
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-continue-error">
                                        <input
                                            type="checkbox"
                                            checked={nodeData.loopParallel ?? false}
                                            onChange={(e) => updateNodeData(nodeId, { loopParallel: e.target.checked })}
                                        />
                                        Run iterations in parallel
                                    </label>
                                </div>
                                {nodeData.loopParallel && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label" htmlFor="loop-concurrency">
                                            Max concurrency
                                        </label>
                                        <input
                                            id="loop-concurrency"
                                            className="workflow-property-field-input"
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={nodeData.loopConcurrency ?? 4}
                                            onChange={(e) => handleNumericChange('loopConcurrency', e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {isTerminalNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Terminal</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="terminal-space">
                                Target space
                            </label>
                            <select
                                id="terminal-space"
                                className="workflow-property-field-input"
                                value={terminalSpaceId}
                                onChange={(e) => {
                                    setTerminalSpaceId(e.target.value);
                                    updateNodeData(nodeId, { terminalPaneId: '' });
                                }}
                            >
                                {allSpaces.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.icon} {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="terminal-pane">
                                Target pane
                            </label>
                            {terminalPanesForSpace.length === 0 ? (
                                <div className="workflow-property-field-hint" style={{ color: '#f85149' }}>
                                    No active terminal panes in this space.
                                </div>
                            ) : (
                                <select
                                    id="terminal-pane"
                                    className="workflow-property-field-input"
                                    value={nodeData.terminalPaneId ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { terminalPaneId: e.target.value })}
                                >
                                    <option value="">— select a terminal pane —</option>
                                    {terminalPanesForSpace.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title || p.id}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {impliedTerminalAction ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="terminal-action">Action</label>
                                <div className="workflow-property-implied">Action: {impliedTerminalAction}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="terminal-action">Action</label>
                                <select
                                    id="terminal-action"
                                    className="workflow-property-field-input"
                                    value={nodeData.terminalAction ?? 'run'}
                                    onChange={(e) => updateNodeData(nodeId, { terminalAction: e.target.value as 'run' | 'new-session' | 'send-input' | 'send-signal' | 'wait-for-pattern' })}
                                >
                                    <option value="run">run — execute command</option>
                                    <option value="new-session">new-session — reset terminal</option>
                                    <option value="send-input">send-input — write to stdin</option>
                                    <option value="send-signal">send-signal — send Ctrl+C / kill</option>
                                    <option value="wait-for-pattern">wait-for-pattern — poll for regex</option>
                                </select>
                            </div>
                        )}
                        {(impliedTerminalAction ?? nodeData.terminalAction ?? 'run') === 'run' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label" htmlFor="terminal-cmd">
                                        Command
                                    </label>
                                    <div className="workflow-property-field-hint">
                                        Supports template expressions, e.g. <code>{'echo {{steps.prev.output.value}}'}</code>
                                    </div>
                                    <textarea
                                        id="terminal-cmd"
                                        className="workflow-property-field-textarea"
                                        rows={3}
                                        value={nodeData.terminalCommand ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { terminalCommand: e.target.value })}
                                        placeholder="ls -la"
                                        spellCheck={false}
                                    />
                                </div>
                                {/* Advanced fields — only for compound 'terminal', hidden for primitive 'run' (≤5 rule) */}
                                {nodeType !== 'run' && (
                                    <>
                                        <div className="workflow-property-field">
                                            <label className="workflow-property-field-label" htmlFor="terminal-workdir">
                                                Working directory <span className="workflow-property-field-type">optional</span>
                                            </label>
                                            <input
                                                id="terminal-workdir"
                                                className="workflow-property-field-input"
                                                type="text"
                                                value={nodeData.terminalWorkingDir ?? ''}
                                                placeholder="/path/to/dir"
                                                onChange={(e) => updateNodeData(nodeId, { terminalWorkingDir: e.target.value })}
                                            />
                                        </div>
                                        <div className="workflow-property-field">
                                            <label className="workflow-property-field-label" htmlFor="terminal-env">
                                                Environment variables <span className="workflow-property-field-type">JSON, optional</span>
                                            </label>
                                            <textarea
                                                id="terminal-env"
                                                className="workflow-property-field-textarea"
                                                rows={2}
                                                value={nodeData.terminalEnvVars ?? ''}
                                                placeholder={'{"NODE_ENV": "production"}'}
                                                onChange={(e) => updateNodeData(nodeId, { terminalEnvVars: e.target.value })}
                                                spellCheck={false}
                                            />
                                        </div>
                                        <div className="workflow-property-field">
                                            <label className="workflow-property-continue-error">
                                                <input
                                                    type="checkbox"
                                                    checked={nodeData.terminalCaptureStderr ?? false}
                                                    onChange={(e) => updateNodeData(nodeId, { terminalCaptureStderr: e.target.checked })}
                                                />
                                                Capture stderr
                                            </label>
                                        </div>
                                        <div className="workflow-property-field">
                                            <label className="workflow-property-continue-error">
                                                <input
                                                    type="checkbox"
                                                    checked={nodeData.terminalBackground ?? false}
                                                    onChange={(e) => updateNodeData(nodeId, { terminalBackground: e.target.checked })}
                                                />
                                                Run in background
                                            </label>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {(impliedTerminalAction ?? nodeData.terminalAction) === 'send-input' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="terminal-stdin">
                                    Input to send
                                </label>
                                <textarea
                                    id="terminal-stdin"
                                    className="workflow-property-field-textarea"
                                    rows={3}
                                    value={nodeData.terminalStdin ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { terminalStdin: e.target.value })}
                                    placeholder="Text to send to stdin..."
                                    spellCheck={false}
                                />
                            </div>
                        )}
                        {(impliedTerminalAction ?? nodeData.terminalAction) === 'send-signal' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="terminal-signal">Signal</label>
                                <select
                                    id="terminal-signal"
                                    className="workflow-property-field-input"
                                    value={nodeData.terminalSignal ?? 'SIGINT'}
                                    onChange={(e) => updateNodeData(nodeId, { terminalSignal: e.target.value as 'SIGTERM' | 'SIGKILL' | 'SIGINT' })}
                                >
                                    <option value="SIGINT">SIGINT (Ctrl+C)</option>
                                    <option value="SIGTERM">SIGTERM</option>
                                    <option value="SIGKILL">SIGKILL</option>
                                </select>
                            </div>
                        )}
                        {(impliedTerminalAction ?? nodeData.terminalAction) === 'wait-for-pattern' && nodeType !== 'read-terminal' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="terminal-wait-pattern">
                                    Wait pattern (regex)
                                </label>
                                <input
                                    id="terminal-wait-pattern"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.terminalWaitPattern ?? ''}
                                    placeholder="Server running on port \d+"
                                    onChange={(e) => updateNodeData(nodeId, { terminalWaitPattern: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isEditorNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Editor</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Target space</label>
                            <select
                                className="workflow-property-field-input"
                                value={editorSpaceId}
                                onChange={(e) => {
                                    setEditorSpaceId(e.target.value);
                                    updateNodeData(nodeId, { editorPaneId: '' });
                                }}
                            >
                                {allSpaces.map((s) => (
                                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Target pane</label>
                            {editorPanesForSpace.length === 0 ? (
                                <div className="workflow-property-field-hint" style={{ color: '#f85149' }}>
                                    No active editor panes in this space.
                                </div>
                            ) : (
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.editorPaneId ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { editorPaneId: e.target.value })}
                                >
                                    <option value="">— select an editor pane —</option>
                                    {editorPanesForSpace.map((p) => (
                                        <option key={p.id} value={p.id}>{p.title || p.id}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {impliedEditorOperation ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <div className="workflow-property-implied">Action: {impliedEditorOperation}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.editorOperation ?? 'read'}
                                    onChange={(e) => updateNodeData(nodeId, { editorOperation: e.target.value as WorkflowNodeData['editorOperation'] })}
                                >
                                    <option value="read">read — get current content</option>
                                    <option value="write">write — replace content</option>
                                    <option value="append">append — add at end</option>
                                    <option value="open-file">open-file — load file from disk</option>
                                    <option value="save">save — write to disk</option>
                                    <option value="goto-line">goto-line — scroll to line</option>
                                    <option value="search-replace">search-replace — find and replace</option>
                                    <option value="get-filepath">get-filepath — return current file path</option>
                                    <option value="get-selection">get-selection — return selected text</option>
                                </select>
                            </div>
                        )}
                        {((impliedEditorOperation ?? nodeData.editorOperation) === 'write' || (impliedEditorOperation ?? nodeData.editorOperation) === 'append') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Content</label>
                                <div className="workflow-property-field-hint">
                                    Supports templates: <code>{'{{steps.node.output.field}}'}</code>
                                </div>
                                <textarea
                                    className="workflow-property-field-textarea"
                                    rows={4}
                                    value={nodeData.editorContent ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { editorContent: e.target.value })}
                                    placeholder="Content to write…"
                                    spellCheck={false}
                                />
                            </div>
                        )}
                        {(impliedEditorOperation ?? nodeData.editorOperation) === 'open-file' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">File path</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.editorFilePath ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { editorFilePath: e.target.value })}
                                    placeholder="/path/to/file.txt"
                                />
                            </div>
                        )}
                        {(impliedEditorOperation ?? nodeData.editorOperation) === 'goto-line' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Line number</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="number"
                                    min={1}
                                    value={nodeData.editorLine ?? 1}
                                    onChange={(e) => handleNumericChange('editorLine', e.target.value)}
                                />
                            </div>
                        )}
                        {(impliedEditorOperation ?? nodeData.editorOperation) === 'search-replace' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Search pattern</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.editorSearchPattern ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { editorSearchPattern: e.target.value })}
                                        placeholder="text to find"
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Replacement</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.editorReplacement ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { editorReplacement: e.target.value })}
                                        placeholder="replacement text"
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-continue-error">
                                        <input
                                            type="checkbox"
                                            checked={nodeData.editorUseRegex ?? false}
                                            onChange={(e) => updateNodeData(nodeId, { editorUseRegex: e.target.checked })}
                                        />
                                        Use regex
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isChatNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Chat (AI Pane Automation)</div>
                        <div className="workflow-property-field-hint">
                            Targets a <strong>Chat pane</strong> in your layout. The pane must be open and the AI page loaded in the same space.
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Target space</label>
                            <select
                                className="workflow-property-field-input"
                                value={chatSpaceId}
                                onChange={(e) => {
                                    setChatSpaceId(e.target.value);
                                    updateNodeData(nodeId, { chatPaneId: '' });
                                }}
                            >
                                {allSpaces.map((s) => (
                                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Chat pane</label>
                            {chatPanesForSpace.length === 0 ? (
                                <div className="workflow-property-field-hint" style={{ color: '#f85149' }}>
                                    No active Chat panes in this space. Add a Chat pane to the layout.
                                </div>
                            ) : (
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.chatPaneId ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { chatPaneId: e.target.value })}
                                >
                                    <option value="">— select a chat pane —</option>
                                    {chatPanesForSpace.map((p) => (
                                        <option key={p.id} value={p.id}>{p.title || p.id}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {impliedChatAction ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Action</label>
                                <div className="workflow-property-implied">Action: {impliedChatAction}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Action</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.chatAction ?? 'send-message'}
                                    onChange={(e) => updateNodeData(nodeId, { chatAction: e.target.value as WorkflowNodeData['chatAction'] })}
                                >
                                    <option value="send-message">send-message — inject prompt and wait</option>
                                    <option value="new-conversation">new-conversation — start fresh chat</option>
                                    <option value="set-model">set-model — change AI model</option>
                                    <option value="select-project">select-project — navigate to project</option>
                                    <option value="enable-developer-mode">enable-developer-mode</option>
                                    <option value="ephemeral-chat">ephemeral-chat — temporary chat</option>
                                    <option value="get-last-response">get-last-response — read last reply</option>
                                </select>
                            </div>
                        )}
                        {(impliedChatAction ?? nodeData.chatAction ?? 'send-message') === 'send-message' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-continue-error">
                                        <input
                                            type="checkbox"
                                            checked={nodeData.chatNewConversationFirst ?? false}
                                            onChange={(e) => updateNodeData(nodeId, { chatNewConversationFirst: e.target.checked })}
                                        />
                                        Start new conversation first
                                    </label>
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Prompt</label>
                                    <div className="workflow-property-field-hint">
                                        Supports templates: <code>{'{{steps.node.output.field}}'}</code>
                                    </div>
                                    <textarea
                                        className="workflow-property-field-textarea"
                                        rows={4}
                                        value={nodeData.chatPrompt ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { chatPrompt: e.target.value })}
                                        placeholder="Enter your prompt here..."
                                        spellCheck={false}
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">
                                        Output schema <span className="workflow-property-field-type">JSON, optional</span>
                                    </label>
                                    <div className="workflow-property-field-hint">
                                        If set, attempts to parse JSON from the response.
                                    </div>
                                    <textarea
                                        className="workflow-property-field-textarea"
                                        rows={3}
                                        value={nodeData.chatOutputSchema ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { chatOutputSchema: e.target.value })}
                                        placeholder={'{"result": "string"}'}
                                        spellCheck={false}
                                    />
                                </div>
                            </>
                        )}
                        {(impliedChatAction ?? nodeData.chatAction) === 'set-model' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Model name</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.chatModel ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { chatModel: e.target.value })}
                                    placeholder="e.g. GPT-4o, Claude Sonnet, Gemini Pro"
                                />
                            </div>
                        )}
                        {nodeData.chatAction === 'select-project' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Project name</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.chatProject ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { chatProject: e.target.value })}
                                    placeholder="Project name as shown in sidebar"
                                />
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="chat-timeout">
                                Response timeout <span className="workflow-property-field-type">seconds, default 120</span>
                            </label>
                            <input
                                id="chat-timeout"
                                className="workflow-property-field-input"
                                type="number"
                                min={10}
                                value={nodeData.chatResponseTimeout ?? ''}
                                placeholder="120"
                                onChange={(e) => handleNumericChange('chatResponseTimeout', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {isSubworkflowNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Sub-Workflow</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Workflow file path</label>
                            <div className="workflow-property-field-hint">
                                Absolute path to a <code>.json</code> workflow file.
                            </div>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.subworkflowId ?? ''}
                                onChange={(e) => updateNodeData(nodeId, { subworkflowId: e.target.value })}
                                placeholder="/path/to/workflow.json"
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">
                                Input overrides <span className="workflow-property-field-type">JSON</span>
                            </label>
                            <div className="workflow-property-field-hint">
                                Variables to inject into the sub-workflow (merged with its own variables).
                            </div>
                            <textarea
                                className="workflow-property-field-textarea"
                                rows={4}
                                value={nodeData.subworkflowInputs ? JSON.stringify(nodeData.subworkflowInputs, null, 2) : ''}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        updateNodeData(nodeId, { subworkflowInputs: parsed });
                                    } catch {
                                        // ignore parse errors while typing
                                    }
                                }}
                                placeholder={'{\n  "key": "value"\n}'}
                                spellCheck={false}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="sub-output-step">
                                Output step ID <span className="workflow-property-field-type">optional</span>
                            </label>
                            <div className="workflow-property-field-hint">
                                If set, return only this step&apos;s output instead of full results.
                            </div>
                            <input
                                id="sub-output-step"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.subworkflowOutputStep ?? ''}
                                placeholder="step-node-id"
                                onChange={(e) => updateNodeData(nodeId, { subworkflowOutputStep: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="sub-timeout">
                                Timeout <span className="workflow-property-field-type">seconds, optional</span>
                            </label>
                            <input
                                id="sub-timeout"
                                className="workflow-property-field-input"
                                type="number"
                                min={1}
                                value={nodeData.subworkflowTimeout ?? ''}
                                placeholder="No timeout"
                                onChange={(e) => handleNumericChange('subworkflowTimeout', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {(isMemoryReadNode || isMemoryWriteNode) && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">
                            {isMemoryReadNode ? 'Memory Read' : 'Memory Write'}
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Key</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.memoryKey ?? ''}
                                onChange={(e) => updateNodeData(nodeId, { memoryKey: e.target.value })}
                                placeholder="my-key"
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Scope</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.memoryScope ?? 'workflow'}
                                onChange={(e) => updateNodeData(nodeId, { memoryScope: e.target.value as 'workflow' | 'global' | 'session' })}
                            >
                                <option value="workflow">Workflow (per-workflow persistence)</option>
                                <option value="global">Global (shared across all workflows)</option>
                                <option value="session">Session (in-memory, not persisted)</option>
                            </select>
                        </div>
                        {isMemoryWriteNode && (
                            <>
                                {impliedMemoryOperation ? (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label">Operation</label>
                                        <div className="workflow-property-implied">Action: {impliedMemoryOperation}</div>
                                    </div>
                                ) : (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label">Operation</label>
                                        <select
                                            className="workflow-property-field-input"
                                            value={nodeData.memoryOperation ?? 'write'}
                                            onChange={(e) => updateNodeData(nodeId, { memoryOperation: e.target.value as WorkflowNodeData['memoryOperation'] })}
                                        >
                                            <option value="write">write — set value</option>
                                            <option value="append-array">append-array — push to array</option>
                                            <option value="append-string">append-string — concatenate</option>
                                            <option value="delete">delete — remove key</option>
                                            <option value="increment">increment — add to number</option>
                                        </select>
                                    </div>
                                )}
                                {(impliedMemoryOperation ?? nodeData.memoryOperation ?? 'write') !== 'delete' && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label">
                                            Value {nodeData.memoryOperation === 'increment' ? '(delta, default 1)' : ''}
                                        </label>
                                        <div className="workflow-property-field-hint">
                                            Supports templates: <code>{'{{steps.node.output.field}}'}</code>
                                        </div>
                                        <textarea
                                            className="workflow-property-field-textarea"
                                            rows={3}
                                            value={nodeData.memoryValue ?? ''}
                                            onChange={(e) => updateNodeData(nodeId, { memoryValue: e.target.value })}
                                            placeholder={nodeData.memoryOperation === 'increment' ? '1' : 'Value to store...'}
                                            spellCheck={false}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {isVariableNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Variable</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Key</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.memoryKey ?? ''}
                                onChange={(e) => updateNodeData(nodeId, { memoryKey: e.target.value })}
                                placeholder="myVar"
                            />
                            <div className="workflow-property-field-hint">
                                Accessible as <code>{'{{variables.<key>}}'}</code> in downstream nodes
                            </div>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Operation</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.memoryOperation ?? 'write'}
                                onChange={(e) => updateNodeData(nodeId, { memoryOperation: e.target.value as WorkflowNodeData['memoryOperation'] })}
                            >
                                <option value="write">set — assign value</option>
                                <option value="delete">delete — remove variable</option>
                                <option value="increment">increment — add to number</option>
                            </select>
                        </div>
                        {(nodeData.memoryOperation ?? 'write') !== 'delete' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">
                                    Value {nodeData.memoryOperation === 'increment' ? '(delta, default 1)' : ''}
                                </label>
                                <div className="workflow-property-field-hint">
                                    Supports templates: <code>{'{{steps.node.output.field}}'}</code>
                                </div>
                                <textarea
                                    className="workflow-property-field-textarea"
                                    rows={3}
                                    value={nodeData.memoryValue ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { memoryValue: e.target.value })}
                                    placeholder={nodeData.memoryOperation === 'increment' ? '1' : 'Value to assign...'}
                                    spellCheck={false}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isRaceNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Race (Parallel Fork)</div>
                        <div className="workflow-property-field-hint" style={{ padding: '8px 0' }}>
                            Connect multiple outgoing edges to create competing parallel branches.
                            Combine with a <strong>Merge</strong> node using &quot;first-complete&quot; strategy
                            to take the fastest result.
                        </div>
                    </div>
                )}

                {isBrowserNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Browser</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Target space</label>
                            <select
                                className="workflow-property-field-input"
                                value={browserSpaceId}
                                onChange={(e) => {
                                    setBrowserSpaceId(e.target.value);
                                    updateNodeData(nodeId, { browserPaneId: '' });
                                }}
                            >
                                {allSpaces.map((s) => (
                                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Browser pane</label>
                            {browserPanesForSpace.length === 0 ? (
                                <div className="workflow-property-field-hint" style={{ color: '#f85149' }}>
                                    No active browser panes in this space.
                                </div>
                            ) : (
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.browserPaneId ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { browserPaneId: e.target.value })}
                                >
                                    <option value="">— select a browser pane —</option>
                                    {browserPanesForSpace.map((p) => (
                                        <option key={p.id} value={p.id}>{p.title || p.id}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {impliedBrowserOperation ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <div className="workflow-property-implied">Action: {impliedBrowserOperation}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.browserOperation ?? (nodeData.browserUrl && !nodeData.browserExtractSelector ? 'navigate' : nodeData.browserExtractSelector ? 'extract' : 'navigate')}
                                    onChange={(e) => updateNodeData(nodeId, { browserOperation: e.target.value as WorkflowNodeData['browserOperation'] })}
                                >
                                    <option value="navigate">navigate — go to URL</option>
                                    <option value="extract">extract — get content</option>
                                    <option value="click">click — click element</option>
                                    <option value="fill">fill — input text</option>
                                    <option value="wait-for">wait-for — wait for condition</option>
                                    <option value="execute-js">execute-js — run JS code</option>
                                    <option value="screenshot">screenshot — capture page</option>
                                    <option value="scroll">scroll — scroll page</option>
                                    <option value="hover">hover — mouse over element</option>
                                    <option value="extract-table">extract-table — parse HTML table</option>
                                </select>
                            </div>
                        )}
                        {(impliedBrowserOperation ?? nodeData.browserOperation ?? 'navigate') === 'navigate' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">URL</label>
                                <div className="workflow-property-field-hint">
                                    Supports templates: <code>{'{{steps.node.output.url}}'}</code>
                                </div>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.browserUrl ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { browserUrl: e.target.value })}
                                    placeholder="https://example.com"
                                />
                            </div>
                        )}
                        {((impliedBrowserOperation ?? nodeData.browserOperation) === 'extract') && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Selector</label>
                                    <div className="workflow-property-field-hint">
                                        CSS selector, or: <code>text</code>, <code>html</code>, <code>title</code>, <code>url</code>
                                    </div>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.browserExtractSelector ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { browserExtractSelector: e.target.value })}
                                        placeholder="text"
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Extract mode</label>
                                    <select
                                        className="workflow-property-field-input"
                                        value={nodeData.browserExtractMode ?? 'text'}
                                        onChange={(e) => updateNodeData(nodeId, { browserExtractMode: e.target.value as WorkflowNodeData['browserExtractMode'] })}
                                    >
                                        <option value="text">text — innerText</option>
                                        <option value="html">html — innerHTML</option>
                                        <option value="attribute">attribute — get attribute</option>
                                        <option value="list">list — multiple elements as array</option>
                                    </select>
                                </div>
                                {nodeData.browserExtractMode === 'attribute' && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label">Attribute name</label>
                                        <input
                                            className="workflow-property-field-input"
                                            type="text"
                                            value={nodeData.browserExtractAttribute ?? ''}
                                            onChange={(e) => updateNodeData(nodeId, { browserExtractAttribute: e.target.value })}
                                            placeholder="href"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        {((impliedBrowserOperation ?? nodeData.browserOperation) === 'click' || (impliedBrowserOperation ?? nodeData.browserOperation) === 'hover' || (impliedBrowserOperation ?? nodeData.browserOperation) === 'extract-table') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Selector</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.browserExtractSelector ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { browserExtractSelector: e.target.value })}
                                    placeholder="button.submit"
                                />
                            </div>
                        )}
                        {(impliedBrowserOperation ?? nodeData.browserOperation) === 'fill' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Selector</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.browserExtractSelector ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { browserExtractSelector: e.target.value })}
                                        placeholder="input[name='email']"
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Value to fill</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.browserFillValue ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { browserFillValue: e.target.value })}
                                        placeholder="Text to enter..."
                                    />
                                </div>
                            </>
                        )}
                        {(impliedBrowserOperation ?? nodeData.browserOperation) === 'wait-for' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Wait condition</label>
                                    <select
                                        className="workflow-property-field-input"
                                        value={nodeData.browserWaitCondition ?? 'element'}
                                        onChange={(e) => updateNodeData(nodeId, { browserWaitCondition: e.target.value as WorkflowNodeData['browserWaitCondition'] })}
                                    >
                                        <option value="element">element — wait for selector to appear</option>
                                        <option value="url-contains">url-contains — wait for URL to contain text</option>
                                        <option value="text-contains">text-contains — wait for page text to contain</option>
                                    </select>
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">
                                        {(nodeData.browserWaitCondition ?? 'element') === 'element' ? 'Selector' : 'Text to match'}
                                    </label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.browserExtractSelector ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { browserExtractSelector: e.target.value })}
                                        placeholder={(nodeData.browserWaitCondition ?? 'element') === 'element' ? '.loading-done' : 'success'}
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Timeout (ms)</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="number"
                                        min={500}
                                        value={nodeData.browserWaitTimeout ?? 10000}
                                        onChange={(e) => handleNumericChange('browserWaitTimeout', e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        {(impliedBrowserOperation ?? nodeData.browserOperation) === 'execute-js' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">JavaScript code</label>
                                <textarea
                                    className="workflow-property-field-textarea"
                                    rows={6}
                                    value={nodeData.browserJsCode ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { browserJsCode: e.target.value })}
                                    placeholder={'// return a value\ndocument.title'}
                                    spellCheck={false}
                                />
                            </div>
                        )}
                        {(impliedBrowserOperation ?? nodeData.browserOperation) === 'scroll' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Scroll to</label>
                                    <select
                                        className="workflow-property-field-input"
                                        value={nodeData.browserScrollDirection ?? 'bottom'}
                                        onChange={(e) => updateNodeData(nodeId, { browserScrollDirection: e.target.value as 'top' | 'bottom' | 'element' })}
                                    >
                                        <option value="top">Top of page</option>
                                        <option value="bottom">Bottom of page</option>
                                        <option value="element">Scroll to element</option>
                                    </select>
                                </div>
                                {nodeData.browserScrollDirection === 'element' && (
                                    <div className="workflow-property-field">
                                        <label className="workflow-property-field-label">Element selector</label>
                                        <input
                                            className="workflow-property-field-input"
                                            type="text"
                                            value={nodeData.browserExtractSelector ?? ''}
                                            onChange={(e) => updateNodeData(nodeId, { browserExtractSelector: e.target.value })}
                                            placeholder="#footer"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {isMergeNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Merge</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Strategy</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.mergeStrategy ?? 'all'}
                                onChange={(e) => updateNodeData(nodeId, { mergeStrategy: e.target.value as WorkflowNodeData['mergeStrategy'] })}
                            >
                                <option value="all">all — collect all outputs as object</option>
                                <option value="first-complete">first-complete — return first available</option>
                                <option value="flatten">flatten — merge all objects into one</option>
                                <option value="concat-arrays">concat-arrays — combine all arrays</option>
                            </select>
                        </div>
                    </div>
                )}

                {isSpaceNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Space</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Operation</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.spaceOperation ?? 'switch'}
                                onChange={(e) => updateNodeData(nodeId, { spaceOperation: e.target.value as WorkflowNodeData['spaceOperation'] })}
                            >
                                <option value="switch">switch — activate a space</option>
                                <option value="create">create — create new space</option>
                                <option value="add-pane">add-pane — add pane to current space</option>
                                <option value="close-pane">close-pane — remove pane</option>
                                <option value="return-previous">return-previous — go back</option>
                            </select>
                        </div>
                        {(nodeData.spaceOperation ?? 'switch') === 'switch' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Target space</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.targetSpaceId ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { targetSpaceId: e.target.value })}
                                >
                                    <option value="">— select a space —</option>
                                    {allSpaces.map((s) => (
                                        <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {nodeData.spaceOperation === 'create' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Space name</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.spaceNewName ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { spaceNewName: e.target.value })}
                                        placeholder="New Space"
                                    />
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Icon (emoji)</label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.spaceNewIcon ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { spaceNewIcon: e.target.value })}
                                        placeholder="📁"
                                    />
                                </div>
                            </>
                        )}
                        {nodeData.spaceOperation === 'add-pane' && (
                            <>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Pane type</label>
                                    <select
                                        className="workflow-property-field-input"
                                        value={nodeData.spacePaneType ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { spacePaneType: e.target.value })}
                                    >
                                        <option value="">— select type —</option>
                                        <option value="terminal">terminal</option>
                                        <option value="editor">editor</option>
                                        <option value="browser">browser</option>
                                        <option value="chat">chat</option>
                                        <option value="workflow">workflow</option>
                                    </select>
                                </div>
                                <div className="workflow-property-field">
                                    <label className="workflow-property-field-label">Pane ID <span className="workflow-property-field-type">optional</span></label>
                                    <input
                                        className="workflow-property-field-input"
                                        type="text"
                                        value={nodeData.spacePaneTarget ?? ''}
                                        onChange={(e) => updateNodeData(nodeId, { spacePaneTarget: e.target.value })}
                                        placeholder="auto-generated if empty"
                                    />
                                </div>
                            </>
                        )}
                        {nodeData.spaceOperation === 'close-pane' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Pane ID to close</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.spacePaneTarget ?? ''}
                                    onChange={(e) => updateNodeData(nodeId, { spacePaneTarget: e.target.value })}
                                    placeholder="pane-id"
                                />
                            </div>
                        )}
                    </div>
                )}

                {isFileNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">File Operation</div>
                        {impliedFileOperation ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <div className="workflow-property-implied">Action: {impliedFileOperation}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.fileOperation ?? 'read'}
                                    onChange={(e) => updateNodeData(nodeId, { fileOperation: e.target.value as WorkflowNodeData['fileOperation'] })}
                                >
                                    <option value="read">Read</option>
                                    <option value="write">Write</option>
                                    <option value="append">Append</option>
                                    <option value="list">List</option>
                                    <option value="move">Move</option>
                                    <option value="copy">Copy</option>
                                    <option value="delete">Delete</option>
                                    <option value="exists">Exists</option>
                                </select>
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="file-path">Path</label>
                            <input
                                id="file-path"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.filePath ?? ''}
                                placeholder="/path/to/file or {{variables.path}}"
                                onChange={(e) => updateNodeData(nodeId, { filePath: e.target.value })}
                            />
                        </div>
                        {((impliedFileOperation ?? nodeData.fileOperation) === 'write' || (impliedFileOperation ?? nodeData.fileOperation) === 'append') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="file-content">Content</label>
                                <textarea
                                    id="file-content"
                                    className="workflow-property-field-textarea"
                                    value={nodeData.fileContent ?? ''}
                                    rows={4}
                                    placeholder="Content to write. Supports {{variables.x}}"
                                    onChange={(e) => updateNodeData(nodeId, { fileContent: e.target.value })}
                                />
                            </div>
                        )}
                        {((impliedFileOperation ?? nodeData.fileOperation) === 'move' || (impliedFileOperation ?? nodeData.fileOperation) === 'copy') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="file-dest">Destination</label>
                                <input
                                    id="file-dest"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.fileDestination ?? ''}
                                    placeholder="/path/to/destination"
                                    onChange={(e) => updateNodeData(nodeId, { fileDestination: e.target.value })}
                                />
                            </div>
                        )}
                        {(impliedFileOperation ?? nodeData.fileOperation) === 'list' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="file-glob">Glob Pattern</label>
                                <input
                                    id="file-glob"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.fileGlob ?? '**/*'}
                                    placeholder="**/*.ts"
                                    onChange={(e) => updateNodeData(nodeId, { fileGlob: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Encoding</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.fileEncoding ?? 'utf8'}
                                onChange={(e) => updateNodeData(nodeId, { fileEncoding: e.target.value as WorkflowNodeData['fileEncoding'] })}
                            >
                                <option value="utf8">UTF-8</option>
                                <option value="base64">Base64</option>
                                <option value="binary">Binary</option>
                            </select>
                        </div>
                    </div>
                )}

                {isNotifyNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Notification</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="notify-title">Title</label>
                            <input
                                id="notify-title"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.notifyTitle ?? ''}
                                placeholder="Notification title"
                                onChange={(e) => updateNodeData(nodeId, { notifyTitle: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="notify-body">Body</label>
                            <textarea
                                id="notify-body"
                                className="workflow-property-field-textarea"
                                value={nodeData.notifyBody ?? ''}
                                rows={3}
                                placeholder="Notification message. Supports {{variables.x}}"
                                onChange={(e) => updateNodeData(nodeId, { notifyBody: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isGitNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Git Operation</div>
                        {impliedGitOperation ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <div className="workflow-property-implied">Action: {impliedGitOperation}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.gitOperation ?? 'status'}
                                    onChange={(e) => updateNodeData(nodeId, { gitOperation: e.target.value as WorkflowNodeData['gitOperation'] })}
                                >
                                    <option value="status">Status</option>
                                    <option value="diff">Diff</option>
                                    <option value="add">Add</option>
                                    <option value="commit">Commit</option>
                                    <option value="push">Push</option>
                                    <option value="pull">Pull</option>
                                    <option value="checkout">Checkout</option>
                                    <option value="branch">Branch</option>
                                    <option value="log">Log</option>
                                    <option value="stash">Stash</option>
                                </select>
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="git-cwd">Working Directory</label>
                            <input
                                id="git-cwd"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.gitWorkingDir ?? ''}
                                placeholder="Leave empty for workspace root"
                                onChange={(e) => updateNodeData(nodeId, { gitWorkingDir: e.target.value })}
                            />
                        </div>
                        {((impliedGitOperation ?? nodeData.gitOperation) === 'commit' || (impliedGitOperation ?? nodeData.gitOperation) === 'stash') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="git-message">Message</label>
                                <input
                                    id="git-message"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.gitMessage ?? ''}
                                    placeholder="Commit message. Supports {{variables.x}}"
                                    onChange={(e) => updateNodeData(nodeId, { gitMessage: e.target.value })}
                                />
                            </div>
                        )}
                        {((impliedGitOperation ?? nodeData.gitOperation) === 'checkout' || (impliedGitOperation ?? nodeData.gitOperation) === 'push' ||
                          (impliedGitOperation ?? nodeData.gitOperation) === 'pull' || (impliedGitOperation ?? nodeData.gitOperation) === 'branch') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="git-branch">Branch</label>
                                <input
                                    id="git-branch"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.gitBranch ?? ''}
                                    placeholder="Branch name"
                                    onChange={(e) => updateNodeData(nodeId, { gitBranch: e.target.value })}
                                />
                            </div>
                        )}
                        {(impliedGitOperation ?? nodeData.gitOperation) === 'add' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="git-files">Files</label>
                                <input
                                    id="git-files"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.gitFiles ?? '.'}
                                    placeholder=". (all) or specific paths"
                                    onChange={(e) => updateNodeData(nodeId, { gitFiles: e.target.value })}
                                />
                            </div>
                        )}
                        {(impliedGitOperation ?? nodeData.gitOperation) === 'diff' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={nodeData.gitStaged ?? false}
                                        onChange={(e) => updateNodeData(nodeId, { gitStaged: e.target.checked })}
                                    />
                                    Staged (vs unstaged)
                                </label>
                            </div>
                        )}
                        {((impliedGitOperation ?? nodeData.gitOperation) === 'push' || (impliedGitOperation ?? nodeData.gitOperation) === 'pull') && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label" htmlFor="git-remote">Remote</label>
                                <input
                                    id="git-remote"
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.gitRemote ?? 'origin'}
                                    placeholder="origin"
                                    onChange={(e) => updateNodeData(nodeId, { gitRemote: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isDatabaseNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Database Operation</div>
                        {impliedDatabaseOperation ? (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <div className="workflow-property-implied">Action: {impliedDatabaseOperation}</div>
                            </div>
                        ) : (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Operation</label>
                                <select
                                    className="workflow-property-field-input"
                                    value={nodeData.databaseOperation ?? 'query'}
                                    onChange={(e) => updateNodeData(nodeId, { databaseOperation: e.target.value as WorkflowNodeData['databaseOperation'] })}
                                >
                                    <option value="query">Query (auto-detect)</option>
                                    <option value="select">Select</option>
                                    <option value="insert">Insert</option>
                                    <option value="update">Update</option>
                                    <option value="delete">Delete</option>
                                    <option value="create-table">Create Table</option>
                                    <option value="drop-table">Drop Table</option>
                                </select>
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="db-path">Database Path</label>
                            <input
                                id="db-path"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.databasePath ?? ''}
                                placeholder=":memory: or /path/to/database.db"
                                onChange={(e) => updateNodeData(nodeId, { databasePath: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="db-sql">SQL</label>
                            <textarea
                                id="db-sql"
                                className="workflow-property-field-input"
                                rows={4}
                                value={nodeData.databaseSql ?? ''}
                                placeholder="SELECT * FROM table WHERE id = ?&#10;Supports {{variables.x}}"
                                style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                                onChange={(e) => updateNodeData(nodeId, { databaseSql: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="db-params">
                                Params
                                <span className="workflow-property-field-type">JSON array</span>
                            </label>
                            <input
                                id="db-params"
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.databaseParams ?? '[]'}
                                placeholder='[42, "value"]'
                                onChange={(e) => updateNodeData(nodeId, { databaseParams: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isFormatNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Format</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Operation</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.formatOperation ?? 'template'}
                                onChange={(e) => updateNodeData(nodeId, { formatOperation: e.target.value as 'template' | 'join' | 'split' | 'uppercase' | 'lowercase' | 'trim' })}
                            >
                                <option value="template">Template (interpolate)</option>
                                <option value="join">Join (array → string)</option>
                                <option value="split">Split (string → array)</option>
                                <option value="uppercase">Uppercase</option>
                                <option value="lowercase">Lowercase</option>
                                <option value="trim">Trim</option>
                            </select>
                        </div>
                        {(nodeData.formatOperation ?? 'template') === 'template' && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Template</label>
                                <textarea
                                    className="workflow-property-field-textarea"
                                    rows={3}
                                    value={nodeData.formatTemplate ?? ''}
                                    placeholder={'Hello {{steps.prev.output.name}}!'}
                                    onChange={(e) => updateNodeData(nodeId, { formatTemplate: e.target.value })}
                                    spellCheck={false}
                                />
                            </div>
                        )}
                        {((nodeData.formatOperation === 'join') || (nodeData.formatOperation === 'split')) && (
                            <div className="workflow-property-field">
                                <label className="workflow-property-field-label">Separator</label>
                                <input
                                    className="workflow-property-field-input"
                                    type="text"
                                    value={nodeData.formatSeparator ?? ','}
                                    placeholder=","
                                    onChange={(e) => updateNodeData(nodeId, { formatSeparator: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Input</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.formatInput ?? ''}
                                placeholder={'{{steps.prev.output}}'}
                                onChange={(e) => updateNodeData(nodeId, { formatInput: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isValidateNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Validate</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Schema</label>
                            <div className="workflow-property-field-hint">
                                JSON schema to validate against.
                            </div>
                            <textarea
                                className="workflow-property-field-textarea"
                                rows={5}
                                value={nodeData.validateSchema ?? ''}
                                placeholder={'{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}'}
                                onChange={(e) => updateNodeData(nodeId, { validateSchema: e.target.value })}
                                spellCheck={false}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Input</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.validateInput ?? ''}
                                placeholder={'{{steps.prev.output}}'}
                                onChange={(e) => updateNodeData(nodeId, { validateInput: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isParseNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Parse</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Format</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.parseFormat ?? 'json'}
                                onChange={(e) => updateNodeData(nodeId, { parseFormat: e.target.value as 'json' | 'csv' | 'lines' | 'key-value' })}
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                                <option value="lines">Lines (split by newline)</option>
                                <option value="key-value">Key=Value pairs</option>
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Input</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.parseInput ?? ''}
                                placeholder={'{{steps.prev.output}}'}
                                onChange={(e) => updateNodeData(nodeId, { parseInput: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isDiffNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Diff</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Mode</label>
                            <select
                                className="workflow-property-field-input"
                                value={nodeData.diffMode ?? 'text'}
                                onChange={(e) => updateNodeData(nodeId, { diffMode: e.target.value as 'text' | 'json' | 'lines' })}
                            >
                                <option value="text">Text (character diff)</option>
                                <option value="json">JSON (structural diff)</option>
                                <option value="lines">Lines (line-by-line)</option>
                            </select>
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Input A</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.diffInputA ?? ''}
                                placeholder={'{{steps.before.output}}'}
                                onChange={(e) => updateNodeData(nodeId, { diffInputA: e.target.value })}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Input B</label>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.diffInputB ?? ''}
                                placeholder={'{{steps.after.output}}'}
                                onChange={(e) => updateNodeData(nodeId, { diffInputB: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isReadEnvNode && (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Read Environment</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label">Env Key</label>
                            <div className="workflow-property-field-hint">
                                Name of the environment variable from your <code>.env</code> file.
                            </div>
                            <input
                                className="workflow-property-field-input"
                                type="text"
                                value={nodeData.envKey ?? ''}
                                placeholder="MY_API_KEY"
                                onChange={(e) => updateNodeData(nodeId, { envKey: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {isToolNode && Object.keys(properties).length > 0 ? (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Inputs</div>
                        {Object.entries(properties).map(([name, prop]) => (
                            <InputField
                                key={name}
                                name={name}
                                schema={prop}
                                value={String(inputs[name] ?? '')}
                                onChange={handleInputChange}
                            />
                        ))}
                    </div>
                ) : isToolNode ? (
                    <div className="workflow-property-fields">
                        <div className="workflow-property-section-title">Inputs (JSON)</div>
                        <RawJsonTextarea nodeId={nodeId} inputs={inputs} />
                    </div>
                ) : !isConditionNode && !isTransformNode && !isDelayNode && !isHttpNode && !isLoopNode && !isTerminalNode && !isEditorNode && !isChatNode && !isSubworkflowNode && !isMemoryReadNode && !isMemoryWriteNode && !isVariableNode && !isRaceNode && !isBrowserNode && !isSpaceNode && !isMergeNode && !isFileNode && !isNotifyNode && !isGitNode && !isDatabaseNode && !isFormatNode && !isValidateNode && !isParseNode && !isDiffNode && !isReadEnvNode ? (
                    <div className="workflow-property-empty">
                        {nodeData.label} node — no configuration needed.
                    </div>
                ) : null}

                {stepResult && (
                    <NodeOutputInspector result={stepResult} />
                )}

                {showRetryTimeout && (
                    <div className="workflow-property-fields" style={{ marginTop: '12px' }}>
                        <div className="workflow-property-section-title">Retry &amp; Timeout</div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="retry-count">
                                Retry count
                                <span className="workflow-property-field-type">0 = no retry</span>
                            </label>
                            <input
                                id="retry-count"
                                className="workflow-property-field-input"
                                type="number"
                                min={0}
                                max={10}
                                value={nodeData.retryCount ?? 0}
                                onChange={(e) => handleNumericChange('retryCount', e.target.value)}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="retry-delay">
                                Retry delay (ms)
                            </label>
                            <input
                                id="retry-delay"
                                className="workflow-property-field-input"
                                type="number"
                                min={0}
                                step={500}
                                value={nodeData.retryDelayMs ?? 1000}
                                onChange={(e) => handleNumericChange('retryDelayMs', e.target.value)}
                            />
                        </div>
                        <div className="workflow-property-field">
                            <label className="workflow-property-field-label" htmlFor="timeout-ms">
                                Timeout (ms)
                                <span className="workflow-property-field-type">0 = no timeout</span>
                            </label>
                            <input
                                id="timeout-ms"
                                className="workflow-property-field-input"
                                type="number"
                                min={0}
                                step={1000}
                                value={nodeData.timeoutMs ?? 0}
                                onChange={(e) => handleNumericChange('timeoutMs', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {showContinueOnError && (
                    <div className="workflow-property-field" style={{ marginTop: '12px' }}>
                        <label className="workflow-property-continue-error">
                            <input
                                type="checkbox"
                                checked={nodeData.continueOnError ?? false}
                                onChange={handleContinueOnErrorChange}
                            />
                            Continue on error
                        </label>
                    </div>
                )}

                <div className="workflow-property-hint">
                    Use <code>{'{{steps.nodeId.output.field}}'}</code> to reference other nodes.
                </div>
            </div>
        </div>
    );
}

interface SchemaProperty {
    type?: string;
    description?: string;
    default?: unknown;
}

function InputField({ name, schema, value, onChange }: {
    name: string;
    schema: SchemaProperty;
    value: string;
    onChange: (name: string, value: string) => void;
}) {
    return (
        <div className="workflow-property-field">
            <label className="workflow-property-field-label" htmlFor={`input-${name}`}>
                {name}
                {schema.type && <span className="workflow-property-field-type">{schema.type}</span>}
            </label>
            {schema.description && (
                <div className="workflow-property-field-hint">{schema.description}</div>
            )}
            <input
                id={`input-${name}`}
                className="workflow-property-field-input"
                type="text"
                value={value}
                placeholder={schema.default !== undefined ? String(schema.default) : `Enter ${name}...`}
                onChange={(e) => onChange(name, e.target.value)}
            />
        </div>
    );
}

function RawJsonTextarea({ nodeId, inputs }: { nodeId: string; inputs: Record<string, unknown> }) {
    const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
    const [rawJson, setRawJson] = useState(() => JSON.stringify(inputs, null, 2));
    const [isValid, setIsValid] = useState(true);

    // Sync from store when nodeId changes
    useEffect(() => {
        setRawJson(JSON.stringify(inputs, null, 2));
        setIsValid(true);
    }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setRawJson(text);
        try {
            const parsed = JSON.parse(text);
            setIsValid(true);
            updateNodeData(nodeId, { inputs: parsed });
        } catch {
            setIsValid(false);
        }
    }, [nodeId, updateNodeData]);

    return (
        <textarea
            className={`workflow-property-field-textarea${isValid ? '' : ' invalid'}`}
            value={rawJson}
            onChange={handleChange}
            rows={6}
            placeholder='{"key": "value"}'
            spellCheck={false}
        />
    );
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '[Unable to display — circular reference]';
    }
}

function NodeOutputInspector({ result }: { result: StepResult }) {
    const duration = result.endTime - result.startTime;

    return (
        <div className="workflow-property-output">
            <div className="workflow-property-section-title">Output</div>
            <div className="workflow-property-output-meta">
                <span className={`workflow-property-output-status status-${result.status}`}>
                    {result.status === 'success' ? (
                        <CheckCircle size={12} />
                    ) : result.status === 'error' ? (
                        <XCircle size={12} />
                    ) : null}
                    {result.status}
                </span>
                <span className="workflow-property-output-duration">
                    <Clock size={12} />
                    {duration}ms
                </span>
            </div>

            {result.error && (
                <div className="workflow-property-output-error">
                    {result.error}
                </div>
            )}

            {result.output !== null && result.output !== undefined && (
                <pre className="workflow-property-output-json">
                    <code>{safeStringify(result.output)}</code>
                </pre>
            )}
        </div>
    );
}
