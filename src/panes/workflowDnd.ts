import type { WorkflowNodeData, WorkflowNodeType } from '../workflow/types';

export const WORKFLOW_DND_NODE_TYPE_MIME = 'application/x-leion-workflow-node-type';
export const WORKFLOW_DND_NODE_DATA_MIME = 'application/x-leion-workflow-node-data';

type WorkflowDragPayload = {
    type: WorkflowNodeType;
    data: WorkflowNodeData;
};

const WORKFLOW_NODE_TYPES: ReadonlySet<WorkflowNodeType> = new Set([
    // Existing compound node types
    'start', 'end', 'tool', 'condition', 'merge', 'comment', 'transform', 'delay', 'http', 'loop',
    'terminal', 'editor', 'chat', 'subworkflow', 'memory-read', 'memory-write', 'browser', 'space', 'file', 'notify', 'git',
    // Phase 1 primitive node types (ACT — chat-based)
    'ask', 'new-chat', 'set-model', 'read-chat',
    // Phase 1 primitive node types (ACT — terminal-based)
    'run',
    // Phase 1 primitive node types (ACT — editor-based)
    'write-editor', 'open-file', 'save-file', 'search-replace',
    // Phase 1 primitive node types (READ — editor-based)
    'read-editor',
    // Phase 1 primitive node types (ACT — browser-based)
    'navigate', 'click', 'fill', 'execute-js', 'scroll',
    // Phase 1 primitive node types (READ — browser-based)
    'extract', 'screenshot',
    // Phase 1 primitive node types (FLOW)
    'if', 'switch', 'race',
    // Phase 1 primitive node types (MEMORY)
    'recall', 'remember', 'forget', 'variable',
    // Phase 1 primitive node types (FILE)
    'read-file', 'write-file', 'list-files',
    // Phase 1 primitive node types (GIT)
    'git-status', 'git-diff', 'git-commit',
    // Database
    'database',
    // Phase 2 primitive node types (ACT)
    'fetch', 'send-input', 'db-query', 'db-insert',
    // Phase 2 primitive node types (READ)
    'read-terminal', 'wait-pattern', 'read-env',
    // Phase 2 primitive node types (FLOW)
    'repeat', 'pause',
    // Phase 2 primitive node types (SHAPE)
    'format', 'validate', 'parse', 'diff',
]);

export function isWorkflowNodeType(type: string): type is WorkflowNodeType {
    return WORKFLOW_NODE_TYPES.has(type as WorkflowNodeType);
}

export function normalizeWorkflowNodeData(data: Record<string, unknown> | null | undefined, fallbackLabel: string): WorkflowNodeData {
    const label = typeof data?.label === 'string' && data.label.trim().length > 0
        ? data.label
        : fallbackLabel;

    const description = typeof data?.description === 'string' ? data.description : undefined;
    const inputSchema = data?.inputSchema && typeof data.inputSchema === 'object'
        ? data.inputSchema as Record<string, unknown>
        : undefined;

    return { label, description, inputSchema };
}

export function toWorkflowDragPayload(type: WorkflowNodeType, data: WorkflowNodeData): string {
    return JSON.stringify({ type, data } satisfies WorkflowDragPayload);
}

export function parseWorkflowDragPayload(raw: string): WorkflowDragPayload | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<WorkflowDragPayload>;
        if (!parsed.type || typeof parsed.type !== 'string' || !isWorkflowNodeType(parsed.type)) return null;
        return {
            type: parsed.type,
            data: normalizeWorkflowNodeData(parsed.data as Record<string, unknown> | undefined, parsed.type),
        };
    } catch {
        return null;
    }
}
