import type {
    WorkflowDefinition,
    ExecutionContext,
    StepResult,
    WorkflowEngineCallbacks,
    ExecutorDependencies,
} from '../types';

// --- Checkpoint Types ---

export interface SerializedStepResult {
    nodeId: string;
    status: 'success' | 'error' | 'skipped';
    output: unknown; // must be JSON-serializable
    error?: string;
    startTime: number;
    endTime: number;
}

export interface WorkflowCheckpoint {
    id: string;
    workflowId: string;
    workflowDefinitionId: string;
    timestamp: number;
    /** IDs of nodes that completed execution before the checkpoint. */
    completedNodeIds: string[];
    /** Serialized step results for completed nodes. */
    stepResults: Record<string, SerializedStepResult>;
    /** Workflow variables at the time of checkpoint. */
    variables: Record<string, unknown>;
    /** Execution logs accumulated before the checkpoint. */
    logs: string[];
    /** The level index (0-based) that was last fully completed. */
    lastCompletedLevel: number;
    /** Status at time of checkpoint. */
    status: 'paused' | 'interrupted';
}

// --- Helpers ---

function serializeStepResult(result: StepResult): SerializedStepResult {
    return {
        nodeId: result.nodeId,
        status: result.status,
        output: result.output,
        error: result.error,
        startTime: result.startTime,
        endTime: result.endTime,
    };
}

function deserializeStepResult(serialized: SerializedStepResult): StepResult {
    return {
        nodeId: serialized.nodeId,
        status: serialized.status,
        output: serialized.output,
        error: serialized.error,
        startTime: serialized.startTime,
        endTime: serialized.endTime,
    };
}

function getCheckpointDir(workflowId: string): string {
    return `.leion/checkpoints/${workflowId}`;
}

function getCheckpointPath(workflowId: string, checkpointId: string): string {
    return `${getCheckpointDir(workflowId)}/${checkpointId}.json`;
}

/** Access the platform workflowTools IPC bridge. */
function getWorkflowTools(): { call: (name: string, args: Record<string, unknown>) => Promise<unknown> } {
    const wt = (window as unknown as {
        platform?: {
            workflowTools?: { call: (n: string, a: Record<string, unknown>) => Promise<unknown> };
        };
    }).platform?.workflowTools;
    if (!wt) throw new Error('CheckpointManager: platform.workflowTools not available');
    return wt;
}

// --- CheckpointManager ---

export const CheckpointManager = {
    /**
     * Create a checkpoint from the current execution state.
     */
    createCheckpoint(
        context: ExecutionContext,
        definition: WorkflowDefinition,
        lastCompletedLevel: number,
    ): WorkflowCheckpoint {
        const completedNodeIds = Object.keys(context.stepResults);
        const serializedResults: Record<string, SerializedStepResult> = {};

        for (const [nodeId, result] of Object.entries(context.stepResults)) {
            serializedResults[nodeId] = serializeStepResult(result);
        }

        return {
            id: `ckpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            workflowId: context.workflowId,
            workflowDefinitionId: definition.id,
            timestamp: Date.now(),
            completedNodeIds,
            stepResults: serializedResults,
            variables: structuredClone(context.variables),
            logs: [...context.logs],
            lastCompletedLevel,
            status: 'paused',
        };
    },

    /**
     * Save a checkpoint to disk via IPC fs:write.
     * The fs:write handler auto-creates directories.
     */
    async saveCheckpoint(checkpoint: WorkflowCheckpoint): Promise<void> {
        const wt = getWorkflowTools();
        const filePath = getCheckpointPath(checkpoint.workflowId, checkpoint.id);
        const content = JSON.stringify(checkpoint, null, 2);
        await wt.call('fs:write', { path: filePath, content });
    },

    /**
     * Load the most recent checkpoint for a workflow.
     * Returns null if no checkpoints exist.
     */
    async loadCheckpoint(workflowId: string): Promise<WorkflowCheckpoint | null> {
        const checkpoints = await this.listCheckpoints(workflowId);
        if (checkpoints.length === 0) return null;
        // Sort by timestamp descending, return the most recent
        checkpoints.sort((a, b) => b.timestamp - a.timestamp);
        return checkpoints[0];
    },

    /**
     * List all checkpoints for a workflow.
     */
    async listCheckpoints(workflowId: string): Promise<WorkflowCheckpoint[]> {
        const wt = getWorkflowTools();
        const dir = getCheckpointDir(workflowId);

        // Check if the directory exists first
        try {
            const existsResult = await wt.call('fs:exists', { path: dir }) as { exists: boolean };
            if (!existsResult.exists) return [];
        } catch {
            return [];
        }

        try {
            const files = await wt.call('fs:list', { dir, glob: '*.json' }) as Array<{ path: string; name: string }>;
            const checkpoints: WorkflowCheckpoint[] = [];

            for (const file of files) {
                try {
                    const content = await wt.call('fs:read', { path: file.path }) as string;
                    const parsed = JSON.parse(content) as WorkflowCheckpoint;
                    checkpoints.push(parsed);
                } catch {
                    // Skip malformed checkpoint files
                    console.warn(`CheckpointManager: skipping malformed checkpoint file: ${file.path}`);
                }
            }

            return checkpoints;
        } catch {
            return [];
        }
    },

    /**
     * Delete a checkpoint file.
     */
    async deleteCheckpoint(workflowId: string, checkpointId: string): Promise<void> {
        const wt = getWorkflowTools();
        const filePath = getCheckpointPath(workflowId, checkpointId);
        try {
            await wt.call('fs:delete', { path: filePath });
        } catch {
            console.warn(`CheckpointManager: failed to delete checkpoint: ${filePath}`);
        }
    },

    /**
     * Resume workflow execution from a checkpoint.
     *
     * Creates a new GraphEngine, pre-populates its context with checkpoint data,
     * and executes starting from the level after lastCompletedLevel.
     */
    async resumeFromCheckpoint(
        checkpoint: WorkflowCheckpoint,
        definition: WorkflowDefinition,
        dependencies: ExecutorDependencies,
        callbacks: Partial<WorkflowEngineCallbacks>,
    ): Promise<ExecutionContext> {
        // Import GraphEngine here to avoid circular dependency at module level
        const { GraphEngine } = await import('./GraphEngine');

        const engine = new GraphEngine(definition, dependencies, callbacks);

        const validation = engine.validate();
        if (!validation.valid) {
            throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`);
        }

        // Use the new resume execution path
        return engine.execute({
            resumeCheckpoint: checkpoint,
        });
    },

    /**
     * Restore StepResult records from serialized checkpoint data.
     */
    restoreStepResults(checkpoint: WorkflowCheckpoint): Record<string, StepResult> {
        const results: Record<string, StepResult> = {};
        for (const [nodeId, serialized] of Object.entries(checkpoint.stepResults)) {
            results[nodeId] = deserializeStepResult(serialized);
        }
        return results;
    },
};
