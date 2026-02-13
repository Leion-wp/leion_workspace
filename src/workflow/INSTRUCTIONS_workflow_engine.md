# Workflow Engine & UI Implementation Plan

This document outlines the detailed implementation plan for the **Workflow Engine** (logic) and **Workflow Pane** (UI) for the Leion Workspace.
The goal is to create a robust, Node-based automation system using **ReactFlow** for the UI and a custom **DAG (Directed Acyclic Graph) Engine** for execution.

---

## 1. Core Architecture & Types

The workflow system is divided into two parts:
1.  **Definition**: The static graph structure (Nodes, Edges, Configuration).
2.  **Execution**: The runtime state, traversal logic, and data passing.

### 1.1 Data Structures (`src/workflow/types.ts`)

Define strict types for the graph.

```typescript
export type WorkflowNodeType = 'start' | 'end' | 'tool' | 'logic-if' | 'logic-loop';

export interface WorkflowNodeData {
    label: string;
    description?: string;
    // For Tools:
    toolName?: string;
    inputSchema?: Record<string, any>; // JSON Schema for inputs
    // For Logic:
    condition?: string; // JavaScript expression or JMESPath
    // Runtime values (configured by user)
    inputs?: Record<string, any>; 
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    nodes: Node<WorkflowNodeData>[]; // ReactFlow Node
    edges: Edge[]; // ReactFlow Edge
    variables: Record<string, any>; // Global variables
}

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    stepResults: Record<string, StepResult>; // key = nodeId
    variables: Record<string, any>;
    logs: string[];
}

export interface StepResult {
    nodeId: string;
    status: 'success' | 'error' | 'skipped';
    output: any;
    error?: string;
    startTime: number;
    endTime: number;
}
```

---

## 2. Workflow Engine (`src/workflow/engine/`)

The engine is responsible for traversing the graph and executing nodes.

### 2.1 Topological Sort & Traversal (`GraphEngine.ts`)
-   **Algorithm**: Use Kahn's algorithm or DFS to determine execution order.
-   **Parallelism**: Identify nodes that can run in parallel (branches).
-   **Cycle Detection**: Prevent execution if cycles exist (unless strictly looped logic is implemented).

### 2.2 Node Execution Logic (`NodeExecutor.ts`)
Create a strategy pattern for executing different node types:

1.  **ToolNode**:
    -   Inputs: Map data from previous nodes (e.g., `{{prevNode.output.someField}}`) to tool arguments.
    -   Action: Call `mcpClient.callTool(toolName, args)`.
    -   Output: The tool result.
2.  **LogicNode (If/Else)**:
    -   Evaluate condition.
    -   Return which output handle to follow (`true` or `false`).
3.  **StartNode**: Initialize context.
4.  **EndNode**: Return final workflow result.

### 2.3 Data Interpolation (`DataMapper.ts`)
-   Implement a helper to resolve variables in inputs.
-   Syntax: `{{steps.nodeId.output.value}}` or `{{variables.apiKey}}`.
-   Use a safe evaluation method (e.g., `lodash.get` or a simple template engine).

---

## 3. Workflow UI (`src/panes/WorkflowPane.tsx`)

The UI must handle Drag & Drop, Node Configuration, and Visual Feedback.

### 3.1 Drag & Drop Implementation (CRITICAL)
We have identified the **exact working pattern** for DnD in this environment. **Do not deviate.**

**Sidebar (`WorkflowSidebar.tsx`):**
```typescript
const onDragStart = (event, type, data) => {
    event.dataTransfer.setData('application/reactflow/type', type);
    event.dataTransfer.setData('application/reactflow/data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
};
```

**Drop Zone (`WorkflowPane.tsx`):**
```typescript
const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow/type');
    const dataString = event.dataTransfer.getData('application/reactflow/data');
    
    // CRITICAL: Use screenToFlowPosition for accurate placement
    const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
    });
    
    // Create Node...
}, [reactFlowInstance]);
```

### 3.2 Custom Nodes
Implement distinct UI components for each node type in `src/workflow/nodes/`:
-   **`ToolNode.tsx`**: Display tool name, quick status icon (✅/❌), and a button to open configuration.
-   **`ControlNode.tsx`**: Diamond shape for If/Else.
-   **Visuals**: Use Handle components to limit connections (e.g., Logic nodes have 'true' and 'false' source handles).

### 3.3 Property Panel (`src/workflow/ui/PropertyPanel.tsx`)
-   When a node is selected, show a side panel (or modal) to configure inputs.
-   **Input Mapping**: Allow users to enter static values OR drag connections from other nodes' outputs (visual mapping).

---

## 4. Integration & Execution

### 4.1 Running a Workflow
-   Add a **"Run"** button in the toolbar.
-   **Execution Flow**:
    1.  Serialize current ReactFlow graph to `WorkflowDefinition`.
    2.  Instantiate `GraphEngine`.
    3.  Call `engine.execute()`.
-   **Visual Feedback**:
    -   Highlight currently running node (add class `.running` to Node).
    -   Show success/error borders on completion.
    -   Animate edges for data flow.

### 4.2 State Persistence
-   Use `useLayoutStore` or a dedicated `WorkflowStore` to save workflows to disk (JSON files).
-   Auto-save functionality.

---

## 5. Next Steps Checklist for Implementation

1.  **[ ] Engine Scaffolding**: Create `src/workflow/engine` and implement `executeGraph`.
2.  **[ ] Node Executor**: Implement `ToolNode` execution using actual MCP client.
3.  **[ ] UI Polish**: Apply the DnD fixes and ensure `react-mosaic` doesn't interfere (use portal or direct render if needed).
4.  **[ ] Input Interpolation**: Implement the `{{...}}` variable replacement logic.
5.  **[ ] Testing**: Create a simple workflow: `Start -> List Directory -> Read File -> End` and run it.
