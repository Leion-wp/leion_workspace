import type { Node, Edge } from 'reactflow';

// --- Node Types ---

export type WorkflowNodeType =
    // --- Existing compound node types (preserved for backwards compatibility) ---
    | 'start' | 'end' | 'tool' | 'condition' | 'merge' | 'comment' | 'transform' | 'delay' | 'http' | 'loop'
    | 'terminal' | 'editor' | 'chat' | 'subworkflow' | 'memory-read' | 'memory-write' | 'browser' | 'space' | 'file' | 'notify' | 'git'
    // --- Phase 1 primitive ACT nodes (chat-based) ---
    | 'ask' | 'new-chat' | 'set-model'
    // --- Phase 1 primitive ACT nodes (terminal-based) ---
    | 'run'
    // --- Phase 1 primitive ACT nodes (editor-based) ---
    | 'write-editor' | 'open-file' | 'save-file' | 'search-replace'
    // --- Phase 1 primitive ACT nodes (browser-based) ---
    | 'navigate' | 'click' | 'fill' | 'execute-js' | 'scroll'
    // --- Phase 1 primitive READ nodes ---
    | 'read-editor' | 'read-chat' | 'extract' | 'screenshot'
    // --- Phase 2 primitive READ nodes ---
    | 'read-terminal' | 'wait-pattern' | 'read-env'
    // --- Phase 1 primitive FLOW nodes ---
    | 'if' | 'switch' | 'race'
    // --- Phase 2 primitive FLOW nodes ---
    | 'repeat' | 'pause'
    // --- Phase 1 primitive MEMORY nodes ---
    | 'recall' | 'remember' | 'forget' | 'variable'
    // --- Phase 1 primitive FILE nodes ---
    | 'read-file' | 'write-file' | 'list-files'
    // --- Phase 1 primitive GIT nodes ---
    | 'git-status' | 'git-diff' | 'git-commit'
    // --- Phase 2 primitive ACT nodes ---
    | 'fetch' | 'send-input' | 'db-query' | 'db-insert'
    // --- Phase 2 primitive SHAPE nodes ---
    | 'format' | 'validate' | 'parse' | 'diff'
    // --- Database node ---
    | 'database';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface WorkflowNodeData {
    label: string;
    description?: string;
    toolName?: string;
    inputSchema?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
    conditionExpression?: string;
    transformCode?: string;
    delayMs?: number;
    httpUrl?: string;
    httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    httpHeaders?: string;
    httpBody?: string;
    loopCount?: number;
    loopItemsExpression?: string;
    loopBodyCode?: string;
    // Terminal node
    terminalPaneId?: string;
    terminalCommand?: string;
    // Editor node
    editorPaneId?: string;
    editorOperation?: 'read' | 'write' | 'append' | 'open-file' | 'save' | 'goto-line' | 'search-replace' | 'get-filepath' | 'get-selection';
    editorContent?: string;
    // Chat node
    chatPaneId?: string;
    chatPrompt?: string;
    chatProvider?: string;
    chatOutputSchema?: string;
    // Sub-workflow node
    subworkflowId?: string;
    subworkflowInputs?: Record<string, unknown>;
    // Memory nodes
    memoryKey?: string;
    memoryValue?: string;
    // Browser node
    browserPaneId?: string;
    browserUrl?: string;
    browserExtractSelector?: string;
    // Space node
    targetSpaceId?: string;
    // Resilience
    retryCount?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    continueOnError?: boolean;
    executionStatus?: ExecutionStatus;

    // --- Chat node extensions ---
    chatAction?: 'send-message' | 'new-conversation' | 'set-model' | 'select-project' | 'enable-developer-mode' | 'ephemeral-chat' | 'get-last-response';
    chatModel?: string;
    chatProject?: string;
    chatNewConversationFirst?: boolean;
    chatResponseTimeout?: number;

    // --- Terminal node extensions ---
    terminalAction?: 'run' | 'new-session' | 'send-input' | 'send-signal' | 'wait-for-pattern';
    terminalWorkingDir?: string;
    terminalEnvVars?: string;
    terminalCaptureStderr?: boolean;
    terminalSignal?: 'SIGTERM' | 'SIGKILL' | 'SIGINT';
    terminalWaitPattern?: string;
    terminalBackground?: boolean;
    terminalStdin?: string;

    // --- Editor node extensions ---
    editorFilePath?: string;
    editorLine?: number;
    editorSearchPattern?: string;
    editorReplacement?: string;
    editorUseRegex?: boolean;

    // --- Browser node extensions ---
    browserOperation?: 'navigate' | 'extract' | 'click' | 'fill' | 'wait-for' | 'screenshot' | 'execute-js' | 'scroll' | 'hover' | 'extract-table';
    browserFillValue?: string;
    browserWaitCondition?: 'element' | 'url-contains' | 'text-contains' | 'network-idle';
    browserWaitTimeout?: number;
    browserJsCode?: string;
    browserExtractMode?: 'text' | 'html' | 'attribute' | 'table' | 'list';
    browserExtractAttribute?: string;
    browserScrollDirection?: 'top' | 'bottom' | 'element';

    // --- Space node extensions ---
    spaceOperation?: 'switch' | 'create' | 'add-pane' | 'close-pane' | 'return-previous';
    spaceNewName?: string;
    spaceNewIcon?: string;
    spacePaneType?: string;
    spacePaneTarget?: string;

    // --- Memory node extensions ---
    memoryOperation?: 'write' | 'append-array' | 'append-string' | 'delete' | 'increment';
    memoryScope?: 'workflow' | 'global' | 'session';
    memoryTtl?: number;

    // --- Subworkflow extensions ---
    subworkflowOutputStep?: string;
    subworkflowTimeout?: number;

    // --- Condition node extensions ---
    conditionMode?: 'binary' | 'switch';
    conditionCases?: Array<{ expression: string; label: string }>;

    // --- Loop node extensions ---
    loopParallel?: boolean;
    loopConcurrency?: number;
    loopBreakCondition?: string;
    loopAccumulatorInit?: string;
    loopMaxIterations?: number;

    // --- HTTP node extensions ---
    httpAuthType?: 'none' | 'bearer' | 'basic' | 'api-key';
    httpAuthValue?: string;
    httpAuthHeader?: string;
    httpResponseType?: 'auto' | 'json' | 'text';
    httpFollowRedirects?: boolean;

    // --- Delay node extensions ---
    delayExpression?: string;
    delayJitter?: number;

    // --- Merge node extensions ---
    mergeStrategy?: 'all' | 'first-complete' | 'flatten' | 'concat-arrays';
    mergeSelectedInputs?: string[];

    // --- File node ---
    fileOperation?: 'read' | 'write' | 'append' | 'list' | 'move' | 'copy' | 'delete' | 'exists';
    filePath?: string;
    fileContent?: string;
    fileDestination?: string;
    fileGlob?: string;
    fileEncoding?: 'utf8' | 'base64' | 'binary';

    // --- Notify node ---
    notifyTitle?: string;
    notifyBody?: string;
    notifyIcon?: string;

    // --- Git node ---
    gitOperation?: 'status' | 'diff' | 'add' | 'commit' | 'push' | 'pull' | 'checkout' | 'branch' | 'log' | 'stash';
    gitMessage?: string;
    gitBranch?: string;
    gitRemote?: string;
    gitWorkingDir?: string;
    gitFiles?: string;
    gitStaged?: boolean;

    // --- Database node ---
    databaseOperation?: 'query' | 'select' | 'insert' | 'update' | 'delete' | 'create-table' | 'drop-table';
    databasePath?: string;
    databaseSql?: string;
    databaseParams?: string; // JSON array string

    // --- Format node (SHAPE) ---
    formatOperation?: 'template' | 'join' | 'split' | 'uppercase' | 'lowercase' | 'trim';
    formatTemplate?: string;
    formatSeparator?: string;
    formatInput?: string;

    // --- Validate node (SHAPE) ---
    validateSchema?: string;
    validateInput?: string;

    // --- Parse node (SHAPE) ---
    parseFormat?: 'json' | 'csv' | 'lines' | 'key-value';
    parseInput?: string;

    // --- Diff node (SHAPE) ---
    diffInputA?: string;
    diffInputB?: string;
    diffMode?: 'text' | 'json' | 'lines';

    // --- Read-env node ---
    envKey?: string;
}

// --- Trigger Types ---

export type TriggerType = 'filewatch' | 'terminal' | 'timer';

export interface FileWatchTrigger {
    type: 'filewatch';
    id: string;
    glob: string;
    cwd?: string;
    events: ('change' | 'add' | 'unlink')[];
    enabled: boolean;
}

export interface TerminalTrigger {
    type: 'terminal';
    id: string;
    terminalPaneId: string;
    pattern: string;
    enabled: boolean;
}

export interface TimerTrigger {
    type: 'timer';
    id: string;
    intervalMs: number;
    enabled: boolean;
}

export type WorkflowTrigger = FileWatchTrigger | TerminalTrigger | TimerTrigger;

// --- Workflow Definition (serializable) ---

export interface WorkflowDefinition {
    id: string;
    name: string;
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
    variables: Record<string, unknown>;
    triggers?: WorkflowTrigger[];
}

// --- Execution Runtime ---

export interface StepResult {
    nodeId: string;
    status: 'success' | 'error' | 'skipped';
    output: unknown;
    error?: string;
    startTime: number;
    endTime: number;
}

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    status: 'idle' | 'running' | 'success' | 'error' | 'aborted';
    stepResults: Record<string, StepResult>;
    variables: Record<string, unknown>;
    logs: string[];
    currentNodeId?: string;
    envVars?: Record<string, string>;
    paneStates?: Record<string, unknown>; // PaneAmbientState by paneId
}

// --- Engine Contracts ---

export interface WorkflowEngineCallbacks {
    onNodeStart: (nodeId: string) => void;
    onNodeComplete: (nodeId: string, result: StepResult) => void;
    onNodeError: (nodeId: string, error: string) => void;
    onExecutionComplete: (context: ExecutionContext) => void;
    onLog: (message: string) => void;
    onBreakpointHit?: (nodeId: string) => void;
    /** Called after each topological level completes during execution. */
    onLevelComplete?: (level: number, context: ExecutionContext) => void;
}

export type NodeExecutorFn = (
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
) => Promise<unknown>;

export interface ExecutorDependencies {
    callTool: (name: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
    getIncomingEdges?: (nodeId: string) => Edge[];
    dryRun?: boolean;
    dispatchPaneCommand?: (paneId: string, cmd: { type: string; payload: Record<string, unknown> }) => Promise<unknown>;
    envVars?: Record<string, string>;
    paneStates?: Record<string, unknown>;
    hasBreakpoint?: (nodeId: string) => boolean;
    waitForBreakpointContinue?: (nodeId: string) => Promise<void>;
}

// --- Factory Functions ---

export function createExecutionContext(workflowId: string): ExecutionContext {
    return {
        workflowId,
        executionId: `exec-${Date.now()}`,
        status: 'idle',
        stepResults: {},
        variables: {},
        logs: [],
    };
}

export function createWorkflowDefinition(
    id: string,
    name: string,
    nodes: Node<WorkflowNodeData>[],
    edges: Edge[],
    variables?: Record<string, unknown>,
): WorkflowDefinition {
    return { id, name, nodes, edges, variables: variables ?? {} };
}
