import { useCallback, useRef, useState, useEffect, DragEvent } from 'react';
import { cn } from '../lib/utils';
import { Maximize, Minimize, Plus, Play, Square } from 'lucide-react';
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    addEdge,
    NodeTypes,
    Node,
    ReactFlowProvider,
    useReactFlow,
    OnConnect,
    ReactFlowInstance,
    type Connection,
    type OnSelectionChangeParams,
    type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowPane.css'; // Keep minified Overrides
import WorkflowSidebar from './WorkflowSidebar';
import {
    WORKFLOW_DND_NODE_DATA_MIME,
    WORKFLOW_DND_NODE_TYPE_MIME,
    isWorkflowNodeType,
    normalizeWorkflowNodeData,
    parseWorkflowDragPayload,
} from './workflowDnd';
import type { WorkflowNodeData, WorkflowNodeType } from '../workflow/types';
import { useWorkflowStore } from '../workflow/store';
import { WorkflowToolbar } from '../workflow/ui/WorkflowToolbar';
import { PropertyPanel } from '../workflow/ui/PropertyPanel';
import { ExecutionPanel } from '../workflow/ui/ExecutionPanel';
import { VariableEditor } from '../workflow/ui/VariableEditor';
import { serializeToSaveData, deserializeFromSaveData } from '../workflow/engine/serializer';
import { WorkflowContextMenu, type ContextMenuState } from '../workflow/ui/WorkflowContextMenu';
import { InlineRename, type InlineRenameState } from '../workflow/ui/InlineRename';
import { HistoryPanel } from '../workflow/ui/HistoryPanel';
import { TriggerPanel } from '../workflow/ui/TriggerPanel';
import { LiveWirePanel } from '../workflow/ui/LiveWirePanel';
import { TestRunnerPanel } from '../workflow/ui/TestRunnerPanel';
import { triggerManager } from '../services/triggerManager';

import StartNode from '../workflow/nodes/StartNode';
import EndNode from '../workflow/nodes/EndNode';
import ToolNode from '../workflow/nodes/ToolNode';
import ConditionNode from '../workflow/nodes/ConditionNode';
import MergeNode from '../workflow/nodes/MergeNode';
import CommentNode from '../workflow/nodes/CommentNode';
import TransformNode from '../workflow/nodes/TransformNode';
import DelayNode from '../workflow/nodes/DelayNode';
import HttpNode from '../workflow/nodes/HttpNode';
import LoopNode from '../workflow/nodes/LoopNode';
import TerminalNode from '../workflow/nodes/TerminalNode';
import EditorNode from '../workflow/nodes/EditorNode';
import ChatNode from '../workflow/nodes/ChatNode';
import SubworkflowNode from '../workflow/nodes/SubworkflowNode';
import { MemoryReadNode, MemoryWriteNode, VariableNode } from '../workflow/nodes/MemoryNode';
import RaceNode from '../workflow/nodes/RaceNode';
import SpaceNode from '../workflow/nodes/SpaceNode';
import BrowserNodeComponent from '../workflow/nodes/BrowserNode';
import FileNode from '../workflow/nodes/FileNode';
import NotifyNode from '../workflow/nodes/NotifyNode';
import GitNode from '../workflow/nodes/GitNode';
import DatabaseNode from '../workflow/nodes/DatabaseNode';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useWorkflowShortcuts } from '../workflow/ui/useWorkflowShortcuts';

const nodeTypes: NodeTypes = {
    // Existing compound node types
    start: StartNode,
    end: EndNode,
    tool: ToolNode,
    condition: ConditionNode,
    merge: MergeNode,
    comment: CommentNode,
    transform: TransformNode,
    delay: DelayNode,
    http: HttpNode,
    loop: LoopNode,
    terminal: TerminalNode,
    editor: EditorNode,
    chat: ChatNode,
    subworkflow: SubworkflowNode,
    'memory-read': MemoryReadNode,
    'memory-write': MemoryWriteNode,
    space: SpaceNode,
    browser: BrowserNodeComponent,
    file: FileNode,
    notify: NotifyNode,
    git: GitNode,
    // Phase 1 primitive node types (ACT — chat-based)
    ask: ChatNode,
    'new-chat': ChatNode,
    'set-model': ChatNode,
    'read-chat': ChatNode,
    // Phase 1 primitive node types (ACT — terminal-based)
    run: TerminalNode,
    // Phase 1 primitive node types (ACT — editor-based)
    'write-editor': EditorNode,
    'open-file': EditorNode,
    'save-file': EditorNode,
    'search-replace': EditorNode,
    // Phase 1 primitive node types (READ — editor-based)
    'read-editor': EditorNode,
    // Phase 1 primitive node types (ACT — browser-based)
    navigate: BrowserNodeComponent,
    click: BrowserNodeComponent,
    fill: BrowserNodeComponent,
    'execute-js': BrowserNodeComponent,
    scroll: BrowserNodeComponent,
    // Phase 1 primitive node types (READ — browser-based)
    extract: BrowserNodeComponent,
    screenshot: BrowserNodeComponent,
    // Phase 1 primitive node types (FLOW)
    if: ConditionNode,
    switch: ConditionNode,
    race: RaceNode,
    // Phase 1 primitive node types (MEMORY)
    recall: MemoryReadNode,
    remember: MemoryWriteNode,
    forget: MemoryWriteNode,
    variable: VariableNode,
    // Phase 1 primitive node types (FILE)
    'read-file': FileNode,
    'write-file': FileNode,
    'list-files': FileNode,
    // Phase 1 primitive node types (GIT)
    'git-status': GitNode,
    'git-diff': GitNode,
    'git-commit': GitNode,
    // Database
    database: DatabaseNode,
    // Phase 2 primitive node types (ACT)
    fetch: HttpNode,
    'send-input': TerminalNode,
    'db-query': DatabaseNode,
    'db-insert': DatabaseNode,
    // Phase 2 primitive node types (READ)
    'read-terminal': TerminalNode,
    'wait-pattern': TerminalNode,
    'read-env': MemoryReadNode,
    // Phase 2 primitive node types (FLOW)
    repeat: LoopNode,
    pause: DelayNode,
    // Phase 2 primitive node types (SHAPE)
    format: TransformNode,
    validate: TransformNode,
    parse: TransformNode,
    diff: TransformNode,
};

const DEFAULT_START_NODE: Node<WorkflowNodeData> = {
    id: 'start-1',
    type: 'start',
    position: { x: 100, y: 100 },
    data: { label: 'Start' },
};

const defaultEdgeOptions = {
    // We can update this color to match the theme better, or use a CSS variable
    style: { stroke: '#94a3b8', strokeWidth: 2 }, // slate-400
    animated: false,
};

interface WorkflowPaneProps {
    data?: Record<string, unknown>;
    onUpdate?: (data: unknown) => void;
}

function WorkflowLayout({ data, onUpdate }: WorkflowPaneProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { project } = useReactFlow();
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const initialized = useRef(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [inlineRename, setInlineRename] = useState<InlineRenameState | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);

    // Store = single source of truth for nodes/edges
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const applyNodeChanges = useWorkflowStore((s) => s.applyNodeChanges);
    const applyEdgeChanges = useWorkflowStore((s) => s.applyEdgeChanges);
    const storeAddNode = useWorkflowStore((s) => s.addNode);
    const storeAddEdge = useWorkflowStore((s) => s.addEdge);
    const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
    const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
    const workflowName = useWorkflowStore((s) => s.workflowName);
    const variables = useWorkflowStore((s) => s.variables);
    const setNodes = useWorkflowStore((s) => s.setNodes);
    const setEdges = useWorkflowStore((s) => s.setEdges);
    const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
    const executionPanelOpen = useWorkflowStore((s) => s.executionPanelOpen);
    const triggersOpen = useWorkflowStore((s) => s.triggersOpen);
    const toggleTriggersPanel = useWorkflowStore((s) => s.toggleTriggersPanel);
    const liveWireOpen = useWorkflowStore((s) => s.liveWireOpen);
    const toggleLiveWirePanel = useWorkflowStore((s) => s.toggleLiveWirePanel);
    const testRunnerOpen = useWorkflowStore((s) => s.testRunnerOpen);
    const toggleTestRunnerPanel = useWorkflowStore((s) => s.toggleTestRunnerPanel);
    const triggers = useWorkflowStore((s) => s.triggers);
    const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
    const loadEnvVars = useWorkflowStore((s) => s.loadEnvVars);

    // Init triggerManager once
    useEffect(() => {
        triggerManager.init();
        return () => triggerManager.destroy();
    }, []);

    // Load .env vars on mount
    useEffect(() => {
        loadEnvVars().catch(() => { /* no .env file is fine */ });
    }, [loadEnvVars]);

    // Activate/deactivate triggers when they change
    useEffect(() => {
        triggers.forEach((t) => {
            if (t.enabled) {
                triggerManager.activateTrigger(t, () => runWorkflow());
            } else {
                triggerManager.deactivateTrigger(t.id);
            }
        });
    }, [triggers, runWorkflow]);

    // Keyboard shortcuts + layout helpers
    const { handleAutoLayout, handleFitView } = useWorkflowShortcuts();

    // Duplicate a node by id
    const handleDuplicateNode = useCallback((nodeId: string) => {
        const state = useWorkflowStore.getState();
        const original = state.nodes.find((n) => n.id === nodeId);
        if (!original) return;
        const newNode: Node<WorkflowNodeData> = {
            ...original,
            id: `node-${original.type}-${Date.now()}`,
            position: { x: original.position.x + 40, y: original.position.y + 40 },
            selected: false,
            data: { ...original.data },
        };
        state.addNode(newNode);
    }, []);

    // Context menu on node right-click
    const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
        event.preventDefault();
        setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    }, []);

    // Open inline rename for a node
    const handleRenameNode = useCallback((nodeId: string) => {
        const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
        if (!node || !reactFlowInstance) return;
        const { x: fx, y: fy } = node.position;
        const { x: vx, y: vy, zoom } = reactFlowInstance.getViewport();
        const screenX = fx * zoom + vx;
        const screenY = fy * zoom + vy;
        const bounds = reactFlowWrapper.current?.getBoundingClientRect();
        setInlineRename({
            nodeId,
            x: (bounds?.left ?? 0) + screenX + 90 * zoom,
            y: (bounds?.top ?? 0) + screenY + 20 * zoom,
            currentLabel: node.data.label,
        });
    }, [reactFlowInstance]);

    // Double-click on node → inline rename
    const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
        handleRenameNode(node.id);
    }, [handleRenameNode]);

    // Initialize store from saved data (once)
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const savedState = deserializeFromSaveData(data ?? null);
        setNodes(savedState?.nodes ?? [DEFAULT_START_NODE]);
        setEdges(savedState?.edges ?? []);
        if (savedState?.name) {
            setWorkflowName(savedState.name);
        }
    }, []);

    // Auto-save
    useEffect(() => {
        if (!onUpdate) return;
        const timer = setTimeout(() => {
            const saveData = serializeToSaveData(nodes, edges, workflowName, variables);
            // Preserve filePath so pane data keeps track of source file
            const filePath = data?.filePath as string | undefined;
            const dataWithPath = filePath ? { ...saveData, filePath } : saveData;
            onUpdate(dataWithPath);
            // Write back to source file if this workflow was opened from FS
            if (filePath && window.platform?.fs) {
                const definition = {
                    id: `wf-${Date.now()}`,
                    name: workflowName,
                    nodes: (saveData.workflowNodes as unknown[]),
                    edges: (saveData.workflowEdges as unknown[]),
                    variables: saveData.workflowVariables,
                };
                window.platform.fs.writeFile(filePath, JSON.stringify(definition, null, 2))
                    .catch((err: unknown) => console.warn('Failed to write workflow file:', err));
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [nodes, edges, workflowName, variables, onUpdate, data]);

    // Selection -> property panel
    const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
        const id = selectedNodes.length === 1 ? selectedNodes[0].id : null;
        setSelectedNodeId(id);
    }, [setSelectedNodeId]);

    // Connection validation
    const isValidConnection = useCallback((connection: Connection) => {
        if (connection.source === connection.target) return false;

        const currentEdges = useWorkflowStore.getState().edges;
        const duplicate = currentEdges.some(
            (e) =>
                e.source === connection.source &&
                e.target === connection.target &&
                e.sourceHandle === connection.sourceHandle &&
                e.targetHandle === connection.targetHandle
        );
        return !duplicate;
    }, []);

    const onConnect: OnConnect = useCallback(
        (params) => {
            // Add readable labels for condition node source handles
            const label =
                params.sourceHandle === 'true' ? 'Yes' :
                    params.sourceHandle === 'false' ? 'No' :
                        undefined;
            const newEdge = addEdge({ ...params, label }, []);
            if (newEdge.length > 0) {
                storeAddEdge(newEdge[0]);
            }
        },
        [storeAddEdge]
    );

    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            let type = event.dataTransfer.getData(WORKFLOW_DND_NODE_TYPE_MIME);
            let dataString = event.dataTransfer.getData(WORKFLOW_DND_NODE_DATA_MIME);

            if (!type) {
                const payload = parseWorkflowDragPayload(event.dataTransfer.getData('text/plain'));
                if (payload) {
                    type = payload.type;
                    dataString = JSON.stringify(payload.data);
                }
            }

            if (!type || !isWorkflowNodeType(type) || !nodeTypes[type]) {
                return;
            }

            try {
                const parsedData = dataString ? JSON.parse(dataString) as Record<string, unknown> : {};
                const nodeData = normalizeWorkflowNodeData(parsedData, type);

                const toolName = parsedData.label as string | undefined;

                const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
                if (!reactFlowBounds) return;

                const position = reactFlowInstance?.screenToFlowPosition
                    ? reactFlowInstance.screenToFlowPosition({
                        x: event.clientX,
                        y: event.clientY,
                    })
                    : project({
                        x: event.clientX - reactFlowBounds.left,
                        y: event.clientY - reactFlowBounds.top,
                    });

                const newNode: Node<WorkflowNodeData> = {
                    id: `node-${type}-${Date.now()}`,
                    type: type as WorkflowNodeType,
                    position,
                    data: {
                        ...nodeData,
                        toolName: type === 'tool' ? (toolName ?? nodeData.label) : undefined,
                    },
                };

                storeAddNode(newNode);
            } catch (error: unknown) {
                console.error('Workflow drop parsing failed:', error);
            }
        },
        [project, storeAddNode, reactFlowInstance]
    );

    const selectedNode = selectedNodeId
        ? nodes.find((n) => n.id === selectedNodeId)
        : null;

    const [focusMode, setFocusMode] = useState(false);
    const [executionPanelHeight, setExecutionPanelHeight] = useState(300);
    const isResizingPanel = useRef(false);

    // Floating actions
    const handleToggleFocus = () => setFocusMode(!focusMode);

    // Panel Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingPanel.current) return;
            const newHeight = window.innerHeight - e.clientY;
            setExecutionPanelHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 100)));
        };
        const handleMouseUp = () => {
            isResizingPanel.current = false;
            document.body.style.cursor = 'default';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // ... existing Drag/Drops ...
    // (We keep the Drag/Drop logic as is, just inserting the UI changes below)

    return (
        <div className="w-full h-full bg-background flex flex-row overflow-hidden font-sans relative">
            {/* LEFT SIDEBAR (Collapsible) */}
            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden border-r border-border bg-card/95 backdrop-blur-sm z-10",
                focusMode ? "w-0 opacity-0 border-r-0" : "w-64 opacity-100"
            )}>
                <WorkflowSidebar />
            </div>

            <div className="flex-1 flex flex-col h-full min-w-0 relative bg-background/50">
                {/* Main Toolbar - hidden in Full Focus?? Or kept? User said "Top bar collapsible" 
                     Let's keep it but maybe allow hiding. For now, we keep it as it's useful.
                     Actually, user said "top bar collapsible". Let's assume Focus Mode hides it too?
                     Let's hide it in Focus Mode for "Full Focus".
                 */}
                <div className={cn(
                    "transition-all duration-300 overflow-hidden",
                    focusMode ? "h-0 opacity-0" : "h-auto opacity-100"
                )}>
                    <WorkflowToolbar
                        onAutoLayout={handleAutoLayout}
                        onFitView={handleFitView}
                        historyOpen={historyOpen}
                        onToggleHistory={() => setHistoryOpen((v) => !v)}
                        triggersOpen={triggersOpen}
                        onToggleTriggers={toggleTriggersPanel}
                        liveWireOpen={liveWireOpen}
                        onToggleLiveWire={toggleLiveWirePanel}
                        testRunnerOpen={testRunnerOpen}
                        onToggleTestRunner={toggleTestRunnerPanel}
                    />
                </div>

                <div className="flex-1 min-h-0 relative" ref={reactFlowWrapper}>
                    {/* Floating Controls (N8N Style - Bottom Center or Top Center) */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl rounded-full animate-in fade-in slide-in-from-bottom-4">
                        {/* Run Button */}
                        <button
                            onClick={() => useWorkflowStore.getState().runWorkflow()}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all shadow-sm",
                                useWorkflowStore.getState().isExecuting
                                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    : "bg-green-600 text-white hover:bg-green-500 hover:scale-105"
                            )}
                        >
                            {useWorkflowStore.getState().isExecuting ? (
                                <>
                                    <Square size={14} fill="currentColor" />
                                    <span>Stop</span>
                                </>
                            ) : (
                                <>
                                    <Play size={14} fill="currentColor" />
                                    <span>Run</span>
                                </>
                            )}
                        </button>

                        <div className="w-px h-6 bg-border/50 mx-1" />

                        {/* Add Node (Opens sidebar if closed, or just focuses search) */}
                        <button
                            onClick={() => {
                                if (focusMode) setFocusMode(false);
                                // Logic to focus search or open add menu could go here
                            }}
                            className="p-2 hover:bg-accent/50 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            title="Add Node"
                        >
                            <Plus size={18} />
                        </button>

                        {/* Focus Mode Toggle */}
                        <button
                            onClick={handleToggleFocus}
                            className={cn(
                                "p-2 hover:bg-accent/50 rounded-full transition-colors",
                                focusMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Toggle Full Focus Mode"
                        >
                            {focusMode ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>
                    </div>

                    <ErrorBoundary fallbackMessage="Canvas crashed — click Retry to recover">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={applyNodeChanges}
                            onEdgesChange={applyEdgeChanges}
                            onConnect={onConnect}
                            isValidConnection={isValidConnection}
                            defaultEdgeOptions={defaultEdgeOptions}
                            nodeTypes={nodeTypes}
                            onInit={setReactFlowInstance}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onSelectionChange={onSelectionChange}
                            onNodeContextMenu={onNodeContextMenu}
                            onNodeDoubleClick={onNodeDoubleClick}
                            onPaneClick={() => setContextMenu(null)}
                            fitView
                            className="bg-background/50"
                        >
                            <Background color="#555" gap={16} />
                            <Controls position="bottom-right" className="!m-4 !bg-card/80 !backdrop-blur !border-border" />
                            <MiniMap
                                nodeStrokeColor="#333"
                                nodeColor="#000"
                                nodeBorderRadius={8}
                                maskColor="rgba(0, 0, 0, 0.3)"
                                style={{ backgroundColor: '#111', bottom: 16, right: 60 }}
                            />
                        </ReactFlow>
                    </ErrorBoundary>

                    {contextMenu && (
                        <WorkflowContextMenu
                            menu={contextMenu}
                            onClose={() => setContextMenu(null)}
                            onDuplicate={handleDuplicateNode}
                            onRename={handleRenameNode}
                        />
                    )}
                    {inlineRename && (
                        <InlineRename
                            rename={inlineRename}
                            onClose={() => setInlineRename(null)}
                        />
                    )}
                </div>

                {/* Resizable Execution Panel */}
                {executionPanelOpen && (
                    <div
                        className="absolute inset-x-0 bottom-0 bg-background border-t border-border shadow-2xl z-20 flex flex-col"
                        style={{ height: executionPanelHeight }}
                    >
                        {/* Drag Handle */}
                        <div
                            className="h-1.5 w-full bg-border/30 hover:bg-primary/50 cursor-ns-resize flex items-center justify-center transition-colors"
                            onMouseDown={() => {
                                isResizingPanel.current = true;
                                document.body.style.cursor = 'ns-resize';
                            }}
                        >
                            <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
                        </div>

                        <ErrorBoundary fallbackMessage="Execution panel crashed">
                            <ExecutionPanel />
                        </ErrorBoundary>
                    </div>
                )}
            </div>

            {/* RIGHT SIDEBAR (Collapsible) */}
            <div className={cn(
                "transition-all duration-300 ease-in-out border-l border-border bg-card/95 backdrop-blur-sm flex flex-col h-full overflow-hidden z-10",
                focusMode ? "w-0 opacity-0 border-l-0" : "w-80 opacity-100"
            )}>
                {historyOpen ? (
                    <ErrorBoundary fallbackMessage="History panel crashed">
                        <HistoryPanel />
                    </ErrorBoundary>
                ) : triggersOpen ? (
                    <ErrorBoundary fallbackMessage="Triggers panel crashed">
                        <TriggerPanel />
                    </ErrorBoundary>
                ) : liveWireOpen ? (
                    <ErrorBoundary fallbackMessage="Live wire panel crashed">
                        <LiveWirePanel />
                    </ErrorBoundary>
                ) : testRunnerOpen ? (
                    <ErrorBoundary fallbackMessage="Test runner panel crashed">
                        <TestRunnerPanel />
                    </ErrorBoundary>
                ) : (
                    <ErrorBoundary fallbackMessage="Panel crashed">
                        {selectedNodeId && selectedNode ? (
                            <PropertyPanel
                                nodeId={selectedNodeId}
                                nodeData={selectedNode.data}
                                nodeType={selectedNode.type}
                            />
                        ) : (
                            <VariableEditor />
                        )}
                    </ErrorBoundary>
                )}
            </div>
        </div>
    );
}

export default function WorkflowPane({ data, onUpdate }: WorkflowPaneProps) {
    return (
        <ReactFlowProvider>
            <WorkflowLayout data={data} onUpdate={onUpdate} />
        </ReactFlowProvider>
    );
}
