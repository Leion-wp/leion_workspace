import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

export async function executeNotifyNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { notifyTitle = '', notifyBody = '', notifyIcon } = node.data;

    const title = String(resolveValue(notifyTitle || node.data.label || 'Leion', context));
    const body = String(resolveValue(notifyBody, context));

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Notify: "${title}" - ${body}`);
        return { notified: false, dryRun: true };
    }

    context.logs.push(`Notify: "${title}"`);
    await dependencies.callTool('notify', { title, body, icon: notifyIcon });
    return { notified: true, title, body };
}
