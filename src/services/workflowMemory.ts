const MEMORY_DIR_KEY = 'workflow-memory';

class WorkflowMemoryService {
    private cache = new Map<string, Record<string, unknown>>();

    private getKey(workflowId: string): string {
        return `${MEMORY_DIR_KEY}-${workflowId}`;
    }

    async load(workflowId: string): Promise<Record<string, unknown>> {
        if (this.cache.has(workflowId)) {
            return this.cache.get(workflowId)!;
        }
        try {
            const raw = await window.platform.storage.load(this.getKey(workflowId));
            if (raw) {
                const data = JSON.parse(raw) as Record<string, unknown>;
                this.cache.set(workflowId, data);
                return data;
            }
        } catch {
            // ignore
        }
        const empty: Record<string, unknown> = {};
        this.cache.set(workflowId, empty);
        return empty;
    }

    async read(workflowId: string, key: string): Promise<unknown> {
        const memory = await this.load(workflowId);
        return memory[key];
    }

    async write(workflowId: string, key: string, value: unknown): Promise<void> {
        const memory = await this.load(workflowId);
        memory[key] = value;
        this.cache.set(workflowId, memory);
        await window.platform.storage.save(this.getKey(workflowId), JSON.stringify(memory));
    }

    async clear(workflowId: string): Promise<void> {
        this.cache.delete(workflowId);
        await window.platform.storage.save(this.getKey(workflowId), JSON.stringify({}));
    }
}

export const workflowMemory = new WorkflowMemoryService();
