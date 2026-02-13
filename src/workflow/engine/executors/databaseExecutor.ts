import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

export async function executeDatabaseNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { databasePath = ':memory:', databaseSql = '', databaseParams = '[]' } = node.data;

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Database: ${databaseSql.slice(0, 50)}`);
        return { dryRun: true, sql: databaseSql };
    }

    const resolvedSql = String(resolveValue(databaseSql, context));
    const resolvedPath = String(resolveValue(databasePath, context));

    let params: unknown[] = [];
    try {
        params = JSON.parse(databaseParams);
    } catch {
        // use empty array
    }

    context.logs.push(`Database: executing on "${resolvedPath}"`);

    // Ensure connected
    await dependencies.callTool('db:connect', { path: resolvedPath });

    // Execute query
    const result = await dependencies.callTool('db:query', {
        path: resolvedPath,
        sql: resolvedSql,
        params,
    }) as { success: boolean; rows?: unknown[]; columns?: string[]; affected?: number; error?: string };

    if (!result.success) {
        throw new Error(`Database error: ${result.error}`);
    }

    return result;
}
