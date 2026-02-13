import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

export async function executeFileNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        fileOperation = 'read',
        filePath = '',
        fileContent = '',
        fileDestination = '',
        fileGlob = '**/*',
        fileEncoding = 'utf8',
    } = node.data;

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] File [${fileOperation}]: ${filePath}`);
        return { operation: fileOperation, path: filePath, dryRun: true };
    }

    const resolvedPath = String(resolveValue(filePath, context));
    const resolvedContent = String(resolveValue(fileContent, context));
    const resolvedDest = String(resolveValue(fileDestination, context));

    switch (fileOperation) {
        case 'read': {
            context.logs.push(`File: reading "${resolvedPath}"`);
            const result = await dependencies.callTool('fs:read', { path: resolvedPath, encoding: fileEncoding });
            return result;
        }
        case 'write': {
            context.logs.push(`File: writing "${resolvedPath}" (${resolvedContent.length} chars)`);
            await dependencies.callTool('fs:write', { path: resolvedPath, content: resolvedContent, encoding: fileEncoding });
            return { path: resolvedPath, written: resolvedContent.length };
        }
        case 'append': {
            context.logs.push(`File: appending to "${resolvedPath}"`);
            await dependencies.callTool('fs:append', { path: resolvedPath, content: resolvedContent, encoding: fileEncoding });
            return { path: resolvedPath, appended: resolvedContent.length };
        }
        case 'list': {
            context.logs.push(`File: listing "${resolvedPath}" with glob "${fileGlob}"`);
            const files = await dependencies.callTool('fs:list', { dir: resolvedPath, glob: fileGlob });
            return files;
        }
        case 'move': {
            context.logs.push(`File: moving "${resolvedPath}" -> "${resolvedDest}"`);
            await dependencies.callTool('fs:move', { src: resolvedPath, dest: resolvedDest });
            return { moved: true, from: resolvedPath, to: resolvedDest };
        }
        case 'copy': {
            context.logs.push(`File: copying "${resolvedPath}" -> "${resolvedDest}"`);
            await dependencies.callTool('fs:copy', { src: resolvedPath, dest: resolvedDest });
            return { copied: true, from: resolvedPath, to: resolvedDest };
        }
        case 'delete': {
            context.logs.push(`File: deleting "${resolvedPath}"`);
            await dependencies.callTool('fs:delete', { path: resolvedPath });
            return { deleted: true, path: resolvedPath };
        }
        case 'exists': {
            context.logs.push(`File: checking exists "${resolvedPath}"`);
            const result = await dependencies.callTool('fs:exists', { path: resolvedPath });
            return result;
        }
        default:
            throw new Error(`File node: unknown operation "${fileOperation}"`);
    }
}
