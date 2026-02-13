import type { Node, Edge } from 'reactflow';
import type {
    WorkflowDefinition,
    WorkflowNodeData,
    ExecutionContext,
    StepResult,
    WorkflowEngineCallbacks,
    ExecutorDependencies,
} from '../types';
import { createExecutionContext } from '../types';
import { getNodeExecutor } from './NodeExecutor';
import type { WorkflowCheckpoint } from './CheckpointManager';
import { CheckpointManager } from './CheckpointManager';

// --- Execute Options ---

export interface ExecuteOptions {
    /** When set, pre-populate context with checkpoint data and skip completed levels. */
    resumeCheckpoint?: WorkflowCheckpoint;
}

// --- Validation ---

export interface GraphValidationResult {
    valid: boolean;
    errors: string[];
}

// --- Engine ---

export class GraphEngine {
    private definition: WorkflowDefinition;
    private callbacks: Partial<WorkflowEngineCallbacks>;
    private dependencies: ExecutorDependencies;
    private abortController = new AbortController();

    constructor(
        definition: WorkflowDefinition,
        dependencies: ExecutorDependencies,
        callbacks?: Partial<WorkflowEngineCallbacks>,
    ) {
        this.definition = definition;
        this.dependencies = dependencies;
        this.callbacks = callbacks ?? {};
    }

    /** Validate the workflow graph before execution. */
    validate(): GraphValidationResult {
        const errors: string[] = [];
        const { nodes, edges } = this.definition;
        const nodeIds = new Set(nodes.map((n) => n.id));

        // V1: Exactly one start and one end node.
        // Future: multiple start nodes as triggers (e.g. webhook, schedule, manual).
        // When extending, change this check and update topologicalSort to handle multiple roots.
        const startNodes = nodes.filter((n) => n.type === 'start');
        if (startNodes.length === 0) {
            errors.push('Workflow must have exactly one start node');
        } else if (startNodes.length > 1) {
            errors.push(`Workflow has ${startNodes.length} start nodes, expected exactly one`);
        }

        const endNodes = nodes.filter((n) => n.type === 'end');
        if (endNodes.length === 0) {
            errors.push('Workflow must have exactly one end node');
        } else if (endNodes.length > 1) {
            errors.push(`Workflow has ${endNodes.length} end nodes, expected exactly one`);
        }

        // Edges reference existing nodes
        for (const edge of edges) {
            if (!nodeIds.has(edge.source)) {
                errors.push(`Edge "${edge.id}" references unknown source node "${edge.source}"`);
            }
            if (!nodeIds.has(edge.target)) {
                errors.push(`Edge "${edge.id}" references unknown target node "${edge.target}"`);
            }
        }

        // Cycle detection (exclude comment nodes — they have no edges)
        const executableNodes = nodes.filter((n) => n.type !== 'comment');
        const executableEdges = edges.filter((e) =>
            executableNodes.some((n) => n.id === e.source) &&
            executableNodes.some((n) => n.id === e.target)
        );
        if (errors.length === 0 && this.detectCycle(executableNodes, executableEdges)) {
            errors.push('Workflow contains a cycle');
        }

        // Node-level configuration validation
        for (const node of nodes) {
            if (node.type === 'tool' && !node.data.toolName) {
                errors.push(`Tool node "${node.data.label || node.id}" has no tool selected`);
            }
            if ((node.type === 'condition' || node.type === 'if') && !node.data.conditionExpression?.trim()) {
                errors.push(`Condition node "${node.data.label || node.id}" has no expression`);
            }
            if (node.type === 'transform' && !node.data.transformCode?.trim()) {
                errors.push(`Transform node "${node.data.label || node.id}" has no code`);
            }
            if (node.type === 'http' && !node.data.httpUrl?.trim()) {
                errors.push(`HTTP node "${node.data.label || node.id}" has no URL`);
            }
            if ((node.type === 'terminal' || node.type === 'run') && !node.data.terminalPaneId?.trim()) {
                errors.push(`Terminal node "${node.data.label || node.id}" has no target pane selected`);
            }
            if ((node.type === 'terminal' || node.type === 'run') && !node.data.terminalCommand?.trim()) {
                errors.push(`Terminal node "${node.data.label || node.id}" has no command configured`);
            }
            if ((node.type === 'editor' || node.type === 'read-editor' || node.type === 'write-editor' || node.type === 'open-file' || node.type === 'save-file' || node.type === 'search-replace') && !node.data.editorPaneId?.trim()) {
                errors.push(`Editor node "${node.data.label || node.id}" has no target pane selected`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /** Execute the workflow graph with parallel level-based execution and branching support. */
    async execute(options?: ExecuteOptions): Promise<ExecutionContext> {
        const validation = this.validate();
        if (!validation.valid) {
            throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`);
        }

        const checkpoint = options?.resumeCheckpoint;
        let context: ExecutionContext;

        if (checkpoint) {
            // Resume: pre-populate context from checkpoint data
            context = createExecutionContext(this.definition.id);
            context.variables = { ...this.definition.variables, ...checkpoint.variables };
            context.envVars = this.dependencies.envVars ?? {};
            context.paneStates = this.dependencies.paneStates ?? {};
            context.status = 'running';
            context.logs = [...checkpoint.logs, `Resuming from checkpoint "${checkpoint.id}" (level ${checkpoint.lastCompletedLevel})`];
            context.stepResults = CheckpointManager.restoreStepResults(checkpoint);
        } else {
            context = createExecutionContext(this.definition.id);
            context.variables = { ...this.definition.variables };
            context.envVars = this.dependencies.envVars ?? {};
            context.paneStates = this.dependencies.paneStates ?? {};
            context.status = 'running';
        }

        // Exclude comment nodes from execution
        const executableNodes = this.definition.nodes.filter((n) => n.type !== 'comment');
        const executableEdges = this.definition.edges.filter((e) =>
            executableNodes.some((n) => n.id === e.source) &&
            executableNodes.some((n) => n.id === e.target)
        );

        // Build reverse edge index for merge nodes
        const reverseEdgeIndex = new Map<string, Edge[]>();
        for (const edge of executableEdges) {
            const existing = reverseEdgeIndex.get(edge.target) ?? [];
            existing.push(edge);
            reverseEdgeIndex.set(edge.target, existing);
        }

        // Wrap deps to inject abort signal + getIncomingEdges, forwarding all other deps
        const wrappedDeps: ExecutorDependencies = {
            ...this.dependencies,
            callTool: (name, args, options) =>
                this.dependencies.callTool(name, args, { ...options, signal: this.abortController.signal }),
            getIncomingEdges: (nodeId: string) => reverseEdgeIndex.get(nodeId) ?? [],
        };

        const levels = this.topologicalSortByLevel(executableNodes, executableEdges);
        const adj = this.buildAdjacencyList(executableEdges);

        // Track which nodes are active (not pruned by condition branches)
        const activeNodeIds = new Set(executableNodes.map((n) => n.id));

        // Determine the starting level index (skip already-completed levels when resuming)
        const startLevelIndex = checkpoint ? checkpoint.lastCompletedLevel + 1 : 0;

        // When resuming, replay condition pruning from completed levels
        if (checkpoint && startLevelIndex > 0) {
            for (let i = 0; i < startLevelIndex && i < levels.length; i++) {
                for (const node of levels[i]) {
                    if (node.type === 'condition' && context.stepResults[node.id]?.status === 'success') {
                        const output = context.stepResults[node.id].output as { result: boolean };
                        this.pruneConditionBranch(node.id, output.result, executableEdges, adj, activeNodeIds);
                    }
                }
            }
            this.callbacks.onLog?.(`Skipping ${startLevelIndex} already-completed levels`);
        }

        for (let levelIndex = startLevelIndex; levelIndex < levels.length; levelIndex++) {
            const level = levels[levelIndex];

            if (this.abortController.signal.aborted) {
                context.status = 'aborted';
                context.logs.push('Execution aborted');
                break;
            }

            // Separate active from pruned nodes in this level
            const activeNodes = level.filter((n) => activeNodeIds.has(n.id));
            const prunedNodes = level.filter((n) => !activeNodeIds.has(n.id));

            // Mark pruned nodes as skipped
            for (const node of prunedNodes) {
                const result: StepResult = {
                    nodeId: node.id,
                    status: 'skipped',
                    output: null,
                    startTime: Date.now(),
                    endTime: Date.now(),
                };
                context.stepResults[node.id] = result;
                this.callbacks.onNodeComplete?.(node.id, result);
                this.callbacks.onLog?.(`Skipping node "${node.id}" (branch not taken)`);
            }

            if (activeNodes.length === 0) {
                this.callbacks.onLevelComplete?.(levelIndex, context);
                continue;
            }

            // Execute active nodes: parallel if multiple, sequential if one
            let fatalError = false;
            if (activeNodes.length === 1) {
                fatalError = await this.executeNode(activeNodes[0], context, wrappedDeps);
            } else {
                // Parallel execution of independent nodes at the same level
                const results = await Promise.all(
                    activeNodes.map((node) => this.executeNode(node, context, wrappedDeps))
                );
                // If any node caused a fatal error (non-continueOnError), stop
                fatalError = results.some((err) => err);
            }

            // After level completes, prune branches for any condition nodes in this level
            if (!fatalError) {
                for (const node of activeNodes) {
                    if (node.type === 'condition' && context.stepResults[node.id]?.status === 'success') {
                        const output = context.stepResults[node.id].output as { result: boolean };
                        this.pruneConditionBranch(node.id, output.result, executableEdges, adj, activeNodeIds);
                    }
                }
            }

            // Notify level completion
            this.callbacks.onLevelComplete?.(levelIndex, context);

            if (fatalError) break;
        }

        if (context.status === 'running') {
            context.status = 'success';
        }

        context.currentNodeId = undefined;
        this.callbacks.onExecutionComplete?.(context);
        return context;
    }

    /** Signal the engine to stop after the current node completes. */
    abort(): void {
        this.abortController.abort();
    }

    // --- Internal helpers ---

    /**
     * Execute a single node. Returns true if execution should stop (fatal error).
     */
    private async executeNode(
        node: Node<WorkflowNodeData>,
        context: ExecutionContext,
        wrappedDeps: ExecutorDependencies,
    ): Promise<boolean> {
        context.currentNodeId = node.id;

        // Check for breakpoint before executing
        if (wrappedDeps.hasBreakpoint?.(node.id)) {
            this.callbacks.onBreakpointHit?.(node.id);
            this.callbacks.onLog?.(`Paused at breakpoint: node "${node.id}"`);
            await wrappedDeps.waitForBreakpointContinue?.(node.id);
            if (this.abortController.signal.aborted) {
                context.status = 'aborted';
                return true;
            }
        }

        this.callbacks.onNodeStart?.(node.id);
        this.callbacks.onLog?.(`Executing node "${node.id}" (${node.type})`);

        const startTime = Date.now();

        try {
            const executor = getNodeExecutor(node.type ?? 'tool');
            const output = await this.executeWithRetryAndTimeout(node, executor, context, wrappedDeps);

            const result: StepResult = {
                nodeId: node.id,
                status: 'success',
                output,
                startTime,
                endTime: Date.now(),
            };

            context.stepResults[node.id] = result;
            this.callbacks.onNodeComplete?.(node.id, result);
            return false; // no error
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            const result: StepResult = {
                nodeId: node.id,
                status: 'error',
                output: null,
                error: errorMessage,
                startTime,
                endTime: Date.now(),
            };

            context.stepResults[node.id] = result;
            context.logs.push(`Node "${node.id}" failed: ${errorMessage}`);
            this.callbacks.onNodeError?.(node.id, errorMessage);

            if (node.data.continueOnError) {
                this.callbacks.onNodeComplete?.(node.id, result);
                context.logs.push(`Node "${node.id}" has continueOnError=true, continuing execution`);
                return false; // continue
            }

            context.status = 'error';
            return true; // fatal error, stop execution
        }
    }

    /**
     * Wrap executor with retry and timeout logic based on node config.
     */
    private async executeWithRetryAndTimeout(
        node: Node<WorkflowNodeData>,
        executor: (n: Node<WorkflowNodeData>, ctx: ExecutionContext, deps: ExecutorDependencies) => Promise<unknown>,
        context: ExecutionContext,
        wrappedDeps: ExecutorDependencies,
    ): Promise<unknown> {
        const maxRetries = node.data.retryCount ?? 0;
        const retryDelay = node.data.retryDelayMs ?? 1000;
        const timeoutMs = node.data.timeoutMs;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                let executionPromise = executor(node, context, wrappedDeps);

                // Apply timeout if configured
                if (timeoutMs && timeoutMs > 0) {
                    executionPromise = Promise.race([
                        executionPromise,
                        new Promise<never>((_, reject) =>
                            setTimeout(
                                () => reject(new Error(`Node "${node.id}" timed out after ${timeoutMs}ms`)),
                                timeoutMs,
                            )
                        ),
                    ]);
                }

                return await executionPromise;
            } catch (err) {
                if (attempt < maxRetries) {
                    const msg = err instanceof Error ? err.message : String(err);
                    context.logs.push(
                        `Retrying node "${node.id}" (attempt ${attempt + 2}/${maxRetries + 1}): ${msg}`
                    );
                    this.callbacks.onLog?.(
                        `Retrying node "${node.id}" (attempt ${attempt + 2}/${maxRetries + 1})`
                    );
                    await new Promise((r) => setTimeout(r, retryDelay));
                } else {
                    throw err;
                }
            }
        }

        // Should never reach here, but TypeScript needs it
        throw new Error(`Node "${node.id}" failed after ${maxRetries + 1} attempts`);
    }

    /**
     * After a condition node evaluates, prune nodes that are exclusively
     * reachable through the non-taken branch.
     */
    private pruneConditionBranch(
        conditionNodeId: string,
        conditionResult: boolean,
        edges: Edge[],
        adj: Map<string, string[]>,
        activeNodeIds: Set<string>,
    ): void {
        const takenHandle = String(conditionResult);
        const notTakenHandle = String(!conditionResult);

        const takenTargets: string[] = [];
        const notTakenTargets: string[] = [];

        for (const edge of edges) {
            if (edge.source !== conditionNodeId) continue;
            if (edge.sourceHandle === takenHandle) {
                takenTargets.push(edge.target);
            } else if (edge.sourceHandle === notTakenHandle) {
                notTakenTargets.push(edge.target);
            }
        }

        if (notTakenTargets.length === 0) return;

        const reachableFrom = (starts: string[]): Set<string> => {
            const visited = new Set<string>();
            const queue = [...starts];
            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;
                visited.add(current);
                for (const neighbor of adj.get(current) ?? []) {
                    if (!visited.has(neighbor)) queue.push(neighbor);
                }
            }
            return visited;
        };

        const reachableFromNotTaken = reachableFrom(notTakenTargets);
        const reachableFromTaken = reachableFrom(takenTargets);

        for (const nodeId of reachableFromNotTaken) {
            if (!reachableFromTaken.has(nodeId)) {
                activeNodeIds.delete(nodeId);
            }
        }
    }

    private buildAdjacencyList(edges: Edge[]): Map<string, string[]> {
        const adj = new Map<string, string[]>();
        for (const edge of edges) {
            const neighbors = adj.get(edge.source) ?? [];
            neighbors.push(edge.target);
            adj.set(edge.source, neighbors);
        }
        return adj;
    }

    private buildInDegreeMap(nodes: Node<WorkflowNodeData>[], edges: Edge[]): Map<string, number> {
        const inDegree = new Map<string, number>();
        for (const node of nodes) {
            inDegree.set(node.id, 0);
        }
        for (const edge of edges) {
            inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
        }
        return inDegree;
    }

    /**
     * Kahn's algorithm producing levels — each level contains nodes
     * that are ready to execute simultaneously (same topological depth).
     */
    private topologicalSortByLevel(
        nodes: Node<WorkflowNodeData>[],
        edges: Edge[],
    ): Node<WorkflowNodeData>[][] {
        const adj = this.buildAdjacencyList(edges);
        const inDegree = this.buildInDegreeMap(nodes, edges);
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        let queue: string[] = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) queue.push(id);
        }
        queue.sort();

        const levels: Node<WorkflowNodeData>[][] = [];
        let processed = 0;

        while (queue.length > 0) {
            const level: Node<WorkflowNodeData>[] = [];
            const nextQueue: string[] = [];

            for (const current of queue) {
                const node = nodeMap.get(current);
                if (node) {
                    level.push(node);
                    processed++;
                }

                const neighbors = adj.get(current) ?? [];
                for (const neighbor of neighbors) {
                    const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
                    inDegree.set(neighbor, newDegree);
                    if (newDegree === 0) nextQueue.push(neighbor);
                }
            }

            if (level.length > 0) levels.push(level);
            nextQueue.sort();
            queue = nextQueue;
        }

        if (processed !== nodes.length) {
            throw new Error('Workflow contains a cycle');
        }

        return levels;
    }

    /**
     * Returns true if the graph contains a cycle.
     */
    private detectCycle(nodes: Node<WorkflowNodeData>[], edges: Edge[]): boolean {
        try {
            this.topologicalSortByLevel(nodes, edges);
            return false;
        } catch {
            return true;
        }
    }
}
