import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

export async function executeGitNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        gitOperation = 'status',
        gitMessage = '',
        gitBranch = '',
        gitRemote = 'origin',
        gitWorkingDir = '',
        gitFiles = '.',
        gitStaged = false,
    } = node.data;

    const cwd = String(resolveValue(gitWorkingDir || '.', context));
    const message = String(resolveValue(gitMessage, context));
    const branch = String(resolveValue(gitBranch, context));
    const files = String(resolveValue(gitFiles, context));

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Git [${gitOperation}] in "${cwd}"`);
        return { operation: gitOperation, cwd, dryRun: true };
    }

    context.logs.push(`Git [${gitOperation}] in "${cwd}"`);

    switch (gitOperation) {
        case 'status':
            return dependencies.callTool('git:status', { cwd });
        case 'diff':
            return dependencies.callTool('git:diff', { cwd, staged: gitStaged });
        case 'add':
            return dependencies.callTool('git:add', { cwd, files });
        case 'commit':
            if (!message.trim()) throw new Error('Git commit requires a message');
            return dependencies.callTool('git:commit', { cwd, message });
        case 'push':
            return dependencies.callTool('git:push', { cwd, remote: gitRemote, branch: branch || undefined });
        case 'pull':
            return dependencies.callTool('git:pull', { cwd, remote: gitRemote, branch: branch || undefined });
        case 'checkout':
            if (!branch.trim()) throw new Error('Git checkout requires a branch name');
            return dependencies.callTool('git:checkout', { cwd, branch });
        case 'branch':
            return dependencies.callTool('git:branch', { cwd, name: branch || undefined });
        case 'log':
            return dependencies.callTool('git:log', { cwd });
        case 'stash':
            return dependencies.callTool('git:stash', { cwd, message: message || undefined });
        default:
            throw new Error(`Git node: unknown operation "${gitOperation}"`);
    }
}
