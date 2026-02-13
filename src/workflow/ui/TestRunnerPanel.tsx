import { useCallback, useState } from 'react';
import { Plus, Play, Trash2, ChevronRight, ChevronDown, Check, X, Circle, FlaskConical } from 'lucide-react';
import { useWorkflowStore } from '../store';
import type { WorkflowTestCase, WorkflowAssertion, WorkflowTestResult, AssertionResult } from '../engine/WorkflowTestRunner';
import './TestRunnerPanel.css';

// --- Assertion Type Display ---

const ASSERTION_TYPE_LABELS: Record<WorkflowAssertion['type'], string> = {
    'node-status': 'Node Status',
    'node-output': 'Node Output',
    'variable-equals': 'Variable Equals',
    'log-contains': 'Log Contains',
    'execution-status': 'Execution Status',
};

// --- New Test Case Form ---

interface NewAssertionFormState {
    type: WorkflowAssertion['type'];
    nodeId: string;
    expectedStatus: string;
    expectedOutput: string;
    outputPath: string;
    variableName: string;
    expectedValue: string;
    logPattern: string;
    expectedExecutionStatus: string;
}

const EMPTY_ASSERTION: NewAssertionFormState = {
    type: 'execution-status',
    nodeId: '',
    expectedStatus: 'success',
    expectedOutput: '',
    outputPath: '',
    variableName: '',
    expectedValue: '',
    logPattern: '',
    expectedExecutionStatus: 'success',
};

function buildAssertion(form: NewAssertionFormState): WorkflowAssertion | null {
    const base: WorkflowAssertion = { type: form.type };

    switch (form.type) {
        case 'node-status':
            if (!form.nodeId) return null;
            base.nodeId = form.nodeId;
            base.expectedStatus = form.expectedStatus as 'success' | 'error' | 'skipped';
            break;
        case 'node-output':
            if (!form.nodeId) return null;
            base.nodeId = form.nodeId;
            base.outputPath = form.outputPath || undefined;
            try {
                base.expectedOutput = form.expectedOutput ? JSON.parse(form.expectedOutput) : undefined;
            } catch {
                base.expectedOutput = form.expectedOutput;
            }
            break;
        case 'variable-equals':
            if (!form.variableName) return null;
            base.variableName = form.variableName;
            try {
                base.expectedValue = form.expectedValue ? JSON.parse(form.expectedValue) : undefined;
            } catch {
                base.expectedValue = form.expectedValue;
            }
            break;
        case 'log-contains':
            if (!form.logPattern) return null;
            base.logPattern = form.logPattern;
            break;
        case 'execution-status':
            base.expectedExecutionStatus = form.expectedExecutionStatus as 'success' | 'error' | 'aborted';
            break;
    }

    return base;
}

function AddTestCaseForm({ onAdd, onCancel }: {
    onAdd: (tc: WorkflowTestCase) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [variables, setVariables] = useState('');
    const [mockTools, setMockTools] = useState('');
    const [mockEnv, setMockEnv] = useState('');
    const [assertions, setAssertions] = useState<WorkflowAssertion[]>([]);
    const [assertionForm, setAssertionForm] = useState<NewAssertionFormState>(EMPTY_ASSERTION);

    const nodes = useWorkflowStore((s) => s.nodes);

    const handleAddAssertion = useCallback(() => {
        const assertion = buildAssertion(assertionForm);
        if (assertion) {
            setAssertions((prev) => [...prev, assertion]);
            setAssertionForm(EMPTY_ASSERTION);
        }
    }, [assertionForm]);

    const handleRemoveAssertion = useCallback((index: number) => {
        setAssertions((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSubmit = useCallback(() => {
        if (!name.trim() || assertions.length === 0) return;

        let parsedVars: Record<string, unknown> | undefined;
        let parsedMockTools: Record<string, unknown> | undefined;
        let parsedMockEnv: Record<string, string> | undefined;

        try { parsedVars = variables.trim() ? JSON.parse(variables) : undefined; } catch { /* ignore */ }
        try { parsedMockTools = mockTools.trim() ? JSON.parse(mockTools) : undefined; } catch { /* ignore */ }
        try { parsedMockEnv = mockEnv.trim() ? JSON.parse(mockEnv) : undefined; } catch { /* ignore */ }

        onAdd({
            name: name.trim(),
            description: description.trim() || undefined,
            variables: parsedVars,
            mockTools: parsedMockTools,
            mockEnv: parsedMockEnv,
            assertions,
        });
    }, [name, description, variables, mockTools, mockEnv, assertions, onAdd]);

    return (
        <div className="test-runner-form">
            <div className="test-runner-form-group">
                <label className="test-runner-form-label">Test Name *</label>
                <input
                    className="test-runner-form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Happy path test"
                />
            </div>

            <div className="test-runner-form-group">
                <label className="test-runner-form-label">Description</label>
                <input
                    className="test-runner-form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                />
            </div>

            <div className="test-runner-form-group">
                <label className="test-runner-form-label">Variables (JSON)</label>
                <textarea
                    className="test-runner-form-textarea"
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={2}
                />
            </div>

            <div className="test-runner-form-group">
                <label className="test-runner-form-label">Mock Tools (JSON: toolName -&gt; response)</label>
                <textarea
                    className="test-runner-form-textarea"
                    value={mockTools}
                    onChange={(e) => setMockTools(e.target.value)}
                    placeholder='{"fs:readFile": {"content": "hello"}}'
                    rows={2}
                />
            </div>

            <div className="test-runner-form-group">
                <label className="test-runner-form-label">Mock Env Vars (JSON)</label>
                <textarea
                    className="test-runner-form-textarea"
                    value={mockEnv}
                    onChange={(e) => setMockEnv(e.target.value)}
                    placeholder='{"API_KEY": "test-key"}'
                    rows={2}
                />
            </div>

            {/* Assertions section */}
            <div className="test-runner-assertion-builder">
                <div className="test-runner-assertion-builder-title">
                    <span>Assertions ({assertions.length})</span>
                </div>

                {assertions.map((a, i) => (
                    <div key={i} className="test-runner-assertion-entry">
                        <div className="test-runner-assertion-entry-header">
                            <span className="test-runner-assertion-entry-type">
                                {ASSERTION_TYPE_LABELS[a.type]}
                            </span>
                            <button
                                className="test-runner-icon-btn danger"
                                onClick={() => handleRemoveAssertion(i)}
                                title="Remove assertion"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <span style={{ fontSize: 10, color: '#8b949e' }}>
                            {formatAssertionSummary(a)}
                        </span>
                    </div>
                ))}

                {/* Add assertion mini-form */}
                <div className="test-runner-section-title">Add Assertion</div>
                <div className="test-runner-form-group">
                    <label className="test-runner-form-label">Type</label>
                    <select
                        className="test-runner-form-select"
                        value={assertionForm.type}
                        onChange={(e) => setAssertionForm({ ...assertionForm, type: e.target.value as WorkflowAssertion['type'] })}
                    >
                        <option value="execution-status">Execution Status</option>
                        <option value="node-status">Node Status</option>
                        <option value="node-output">Node Output</option>
                        <option value="variable-equals">Variable Equals</option>
                        <option value="log-contains">Log Contains</option>
                    </select>
                </div>

                {(assertionForm.type === 'node-status' || assertionForm.type === 'node-output') && (
                    <div className="test-runner-form-group">
                        <label className="test-runner-form-label">Node</label>
                        <select
                            className="test-runner-form-select"
                            value={assertionForm.nodeId}
                            onChange={(e) => setAssertionForm({ ...assertionForm, nodeId: e.target.value })}
                        >
                            <option value="">-- Select node --</option>
                            {nodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                    {n.data.label || n.id} ({n.type})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {assertionForm.type === 'node-status' && (
                    <div className="test-runner-form-group">
                        <label className="test-runner-form-label">Expected Status</label>
                        <select
                            className="test-runner-form-select"
                            value={assertionForm.expectedStatus}
                            onChange={(e) => setAssertionForm({ ...assertionForm, expectedStatus: e.target.value })}
                        >
                            <option value="success">success</option>
                            <option value="error">error</option>
                            <option value="skipped">skipped</option>
                        </select>
                    </div>
                )}

                {assertionForm.type === 'node-output' && (
                    <>
                        <div className="test-runner-form-group">
                            <label className="test-runner-form-label">Output Path (optional, e.g. result.count)</label>
                            <input
                                className="test-runner-form-input"
                                value={assertionForm.outputPath}
                                onChange={(e) => setAssertionForm({ ...assertionForm, outputPath: e.target.value })}
                                placeholder="e.g. result.data"
                            />
                        </div>
                        <div className="test-runner-form-group">
                            <label className="test-runner-form-label">Expected Output (JSON or string)</label>
                            <textarea
                                className="test-runner-form-textarea"
                                value={assertionForm.expectedOutput}
                                onChange={(e) => setAssertionForm({ ...assertionForm, expectedOutput: e.target.value })}
                                placeholder='"hello" or {"key": "value"}'
                                rows={2}
                            />
                        </div>
                    </>
                )}

                {assertionForm.type === 'variable-equals' && (
                    <>
                        <div className="test-runner-form-group">
                            <label className="test-runner-form-label">Variable Name</label>
                            <input
                                className="test-runner-form-input"
                                value={assertionForm.variableName}
                                onChange={(e) => setAssertionForm({ ...assertionForm, variableName: e.target.value })}
                                placeholder="e.g. counter"
                            />
                        </div>
                        <div className="test-runner-form-group">
                            <label className="test-runner-form-label">Expected Value (JSON or string)</label>
                            <textarea
                                className="test-runner-form-textarea"
                                value={assertionForm.expectedValue}
                                onChange={(e) => setAssertionForm({ ...assertionForm, expectedValue: e.target.value })}
                                placeholder='42 or "hello"'
                                rows={2}
                            />
                        </div>
                    </>
                )}

                {assertionForm.type === 'log-contains' && (
                    <div className="test-runner-form-group">
                        <label className="test-runner-form-label">Log Pattern</label>
                        <input
                            className="test-runner-form-input"
                            value={assertionForm.logPattern}
                            onChange={(e) => setAssertionForm({ ...assertionForm, logPattern: e.target.value })}
                            placeholder="Text to search in logs..."
                        />
                    </div>
                )}

                {assertionForm.type === 'execution-status' && (
                    <div className="test-runner-form-group">
                        <label className="test-runner-form-label">Expected Execution Status</label>
                        <select
                            className="test-runner-form-select"
                            value={assertionForm.expectedExecutionStatus}
                            onChange={(e) => setAssertionForm({ ...assertionForm, expectedExecutionStatus: e.target.value })}
                        >
                            <option value="success">success</option>
                            <option value="error">error</option>
                            <option value="aborted">aborted</option>
                        </select>
                    </div>
                )}

                <button
                    className="test-runner-form-btn"
                    onClick={handleAddAssertion}
                    style={{ marginTop: 4 }}
                >
                    <Plus size={12} /> Add Assertion
                </button>
            </div>

            <div className="test-runner-form-actions">
                <button className="test-runner-form-btn" onClick={onCancel}>
                    Cancel
                </button>
                <button
                    className="test-runner-form-btn primary"
                    onClick={handleSubmit}
                    disabled={!name.trim() || assertions.length === 0}
                >
                    Save Test
                </button>
            </div>
        </div>
    );
}

// --- Assertion Summary ---

function formatAssertionSummary(a: WorkflowAssertion): string {
    switch (a.type) {
        case 'node-status':
            return `${a.nodeId} should be ${a.expectedStatus}`;
        case 'node-output':
            return `${a.nodeId}${a.outputPath ? '.' + a.outputPath : ''} == ${formatVal(a.expectedOutput)}`;
        case 'variable-equals':
            return `$${a.variableName} == ${formatVal(a.expectedValue)}`;
        case 'log-contains':
            return `logs contain "${a.logPattern}"`;
        case 'execution-status':
            return `execution status == ${a.expectedExecutionStatus}`;
        default:
            return a.type;
    }
}

function formatVal(v: unknown): string {
    try { return JSON.stringify(v); } catch { return String(v); }
}

// --- Test Case Card ---

function TestCaseCard({ testCase, result, index, onRemove }: {
    testCase: WorkflowTestCase;
    result?: WorkflowTestResult;
    index: number;
    onRemove: (index: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const status = result ? (result.passed ? 'passed' : 'failed') : 'pending';

    return (
        <div className={`test-runner-case ${status}`}>
            <div
                className="test-runner-case-header"
                onClick={() => setExpanded(!expanded)}
            >
                <span className={`test-runner-case-indicator ${status}`} />
                {expanded ? <ChevronDown size={12} color="#8b949e" /> : <ChevronRight size={12} color="#8b949e" />}
                <span className="test-runner-case-name">{testCase.name}</span>
                {result && (
                    <span className="test-runner-case-duration">{result.durationMs}ms</span>
                )}
                <div className="test-runner-case-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                        className="test-runner-icon-btn danger"
                        onClick={() => onRemove(index)}
                        title="Remove test case"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
            {expanded && (
                <div className="test-runner-case-details">
                    {testCase.description && (
                        <div className="test-runner-case-description">{testCase.description}</div>
                    )}
                    {result ? (
                        result.assertions.map((ar, i) => (
                            <AssertionResultRow key={i} result={ar} />
                        ))
                    ) : (
                        testCase.assertions.map((a, i) => (
                            <div key={i} className="test-runner-assertion">
                                <span className="test-runner-assertion-icon pending">
                                    <Circle size={12} />
                                </span>
                                <span className="test-runner-assertion-message">
                                    {formatAssertionSummary(a)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function AssertionResultRow({ result }: { result: AssertionResult }) {
    return (
        <div className="test-runner-assertion">
            <span className={`test-runner-assertion-icon ${result.passed ? 'passed' : 'failed'}`}>
                {result.passed ? <Check size={12} /> : <X size={12} />}
            </span>
            <span className={`test-runner-assertion-message ${result.passed ? '' : 'failed'}`}>
                {result.message}
            </span>
        </div>
    );
}

// --- Main Panel ---

export function TestRunnerPanel() {
    const testCases = useWorkflowStore((s) => s.testCases);
    const testResults = useWorkflowStore((s) => s.testResults);
    const isRunningTests = useWorkflowStore((s) => s.isRunningTests);
    const addTestCase = useWorkflowStore((s) => s.addTestCase);
    const removeTestCase = useWorkflowStore((s) => s.removeTestCase);
    const runTests = useWorkflowStore((s) => s.runTests);
    const setTestRunnerOpen = useWorkflowStore((s) => s.setTestRunnerOpen);

    const [showAddForm, setShowAddForm] = useState(false);

    const handleAdd = useCallback((tc: WorkflowTestCase) => {
        addTestCase(tc);
        setShowAddForm(false);
    }, [addTestCase]);

    const handleRunAll = useCallback(() => {
        runTests();
    }, [runTests]);

    // Compute summary stats
    const totalTests = testCases.length;
    const passedTests = testResults.filter((r) => r.passed).length;
    const failedTests = testResults.filter((r) => !r.passed).length;
    const totalDuration = testResults.reduce((sum, r) => sum + r.durationMs, 0);

    return (
        <div className="test-runner-panel">
            <div className="test-runner-header">
                <div className="test-runner-header-title">
                    <FlaskConical size={14} />
                    Test Runner
                </div>
                <div className="test-runner-header-actions">
                    <button
                        className="test-runner-icon-btn"
                        onClick={() => setShowAddForm(!showAddForm)}
                        title="Add test case"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        className="test-runner-run-btn"
                        onClick={handleRunAll}
                        disabled={isRunningTests || testCases.length === 0}
                        title="Run all tests"
                    >
                        <Play size={12} fill="currentColor" />
                        Run
                    </button>
                    <button
                        className="test-runner-icon-btn"
                        onClick={() => setTestRunnerOpen(false)}
                        title="Close panel"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {testResults.length > 0 && (
                <div className="test-runner-summary">
                    <span className="test-runner-summary-stat passed">
                        <Check size={12} /> {passedTests}
                    </span>
                    <span className="test-runner-summary-stat failed">
                        <X size={12} /> {failedTests}
                    </span>
                    <span className="test-runner-summary-stat total">
                        / {totalTests} tests
                    </span>
                    <span className="test-runner-summary-duration">
                        {totalDuration}ms
                    </span>
                </div>
            )}

            <div className="test-runner-body">
                {testCases.length === 0 && !showAddForm && (
                    <div className="test-runner-empty">
                        No test cases yet.<br />
                        Click + to add a test case for this workflow.
                    </div>
                )}

                {testCases.map((tc, i) => {
                    const result = testResults.find((r) => r.testName === tc.name);
                    return (
                        <TestCaseCard
                            key={`${tc.name}-${i}`}
                            testCase={tc}
                            result={result}
                            index={i}
                            onRemove={removeTestCase}
                        />
                    );
                })}
            </div>

            {showAddForm && (
                <AddTestCaseForm
                    onAdd={handleAdd}
                    onCancel={() => setShowAddForm(false)}
                />
            )}
        </div>
    );
}
