import type { Node } from 'reactflow';
import type {
    WorkflowNodeType,
    WorkflowNodeData,
    NodeExecutorFn,
    ExecutionContext,
    ExecutorDependencies,
} from '../types';
import { resolveValue } from './DataMapper';
import { executeConditionNode } from './executors/conditionExecutor';
import { executeMergeNode } from './executors/mergeExecutor';
import { executeCommentNode } from './executors/commentExecutor';
import { executeTransformNode } from './executors/transformExecutor';
import { executeDelayNode } from './executors/delayExecutor';
import { executeHttpNode } from './executors/httpExecutor';
import { executeLoopNode } from './executors/loopExecutor';
import { executeTerminalNode } from './executors/terminalExecutor';
import { executeEditorNode } from './executors/editorExecutor';
import { executeChatNode } from './executors/chatExecutor';
import { executeSubworkflowNode } from './executors/subworkflowExecutor';
import { executeMemoryReadNode, executeMemoryWriteNode, executeVariableNode } from './executors/memoryExecutor';
import { executeRaceNode } from './executors/raceExecutor';
import { executeSpaceNode } from './executors/spaceExecutor';
import { executeBrowserNode } from './executors/browserNodeExecutor';
import { executeFileNode } from './executors/fileExecutor';
import { executeNotifyNode } from './executors/notifyExecutor';
import { executeGitNode } from './executors/gitExecutor';
import { executeDatabaseNode } from './executors/databaseExecutor';
import { executeFormatNode } from './executors/formatExecutor';
import { executeValidateNode } from './executors/validateExecutor';
import { executeParseNode } from './executors/parseExecutor';
import { executeDiffNode } from './executors/diffExecutor';

// --- Executor implementations ---

async function executeStartNode(
    _node: Node<WorkflowNodeData>,
    _context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    return { started: true, timestamp: Date.now() };
}

async function executeToolNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const toolName = node.data.toolName ?? node.data.label;

    if (!toolName) {
        throw new Error(`Tool node "${node.id}" is missing a tool name`);
    }

    const rawInputs = node.data.inputs ?? {};
    const resolvedInputs = resolveValue(rawInputs, context) as Record<string, unknown>;

    return dependencies.callTool(toolName, resolvedInputs);
}

async function executeEndNode(
    _node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    // Snapshot summary only — avoid circular reference
    const summary: Record<string, { status: string; error?: string }> = {};
    for (const [id, result] of Object.entries(context.stepResults)) {
        summary[id] = { status: result.status, error: result.error };
    }
    return { completed: true, nodeCount: Object.keys(summary).length, summary };
}

// --- Phase 1 primitive wrappers: ACT (chat-based) ---

async function executeAskNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, chatAction: 'send-message' as const } };
    return executeChatNode(patchedNode, context, dependencies);
}

async function executeNewChatNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, chatAction: 'new-conversation' as const } };
    return executeChatNode(patchedNode, context, dependencies);
}

async function executeSetModelNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, chatAction: 'set-model' as const } };
    return executeChatNode(patchedNode, context, dependencies);
}

async function executeReadChatNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, chatAction: 'get-last-response' as const } };
    return executeChatNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: ACT (terminal-based) ---

async function executeRunNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, terminalAction: 'run' as const } };
    return executeTerminalNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: ACT (editor-based) ---

async function executeWriteEditorNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, editorOperation: 'write' as const } };
    return executeEditorNode(patchedNode, context, dependencies);
}

async function executeOpenFileNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, editorOperation: 'open-file' as const } };
    return executeEditorNode(patchedNode, context, dependencies);
}

async function executeSaveFileNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, editorOperation: 'save' as const } };
    return executeEditorNode(patchedNode, context, dependencies);
}

async function executeSearchReplaceNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, editorOperation: 'search-replace' as const } };
    return executeEditorNode(patchedNode, context, dependencies);
}

async function executeReadEditorNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, editorOperation: 'read' as const } };
    return executeEditorNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: ACT (browser-based) ---

async function executeNavigateNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'navigate' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeClickNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'click' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeFillNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'fill' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeExecuteJsNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'execute-js' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeScrollNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'scroll' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeExtractNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'extract' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

async function executeScreenshotNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, browserOperation: 'screenshot' as const } };
    return executeBrowserNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: FLOW ---

async function executeIfNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, conditionMode: 'binary' as const } };
    return executeConditionNode(patchedNode, context, dependencies);
}

async function executeSwitchNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, conditionMode: 'switch' as const } };
    return executeConditionNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: MEMORY ---

async function executeRecallNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    return executeMemoryReadNode(node, context, dependencies);
}

async function executeRememberNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, memoryOperation: 'write' as const } };
    return executeMemoryWriteNode(patchedNode, context, dependencies);
}

async function executeForgetNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, memoryOperation: 'delete' as const } };
    return executeMemoryWriteNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: FILE ---

async function executeReadFileNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, fileOperation: 'read' as const } };
    return executeFileNode(patchedNode, context, dependencies);
}

async function executeWriteFileNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, fileOperation: 'write' as const } };
    return executeFileNode(patchedNode, context, dependencies);
}

async function executeListFilesNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, fileOperation: 'list' as const } };
    return executeFileNode(patchedNode, context, dependencies);
}

// --- Phase 1 primitive wrappers: GIT ---

async function executeGitStatusNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, gitOperation: 'status' as const } };
    return executeGitNode(patchedNode, context, dependencies);
}

async function executeGitDiffNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, gitOperation: 'diff' as const } };
    return executeGitNode(patchedNode, context, dependencies);
}

async function executeGitCommitNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, gitOperation: 'commit' as const } };
    return executeGitNode(patchedNode, context, dependencies);
}

// --- Phase 2 primitive wrappers: ACT (http-based) ---

async function executeFetchNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    return executeHttpNode(node, context, dependencies);
}

// --- Phase 2 primitive wrappers: ACT (terminal-based) ---

async function executeSendInputNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, terminalAction: 'send-input' as const } };
    return executeTerminalNode(patchedNode, context, dependencies);
}

// --- Phase 2 primitive wrappers: READ (terminal-based) ---

async function executeReadTerminalNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, terminalAction: 'wait-for-pattern' as const } };
    return executeTerminalNode(patchedNode, context, dependencies);
}

async function executeWaitPatternNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, terminalAction: 'wait-for-pattern' as const } };
    return executeTerminalNode(patchedNode, context, dependencies);
}

// --- Phase 2 primitive wrappers: READ (env) ---

async function executeReadEnvNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const key = node.data.envKey ?? '';
    if (!key.trim()) {
        throw new Error(`Read-env node "${node.id}": no envKey specified`);
    }

    const envVars = context.envVars ?? {};
    const value = envVars[key];

    context.logs.push(`Read-env: key="${key}" → ${value !== undefined ? 'found' : 'not found'}`);

    return { key, value: value ?? null, found: value !== undefined };
}

// --- Phase 2 primitive wrappers: ACT (database-based) ---

async function executeDbQueryNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, databaseOperation: 'query' as const } };
    return executeDatabaseNode(patchedNode, context, dependencies);
}

async function executeDbInsertNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const patchedNode = { ...node, data: { ...node.data, databaseOperation: 'insert' as const } };
    return executeDatabaseNode(patchedNode, context, dependencies);
}

// --- Phase 2 primitive wrappers: FLOW ---

async function executeRepeatNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    return executeLoopNode(node, context, dependencies);
}

async function executePauseNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    return executeDelayNode(node, context, dependencies);
}

// --- Strategy map ---

const EXECUTOR_MAP: Record<WorkflowNodeType, NodeExecutorFn> = {
    // Existing compound nodes
    start: executeStartNode,
    tool: executeToolNode,
    end: executeEndNode,
    condition: executeConditionNode,
    merge: executeMergeNode,
    comment: executeCommentNode,
    transform: executeTransformNode,
    delay: executeDelayNode,
    http: executeHttpNode,
    loop: executeLoopNode,
    terminal: executeTerminalNode,
    editor: executeEditorNode,
    chat: executeChatNode,
    subworkflow: executeSubworkflowNode,
    'memory-read': executeMemoryReadNode,
    'memory-write': executeMemoryWriteNode,
    space: executeSpaceNode,
    browser: executeBrowserNode,
    file: executeFileNode,
    notify: executeNotifyNode,
    git: executeGitNode,
    // Phase 1 primitives: ACT (chat-based)
    ask: executeAskNode,
    'new-chat': executeNewChatNode,
    'set-model': executeSetModelNode,
    'read-chat': executeReadChatNode,
    // Phase 1 primitives: ACT (terminal-based)
    run: executeRunNode,
    // Phase 1 primitives: ACT (editor-based)
    'write-editor': executeWriteEditorNode,
    'open-file': executeOpenFileNode,
    'save-file': executeSaveFileNode,
    'search-replace': executeSearchReplaceNode,
    // Phase 1 primitives: READ (editor-based)
    'read-editor': executeReadEditorNode,
    // Phase 1 primitives: ACT (browser-based)
    navigate: executeNavigateNode,
    click: executeClickNode,
    fill: executeFillNode,
    'execute-js': executeExecuteJsNode,
    scroll: executeScrollNode,
    // Phase 1 primitives: READ (browser-based)
    extract: executeExtractNode,
    screenshot: executeScreenshotNode,
    // Phase 1 primitives: FLOW
    if: executeIfNode,
    switch: executeSwitchNode,
    race: executeRaceNode,
    // Phase 1 primitives: MEMORY
    recall: executeRecallNode,
    remember: executeRememberNode,
    forget: executeForgetNode,
    variable: executeVariableNode,
    // Phase 1 primitives: FILE
    'read-file': executeReadFileNode,
    'write-file': executeWriteFileNode,
    'list-files': executeListFilesNode,
    // Phase 1 primitives: GIT
    'git-status': executeGitStatusNode,
    'git-diff': executeGitDiffNode,
    'git-commit': executeGitCommitNode,
    // Database
    database: executeDatabaseNode,
    // Phase 2 primitives: ACT (http-based)
    fetch: executeFetchNode,
    // Phase 2 primitives: ACT (terminal-based)
    'send-input': executeSendInputNode,
    // Phase 2 primitives: READ (terminal-based)
    'read-terminal': executeReadTerminalNode,
    'wait-pattern': executeWaitPatternNode,
    // Phase 2 primitives: READ (env)
    'read-env': executeReadEnvNode,
    // Phase 2 primitives: ACT (database-based)
    'db-query': executeDbQueryNode,
    'db-insert': executeDbInsertNode,
    // Phase 2 primitives: FLOW
    repeat: executeRepeatNode,
    pause: executePauseNode,
    // Phase 2 primitives: SHAPE
    format: executeFormatNode,
    validate: executeValidateNode,
    parse: executeParseNode,
    diff: executeDiffNode,
};

/**
 * Returns the executor function for a given node type.
 * Throws if the type is unknown.
 */
export function getNodeExecutor(type: string): NodeExecutorFn {
    const executor = EXECUTOR_MAP[type as WorkflowNodeType];
    if (!executor) {
        throw new Error(`Unknown node type: "${type}"`);
    }
    return executor;
}
