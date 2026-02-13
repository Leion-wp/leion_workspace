import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';
import { editorCommandService } from '../../../services/editorCommandService';

export interface EditorExecResult {
    content: string;
    filePath: string | null;
    operation: string;
    dryRun?: boolean;
}

export async function executeEditorNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<EditorExecResult> {
    const {
        editorPaneId,
        editorOperation = 'read',
        editorContent,
        editorFilePath,
        editorLine,
        editorSearchPattern,
        editorReplacement,
        editorUseRegex,
    } = node.data;

    if (!editorPaneId?.trim()) {
        throw new Error(`Editor node "${node.id}" has no target pane selected`);
    }

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Editor [${editorPaneId}]: ${editorOperation}`);
        return { content: '', filePath: null, operation: editorOperation, dryRun: true };
    }

    const paneId = editorPaneId;

    switch (editorOperation) {
        case 'read': {
            context.logs.push(`Editor [${paneId}]: reading content`);
            const state = editorCommandService.read(paneId);
            context.logs.push(`Editor: read ${state.content.length} chars from ${state.filePath ?? 'untitled'}`);
            return { content: state.content, filePath: state.filePath, operation: 'read' };
        }

        case 'write': {
            const rawContent = editorContent ?? '';
            const resolvedContent = String(resolveValue(rawContent, context));
            context.logs.push(`Editor [${paneId}]: write (${resolvedContent.length} chars)`);
            editorCommandService.write(paneId, resolvedContent);
            const state = editorCommandService.read(paneId);
            return { content: state.content, filePath: state.filePath, operation: 'write' };
        }

        case 'append': {
            const rawContent = editorContent ?? '';
            const resolvedContent = String(resolveValue(rawContent, context));
            context.logs.push(`Editor [${paneId}]: append (${resolvedContent.length} chars)`);
            editorCommandService.append(paneId, resolvedContent);
            const state = editorCommandService.read(paneId);
            return { content: state.content, filePath: state.filePath, operation: 'append' };
        }

        case 'open-file': {
            const resolvedFilePath = String(resolveValue(editorFilePath ?? '', context));
            if (!resolvedFilePath.trim()) {
                throw new Error(`Editor node "${node.id}": open-file requires editorFilePath`);
            }
            context.logs.push(`Editor [${paneId}]: opening file "${resolvedFilePath}"`);
            const content = await editorCommandService.openFile(paneId, resolvedFilePath);
            return { content, filePath: resolvedFilePath, operation: 'open-file' };
        }

        case 'save': {
            context.logs.push(`Editor [${paneId}]: saving`);
            await editorCommandService.save(paneId);
            const state = editorCommandService.read(paneId);
            return { content: state.content, filePath: state.filePath, operation: 'save' };
        }

        case 'goto-line': {
            const line = editorLine ?? 1;
            context.logs.push(`Editor [${paneId}]: going to line ${line}`);
            editorCommandService.sendCommand(paneId, { type: 'goto-line', line });
            const state = editorCommandService.read(paneId);
            return { content: state.content, filePath: state.filePath, operation: 'goto-line' };
        }

        case 'search-replace': {
            const pattern = String(resolveValue(editorSearchPattern ?? '', context));
            const replacement = String(resolveValue(editorReplacement ?? '', context));
            if (!pattern) {
                throw new Error(`Editor node "${node.id}": search-replace requires editorSearchPattern`);
            }
            context.logs.push(`Editor [${paneId}]: search-replace "${pattern}" → "${replacement}" regex=${editorUseRegex ?? false}`);
            const newContent = editorCommandService.searchReplace(paneId, pattern, replacement, editorUseRegex ?? false);
            const state = editorCommandService.read(paneId);
            return { content: newContent, filePath: state.filePath, operation: 'search-replace' };
        }

        case 'get-filepath': {
            context.logs.push(`Editor [${paneId}]: getting file path`);
            const state = editorCommandService.read(paneId);
            return { content: state.filePath ?? '', filePath: state.filePath, operation: 'get-filepath' };
        }

        case 'get-selection': {
            context.logs.push(`Editor [${paneId}]: getting selection`);
            editorCommandService.sendCommand(paneId, { type: 'get-selection' });
            // Selection is returned via the state; for now return current content as placeholder
            const state = editorCommandService.read(paneId);
            return { content: state.content, filePath: state.filePath, operation: 'get-selection' };
        }

        default:
            throw new Error(`Editor node "${node.id}": unknown operation "${editorOperation}"`);
    }
}
