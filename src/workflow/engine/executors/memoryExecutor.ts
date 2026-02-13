import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';
import { workflowMemory } from '../../../services/workflowMemory';

// In-memory session storage (cleared on app restart, no persistence)
const sessionMemory = new Map<string, unknown>();

const GLOBAL_SCOPE_ID = '__global__';

/** Get the effective workflow ID to use for a given scope. */
function getScopeId(scope: 'workflow' | 'global' | 'session' | undefined, workflowId: string): string {
    if (scope === 'global') return GLOBAL_SCOPE_ID;
    return workflowId;
}

/** Read a value from the appropriate scope. */
async function scopedRead(scope: 'workflow' | 'global' | 'session' | undefined, workflowId: string, key: string): Promise<unknown> {
    if (scope === 'session') {
        return sessionMemory.get(key);
    }
    return workflowMemory.read(getScopeId(scope, workflowId), key);
}

/** Write a value to the appropriate scope. */
async function scopedWrite(scope: 'workflow' | 'global' | 'session' | undefined, workflowId: string, key: string, value: unknown): Promise<void> {
    if (scope === 'session') {
        sessionMemory.set(key, value);
        return;
    }
    await workflowMemory.write(getScopeId(scope, workflowId), key, value);
}

/** Delete a key from the appropriate scope. */
async function scopedDelete(scope: 'workflow' | 'global' | 'session' | undefined, workflowId: string, key: string): Promise<void> {
    if (scope === 'session') {
        sessionMemory.delete(key);
        return;
    }
    // Write undefined (or remove key by writing null) - use null as tombstone
    await workflowMemory.write(getScopeId(scope, workflowId), key, null);
}

/**
 * Variable node — sets a workflow-scoped in-run variable.
 * Unlike Remember/MemoryWrite, Variable writes directly to context.variables
 * and is accessible as {{variables.key}} without any file persistence.
 */
export async function executeVariableNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { memoryKey, memoryValue, memoryOperation = 'write' } = node.data;
    if (!memoryKey?.trim()) {
        throw new Error(`Variable node "${node.id}" has no key configured`);
    }

    switch (memoryOperation) {
        case 'delete': {
            delete context.variables[memoryKey];
            context.logs.push(`Variable: deleted [${memoryKey}]`);
            return { key: memoryKey, deleted: true };
        }
        case 'increment': {
            const current = typeof context.variables[memoryKey] === 'number'
                ? (context.variables[memoryKey] as number)
                : Number(context.variables[memoryKey]) || 0;
            const delta = memoryValue ? (Number(resolveValue(memoryValue, context)) || 1) : 1;
            context.variables[memoryKey] = current + delta;
            context.logs.push(`Variable: increment [${memoryKey}] = ${context.variables[memoryKey]}`);
            return { key: memoryKey, value: context.variables[memoryKey], incremented: true, delta };
        }
        default: {
            const resolved = resolveValue(memoryValue ?? '', context);
            context.variables[memoryKey] = resolved;
            context.logs.push(`Variable: [${memoryKey}] = ${JSON.stringify(resolved)}`);
            return { key: memoryKey, value: resolved, written: true };
        }
    }
}

export async function executeMemoryReadNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { memoryKey, memoryScope } = node.data;
    if (!memoryKey?.trim()) {
        throw new Error(`MemoryRead node "${node.id}" has no key configured`);
    }
    const value = await scopedRead(memoryScope, context.workflowId, memoryKey);
    context.logs.push(`MemoryRead [${memoryScope ?? 'workflow'}]: [${memoryKey}] = ${JSON.stringify(value)}`);
    return { key: memoryKey, value, scope: memoryScope ?? 'workflow' };
}

export async function executeMemoryWriteNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    _dependencies: ExecutorDependencies,
): Promise<unknown> {
    const { memoryKey, memoryValue, memoryOperation = 'write', memoryScope } = node.data;
    if (!memoryKey?.trim()) {
        throw new Error(`MemoryWrite node "${node.id}" has no key configured`);
    }

    switch (memoryOperation) {
        case 'write': {
            const resolved = resolveValue(memoryValue ?? '', context);
            await scopedWrite(memoryScope, context.workflowId, memoryKey, resolved);
            context.logs.push(`MemoryWrite [${memoryScope ?? 'workflow'}]: [${memoryKey}] = ${JSON.stringify(resolved)}`);
            return { key: memoryKey, value: resolved, written: true, scope: memoryScope ?? 'workflow' };
        }

        case 'append-array': {
            const existing = await scopedRead(memoryScope, context.workflowId, memoryKey);
            const arr = Array.isArray(existing) ? existing : [];
            const resolved = resolveValue(memoryValue ?? '', context);
            arr.push(resolved);
            await scopedWrite(memoryScope, context.workflowId, memoryKey, arr);
            context.logs.push(`MemoryWrite [${memoryScope ?? 'workflow'}]: append-array [${memoryKey}] now has ${arr.length} items`);
            return { key: memoryKey, value: arr, appended: true, scope: memoryScope ?? 'workflow' };
        }

        case 'append-string': {
            const existing = await scopedRead(memoryScope, context.workflowId, memoryKey);
            const str = existing != null ? String(existing) : '';
            const resolved = String(resolveValue(memoryValue ?? '', context));
            const newValue = str + resolved;
            await scopedWrite(memoryScope, context.workflowId, memoryKey, newValue);
            context.logs.push(`MemoryWrite [${memoryScope ?? 'workflow'}]: append-string [${memoryKey}] now ${newValue.length} chars`);
            return { key: memoryKey, value: newValue, appended: true, scope: memoryScope ?? 'workflow' };
        }

        case 'delete': {
            await scopedDelete(memoryScope, context.workflowId, memoryKey);
            context.logs.push(`MemoryWrite [${memoryScope ?? 'workflow'}]: deleted [${memoryKey}]`);
            return { key: memoryKey, deleted: true, scope: memoryScope ?? 'workflow' };
        }

        case 'increment': {
            const existing = await scopedRead(memoryScope, context.workflowId, memoryKey);
            const current = typeof existing === 'number' ? existing : Number(existing) || 0;
            const delta = memoryValue ? (Number(resolveValue(memoryValue, context)) || 1) : 1;
            const newValue = current + delta;
            await scopedWrite(memoryScope, context.workflowId, memoryKey, newValue);
            context.logs.push(`MemoryWrite [${memoryScope ?? 'workflow'}]: increment [${memoryKey}] = ${newValue}`);
            return { key: memoryKey, value: newValue, incremented: true, delta, scope: memoryScope ?? 'workflow' };
        }

        default:
            throw new Error(`MemoryWrite node "${node.id}": unknown operation "${memoryOperation}"`);
    }
}
