import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Node, Edge } from 'reactflow';
import { applyNodeChanges as rfApplyNodeChanges, applyEdgeChanges as rfApplyEdgeChanges } from 'reactflow';
import type { NodeChange, EdgeChange } from 'reactflow';
import type {
    WorkflowNodeData,
    ExecutionContext,
    ExecutionStatus,
    WorkflowEngineCallbacks,
    WorkflowTrigger,
} from './types';
import { createWorkflowDefinition } from './types';
import { WorkflowTestRunner } from './engine/WorkflowTestRunner';
import type { WorkflowTestCase, WorkflowTestResult } from './engine/WorkflowTestRunner';
import { GraphEngine } from './engine/GraphEngine';
import { deserializeFromSaveData, serializeToSaveData } from './engine/serializer';
import { CheckpointManager } from './engine/CheckpointManager';
import type { WorkflowCheckpoint } from './engine/CheckpointManager';
import { mcpClient } from '../services/mcp';
import { usePaneControlBus } from '../panes/paneControlBus';
import { usePaneStateStore } from '../panes/paneStateStore';
import { WORKFLOW_TEMPLATES } from './templates';

export interface HistorySnapshot {
    label: string;
    timestamp: number;
    data: Record<string, unknown>;
}

export interface ExecutionRun {
    id: string;
    workflowName: string;
    startedAt: number;
    endedAt: number;
    status: 'success' | 'error' | 'aborted';
    nodeCount: number;
    errorMessage?: string;
}

export interface WorkflowExecutionState {
    // Graph state
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
    workflowName: string;
    variables: Record<string, unknown>;

    // Execution state
    executionContext: ExecutionContext | null;
    isExecuting: boolean;
    validationErrors: string[];
    executionLogs: string[];
    executionPanelOpen: boolean;

    // Selected node (for property panel)
    selectedNodeId: string | null;

    // Actions
    setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
    setEdges: (edges: Edge[]) => void;
    applyNodeChanges: (changes: NodeChange[]) => void;
    applyEdgeChanges: (changes: EdgeChange[]) => void;
    addNode: (node: Node<WorkflowNodeData>) => void;
    addEdge: (edge: Edge) => void;
    setSelectedNodeId: (id: string | null) => void;
    updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
    updateNodeExecutionStatus: (nodeId: string, status: ExecutionStatus) => void;
    setWorkflowName: (name: string) => void;
    setVariable: (key: string, value: unknown) => void;
    removeVariable: (key: string) => void;

    // Execution panel
    addExecutionLog: (message: string) => void;
    clearExecutionLogs: () => void;
    toggleExecutionPanel: () => void;
    setExecutionPanelOpen: (open: boolean) => void;

    // Dry-run mode
    dryRun: boolean;
    toggleDryRun: () => void;

    // UI theme
    theme: 'dark' | 'light';
    toggleTheme: () => void;

    // Execution actions
    runWorkflow: () => Promise<void>;
    stopWorkflow: () => void;
    resetExecutionState: () => void;

    // Import/Export
    importWorkflow: (data: Record<string, unknown>) => void;

    // Templates
    loadTemplate: (templateId: string) => void;

    // Versioned history (manual checkpoints)
    history: HistorySnapshot[];
    saveCheckpoint: (label?: string) => void;
    restoreCheckpoint: (index: number) => void;

    // Execution run history (past completed runs)
    executionHistory: ExecutionRun[];
    clearExecutionHistory: () => void;

    // Triggers
    triggers: WorkflowTrigger[];
    addTrigger: (trigger: WorkflowTrigger) => void;
    removeTrigger: (id: string) => void;
    updateTrigger: (id: string, updates: Partial<WorkflowTrigger>) => void;
    triggersOpen: boolean;
    toggleTriggersPanel: () => void;

    // LiveWire panel
    liveWireOpen: boolean;
    toggleLiveWirePanel: () => void;

    // Environment variables
    envVars: Record<string, string>;
    loadEnvVars: () => Promise<void>;

    // Breakpoints
    breakpoints: Set<string>;
    toggleBreakpoint: (nodeId: string) => void;
    clearBreakpoints: () => void;
    pausedAtNodeId: string | null;
    setPausedAtNode: (nodeId: string | null) => void;
    breakpointResolvers: Map<string, () => void>;
    registerBreakpointResolver: (nodeId: string, resolve: () => void) => void;
    resolveBreakpoint: (nodeId: string) => void;

    // Test Runner
    testCases: WorkflowTestCase[];
    testResults: WorkflowTestResult[];
    isRunningTests: boolean;
    testRunnerOpen: boolean;
    addTestCase: (testCase: WorkflowTestCase) => void;
    removeTestCase: (index: number) => void;
    runTests: () => Promise<void>;
    setTestRunnerOpen: (open: boolean) => void;
    toggleTestRunnerPanel: () => void;

    // Execution checkpoints (resume after interruption)
    executionCheckpoints: WorkflowCheckpoint[];
    activeCheckpoint: WorkflowCheckpoint | null;
    autoCheckpoint: boolean;
    lastCompletedLevel: number;
    createExecutionCheckpoint: () => Promise<void>;
    resumeFromCheckpoint: (checkpointId: string) => Promise<void>;
    loadExecutionCheckpoints: () => Promise<void>;
    setAutoCheckpoint: (enabled: boolean) => void;
    deleteExecutionCheckpoint: (checkpointId: string) => Promise<void>;

    // Serialization
    toDefinition: () => ReturnType<typeof createWorkflowDefinition>;
}

let activeEngine: GraphEngine | null = null;

function routeWorkflowToolCall(name: string, args: Record<string, unknown>) {
    const wt = (window as unknown as {
        platform?: { workflowTools?: { call: (n: string, a: Record<string, unknown>) => Promise<unknown> } };
    }).platform?.workflowTools;

    // Local IPC tools handled by Electron main process.
    if (name.startsWith('fs:') || name.startsWith('git:') || name.startsWith('db:') || name === 'notify') {
        if (wt) {
            return wt.call(name, args);
        }
        console.warn(`[Workflow] workflowTools bridge unavailable for "${name}", falling back to MCP`);
    }

    return mcpClient.callTool(name, args);
}

export const useWorkflowStore = create<WorkflowExecutionState>()(temporal((set, get) => ({
    nodes: [],
    edges: [],
    workflowName: 'Untitled Workflow',
    variables: {},
    executionContext: null,
    isExecuting: false,
    validationErrors: [],
    executionLogs: [],
    executionPanelOpen: false,
    selectedNodeId: null,
    dryRun: false,
    theme: 'dark',
    history: [],
    executionHistory: [],
    triggers: [],
    triggersOpen: false,
    liveWireOpen: false,
    envVars: {},
    breakpoints: new Set<string>(),
    pausedAtNodeId: null,
    breakpointResolvers: new Map<string, () => void>(),
    testCases: [],
    testResults: [],
    isRunningTests: false,
    testRunnerOpen: false,
    executionCheckpoints: [],
    activeCheckpoint: null,
    autoCheckpoint: false,
    lastCompletedLevel: -1,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    applyNodeChanges: (changes) => {
        set((state) => ({
            nodes: rfApplyNodeChanges(changes, state.nodes) as Node<WorkflowNodeData>[],
        }));
    },
    applyEdgeChanges: (changes) => {
        set((state) => ({
            edges: rfApplyEdgeChanges(changes, state.edges),
        }));
    },
    addNode: (node) => {
        set((state) => ({ nodes: [...state.nodes, node] }));
    },
    addEdge: (edge) => {
        set((state) => ({ edges: [...state.edges, edge] }));
    },
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    updateNodeData: (nodeId, data) => {
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, ...data } }
                    : n
            ),
        }));
    },

    updateNodeExecutionStatus: (nodeId, status) => {
        get().updateNodeData(nodeId, { executionStatus: status });
    },

    toggleDryRun: () => set((state) => ({ dryRun: !state.dryRun })),

    toggleTheme: () => set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(next);
        }
        return { theme: next };
    }),

    setWorkflowName: (name) => set({ workflowName: name }),

    setVariable: (key, value) => {
        set((state) => ({
            variables: { ...state.variables, [key]: value },
        }));
    },

    removeVariable: (key) => {
        set((state) => {
            const { [key]: _, ...rest } = state.variables;
            return { variables: rest };
        });
    },

    addExecutionLog: (message) => {
        set((state) => ({
            executionLogs: [...state.executionLogs, message],
        }));
    },

    clearExecutionLogs: () => set({ executionLogs: [] }),

    toggleExecutionPanel: () => set((state) => ({
        executionPanelOpen: !state.executionPanelOpen,
    })),

    setExecutionPanelOpen: (open) => set({ executionPanelOpen: open }),

    toDefinition: () => {
        const { nodes, edges, variables, workflowName } = get();
        return createWorkflowDefinition(
            `wf-${Date.now()}`,
            workflowName,
            nodes,
            edges,
            variables,
        );
    },

    runWorkflow: async () => {
        const state = get();
        if (state.isExecuting) return;
        const isDryRun = get().dryRun;

        // Reset all node statuses and clear logs
        state.nodes.forEach((n) => {
            get().updateNodeExecutionStatus(n.id, 'idle');
        });
        set({ executionLogs: [] });

        const definition = get().toDefinition();

        const callbacks: Partial<WorkflowEngineCallbacks> = {
            onNodeStart: (nodeId) => {
                get().updateNodeExecutionStatus(nodeId, 'running');
            },
            onNodeComplete: (nodeId, result) => {
                const status: ExecutionStatus = result.status === 'success' ? 'success' : 'error';
                get().updateNodeExecutionStatus(nodeId, status);
            },
            onNodeError: (nodeId) => {
                get().updateNodeExecutionStatus(nodeId, 'error');
            },
            onExecutionComplete: (context) => {
                set({ executionContext: context, isExecuting: false });
                activeEngine = null;
                // Record in execution history (keep last 50 runs)
                const run: ExecutionRun = {
                    id: context.executionId,
                    workflowName: get().workflowName,
                    startedAt: Math.min(...Object.values(context.stepResults).map((r) => r.startTime)),
                    endedAt: Math.max(...Object.values(context.stepResults).map((r) => r.endTime)),
                    status: context.status === 'success' ? 'success' : context.status === 'aborted' ? 'aborted' : 'error',
                    nodeCount: Object.keys(context.stepResults).length,
                };
                set((state) => ({
                    executionHistory: [run, ...state.executionHistory].slice(0, 50),
                }));
            },
            onLog: (message) => {
                console.log('[Workflow]', message);
                get().addExecutionLog(message);
            },
            onBreakpointHit: (nodeId) => {
                get().setPausedAtNode(nodeId);
                get().updateNodeExecutionStatus(nodeId, 'running');
            },
            onLevelComplete: (level, context) => {
                set({ lastCompletedLevel: level });
                if (get().autoCheckpoint) {
                    // Fire-and-forget auto-checkpoint save
                    const def = get().toDefinition();
                    const ckpt = CheckpointManager.createCheckpoint(context, def, level);
                    CheckpointManager.saveCheckpoint(ckpt).then(() => {
                        set({ activeCheckpoint: ckpt });
                        get().addExecutionLog(`Auto-checkpoint saved at level ${level}: ${ckpt.id}`);
                    }).catch((err) => {
                        console.warn('Auto-checkpoint failed:', err);
                    });
                }
            },
        };

        const engine = new GraphEngine(
            definition,
            {
                callTool: isDryRun
                    ? async (name, args) => {
                        get().addExecutionLog(`[DRY-RUN] tool: ${name} args: ${JSON.stringify(args)}`);
                        return { dryRun: true, tool: name };
                    }
                    : (name, args, _options) => routeWorkflowToolCall(name, args),
                dryRun: isDryRun,
                dispatchPaneCommand: (paneId, cmd) =>
                    usePaneControlBus.getState().dispatch(paneId, cmd),
                envVars: get().envVars,
                paneStates: usePaneStateStore.getState().getAllPaneStates(),
                hasBreakpoint: (nodeId) => get().breakpoints.has(nodeId),
                waitForBreakpointContinue: (nodeId) => new Promise<void>((resolve) => {
                    get().registerBreakpointResolver(nodeId, resolve);
                }),
            },
            callbacks,
        );

        const validation = engine.validate();
        if (!validation.valid) {
            set({ validationErrors: validation.errors });
            return;
        }

        activeEngine = engine;
        set({ isExecuting: true, validationErrors: [], executionPanelOpen: true });

        try {
            const context = await engine.execute();
            set({ executionContext: context });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            set({
                isExecuting: false,
                validationErrors: [message],
            });
        }
    },

    stopWorkflow: () => {
        activeEngine?.abort();
        activeEngine = null;
        set({ isExecuting: false });
    },

    resetExecutionState: () => {
        const { nodes } = get();
        nodes.forEach((n) => {
            get().updateNodeExecutionStatus(n.id, 'idle');
        });
        set({ executionContext: null, isExecuting: false, validationErrors: [], executionLogs: [], lastCompletedLevel: -1, activeCheckpoint: null });
    },

    importWorkflow: (data) => {
        const restored = deserializeFromSaveData(data);
        if (!restored) {
            console.warn('Import failed: invalid workflow data');
            return;
        }
        set({
            nodes: restored.nodes,
            edges: restored.edges,
            workflowName: restored.name,
            variables: restored.variables,
            executionContext: null,
            isExecuting: false,
            validationErrors: [],
            executionLogs: [],
            selectedNodeId: null,
        });
    },

    loadTemplate: (templateId) => {
        const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
        if (!template) return;
        set({
            nodes: template.nodes as Node<WorkflowNodeData>[],
            edges: template.edges,
            workflowName: template.name,
            variables: template.variables ?? {},
            executionContext: null,
            isExecuting: false,
            validationErrors: [],
            executionLogs: [],
            selectedNodeId: null,
        });
    },

    saveCheckpoint: (label) => {
        const { nodes, edges, workflowName, variables, history } = get();
        const snapshot: HistorySnapshot = {
            label: label ?? `Checkpoint ${history.length + 1}`,
            timestamp: Date.now(),
            data: serializeToSaveData(nodes, edges, workflowName, variables),
        };
        // Keep up to 20 checkpoints
        const next = [snapshot, ...history].slice(0, 20);
        set({ history: next });
    },

    restoreCheckpoint: (index) => {
        const { history } = get();
        const snapshot = history[index];
        if (!snapshot) return;
        const restored = deserializeFromSaveData(snapshot.data);
        if (!restored) return;
        set({
            nodes: restored.nodes,
            edges: restored.edges,
            workflowName: restored.name,
            variables: restored.variables,
            executionContext: null,
            isExecuting: false,
            validationErrors: [],
            executionLogs: [],
            selectedNodeId: null,
        });
    },

    clearExecutionHistory: () => set({ executionHistory: [] }),

    addTrigger: (trigger) => set((state) => ({ triggers: [...state.triggers, trigger] })),
    removeTrigger: (id) => set((state) => ({ triggers: state.triggers.filter((t) => t.id !== id) })),
    updateTrigger: (id, updates) => set((state) => ({
        triggers: state.triggers.map((t) => t.id === id ? { ...t, ...updates } as WorkflowTrigger : t),
    })),
    toggleTriggersPanel: () => set((state) => ({ triggersOpen: !state.triggersOpen })),
    toggleLiveWirePanel: () => set((state) => ({ liveWireOpen: !state.liveWireOpen })),

    loadEnvVars: async () => {
        const vars = await (window as unknown as { platform?: { env?: { load?: () => Promise<Record<string, string>> } } }).platform?.env?.load?.() ?? {};
        set({ envVars: vars });
    },

    toggleBreakpoint: (nodeId) => {
        set((state) => {
            const next = new Set(state.breakpoints);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return { breakpoints: next };
        });
    },
    clearBreakpoints: () => set({ breakpoints: new Set<string>() }),
    setPausedAtNode: (nodeId) => set({ pausedAtNodeId: nodeId }),
    registerBreakpointResolver: (nodeId, resolve) => {
        set((state) => {
            const next = new Map(state.breakpointResolvers);
            next.set(nodeId, resolve);
            return { breakpointResolvers: next };
        });
    },
    resolveBreakpoint: (nodeId) => {
        set((state) => {
            const resolver = state.breakpointResolvers.get(nodeId);
            if (resolver) resolver();
            const next = new Map(state.breakpointResolvers);
            next.delete(nodeId);
            return { breakpointResolvers: next, pausedAtNodeId: null };
        });
    },

    // Test Runner actions
    addTestCase: (testCase) => {
        set((state) => ({ testCases: [...state.testCases, testCase] }));
    },
    removeTestCase: (index) => {
        set((state) => ({
            testCases: state.testCases.filter((_, i) => i !== index),
            // Clear results for the removed test
            testResults: state.testResults.filter((r) => r.testName !== state.testCases[index]?.name),
        }));
    },
    runTests: async () => {
        const state = get();
        if (state.isRunningTests || state.testCases.length === 0) return;

        set({ isRunningTests: true, testResults: [] });

        const definition = get().toDefinition();
        const runner = new WorkflowTestRunner(definition);

        try {
            const results = await runner.runAll(state.testCases);
            set({ testResults: results, isRunningTests: false });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown test runner error';
            console.error('[TestRunner]', message);
            set({ isRunningTests: false });
        }
    },
    setTestRunnerOpen: (open) => set({ testRunnerOpen: open }),
    toggleTestRunnerPanel: () => set((state) => ({ testRunnerOpen: !state.testRunnerOpen })),

    // Execution checkpoint actions
    createExecutionCheckpoint: async () => {
        const { executionContext, lastCompletedLevel } = get();
        if (!executionContext) {
            console.warn('Cannot create checkpoint: no active execution context');
            return;
        }
        const definition = get().toDefinition();
        const checkpoint = CheckpointManager.createCheckpoint(executionContext, definition, lastCompletedLevel);
        try {
            await CheckpointManager.saveCheckpoint(checkpoint);
            set({ activeCheckpoint: checkpoint });
            get().addExecutionLog(`Checkpoint saved: ${checkpoint.id}`);
            // Refresh checkpoint list
            await get().loadExecutionCheckpoints();
        } catch (err) {
            console.error('Failed to save checkpoint:', err);
        }
    },

    resumeFromCheckpoint: async (checkpointId) => {
        const state = get();
        if (state.isExecuting) return;

        // Find the checkpoint
        const checkpoint = state.executionCheckpoints.find((c) => c.id === checkpointId);
        if (!checkpoint) {
            console.warn(`Checkpoint "${checkpointId}" not found`);
            return;
        }

        // Reset node statuses
        state.nodes.forEach((n) => {
            get().updateNodeExecutionStatus(n.id, 'idle');
        });

        // Mark previously completed nodes with their status from checkpoint
        for (const [nodeId, result] of Object.entries(checkpoint.stepResults)) {
            const status: ExecutionStatus = result.status === 'success' ? 'success' : result.status === 'error' ? 'error' : 'skipped';
            get().updateNodeExecutionStatus(nodeId, status);
        }

        set({ executionLogs: [...checkpoint.logs] });

        const definition = get().toDefinition();
        const isDryRun = get().dryRun;

        const callbacks: Partial<WorkflowEngineCallbacks> = {
            onNodeStart: (nodeId) => {
                get().updateNodeExecutionStatus(nodeId, 'running');
            },
            onNodeComplete: (nodeId, result) => {
                const status: ExecutionStatus = result.status === 'success' ? 'success' : 'error';
                get().updateNodeExecutionStatus(nodeId, status);
            },
            onNodeError: (nodeId) => {
                get().updateNodeExecutionStatus(nodeId, 'error');
            },
            onExecutionComplete: (context) => {
                set({ executionContext: context, isExecuting: false, activeCheckpoint: null });
                activeEngine = null;
                const run: ExecutionRun = {
                    id: context.executionId,
                    workflowName: get().workflowName,
                    startedAt: Math.min(...Object.values(context.stepResults).map((r) => r.startTime)),
                    endedAt: Math.max(...Object.values(context.stepResults).map((r) => r.endTime)),
                    status: context.status === 'success' ? 'success' : context.status === 'aborted' ? 'aborted' : 'error',
                    nodeCount: Object.keys(context.stepResults).length,
                };
                set((state) => ({
                    executionHistory: [run, ...state.executionHistory].slice(0, 50),
                }));
            },
            onLog: (message) => {
                console.log('[Workflow]', message);
                get().addExecutionLog(message);
            },
            onBreakpointHit: (nodeId) => {
                get().setPausedAtNode(nodeId);
                get().updateNodeExecutionStatus(nodeId, 'running');
            },
            onLevelComplete: (level, context) => {
                set({ lastCompletedLevel: level });
                if (get().autoCheckpoint) {
                    const def = get().toDefinition();
                    const ckpt = CheckpointManager.createCheckpoint(context, def, level);
                    CheckpointManager.saveCheckpoint(ckpt).then(() => {
                        set({ activeCheckpoint: ckpt });
                        get().addExecutionLog(`Auto-checkpoint saved at level ${level}: ${ckpt.id}`);
                    }).catch((err) => {
                        console.warn('Auto-checkpoint failed:', err);
                    });
                }
            },
        };

        const dependencies: import('./types').ExecutorDependencies = {
            callTool: isDryRun
                ? async (name, args) => {
                    get().addExecutionLog(`[DRY-RUN] tool: ${name} args: ${JSON.stringify(args)}`);
                    return { dryRun: true, tool: name };
                }
                : (name, args, _options) => routeWorkflowToolCall(name, args),
            dryRun: isDryRun,
            dispatchPaneCommand: (paneId, cmd) =>
                usePaneControlBus.getState().dispatch(paneId, cmd),
            envVars: get().envVars,
            paneStates: usePaneStateStore.getState().getAllPaneStates(),
            hasBreakpoint: (nodeId) => get().breakpoints.has(nodeId),
            waitForBreakpointContinue: (nodeId) => new Promise<void>((resolve) => {
                get().registerBreakpointResolver(nodeId, resolve);
            }),
        };

        set({ isExecuting: true, validationErrors: [], executionPanelOpen: true, activeCheckpoint: checkpoint });

        try {
            const context = await CheckpointManager.resumeFromCheckpoint(
                checkpoint,
                definition,
                dependencies,
                callbacks,
            );
            set({ executionContext: context });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            set({
                isExecuting: false,
                validationErrors: [message],
            });
        }
    },

    loadExecutionCheckpoints: async () => {
        const definition = get().toDefinition();
        try {
            const checkpoints = await CheckpointManager.listCheckpoints(definition.id);
            set({ executionCheckpoints: checkpoints });
        } catch {
            set({ executionCheckpoints: [] });
        }
    },

    setAutoCheckpoint: (enabled) => set({ autoCheckpoint: enabled }),

    deleteExecutionCheckpoint: async (checkpointId) => {
        const definition = get().toDefinition();
        await CheckpointManager.deleteCheckpoint(definition.id, checkpointId);
        await get().loadExecutionCheckpoints();
    },
}), {
    partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        workflowName: state.workflowName,
        variables: state.variables,
    }),
    limit: 50,
}));
