import type { Node, Edge } from 'reactflow';
import type { WorkflowNodeData } from './types';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
    variables?: Record<string, unknown>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'blank',
        name: 'Blank',
        description: 'A single start node to begin from scratch.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 80, y: 150 }, data: { label: 'Start' } },
        ],
        edges: [],
    },
    {
        id: 'simple-tool',
        name: 'Single Tool',
        description: 'Start → Tool → End pipeline.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 60, y: 150 }, data: { label: 'Start' } },
            { id: 'tool-1', type: 'tool', position: { x: 260, y: 150 }, data: { label: 'Tool', toolName: '' } },
            { id: 'end-1', type: 'end', position: { x: 460, y: 150 }, data: { label: 'End' } },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'tool-1' },
            { id: 'e2', source: 'tool-1', target: 'end-1' },
        ],
    },
    {
        id: 'if-else',
        name: 'If / Else Branch',
        description: 'Start → Condition with Yes/No branches → Merge → End.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 60, y: 200 }, data: { label: 'Start' } },
            { id: 'cond-1', type: 'condition', position: { x: 260, y: 200 }, data: { label: 'Check', conditionExpression: '' } },
            { id: 'tool-yes', type: 'tool', position: { x: 480, y: 100 }, data: { label: 'On Yes', toolName: '' } },
            { id: 'tool-no', type: 'tool', position: { x: 480, y: 300 }, data: { label: 'On No', toolName: '' } },
            { id: 'merge-1', type: 'merge', position: { x: 700, y: 200 }, data: { label: 'Merge' } },
            { id: 'end-1', type: 'end', position: { x: 900, y: 200 }, data: { label: 'End' } },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'cond-1' },
            { id: 'e2', source: 'cond-1', target: 'tool-yes', sourceHandle: 'true', label: 'Yes' },
            { id: 'e3', source: 'cond-1', target: 'tool-no', sourceHandle: 'false', label: 'No' },
            { id: 'e4', source: 'tool-yes', target: 'merge-1' },
            { id: 'e5', source: 'tool-no', target: 'merge-1' },
            { id: 'e6', source: 'merge-1', target: 'end-1' },
        ],
    },
    {
        id: 'http-transform',
        name: 'HTTP → Transform',
        description: 'Fetch data via HTTP, transform the result, then end.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 60, y: 150 }, data: { label: 'Start' } },
            { id: 'http-1', type: 'http', position: { x: 260, y: 150 }, data: { label: 'Fetch Data', httpMethod: 'GET', httpUrl: '' } },
            { id: 'transform-1', type: 'transform', position: { x: 480, y: 150 }, data: { label: 'Transform', transformCode: 'return { result: inputs.body };' } },
            { id: 'end-1', type: 'end', position: { x: 700, y: 150 }, data: { label: 'End' } },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'http-1' },
            { id: 'e2', source: 'http-1', target: 'transform-1' },
            { id: 'e3', source: 'transform-1', target: 'end-1' },
        ],
    },
    {
        id: 'terminal-test',
        name: 'Terminal Command',
        description: 'Run a shell command in a Terminal pane and capture the output.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 60, y: 150 }, data: { label: 'Start' } },
            {
                id: 'terminal-1',
                type: 'terminal',
                position: { x: 280, y: 150 },
                data: {
                    label: 'Run Command',
                    terminalPaneId: '',
                    terminalCommand: 'echo Hello from Leion!',
                },
            },
            {
                id: 'transform-1',
                type: 'transform',
                position: { x: 520, y: 150 },
                data: {
                    label: 'Show Output',
                    transformCode: 'return { output: inputs.stdout, exitCode: inputs.exitCode };',
                },
            },
            { id: 'end-1', type: 'end', position: { x: 760, y: 150 }, data: { label: 'End' } },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'terminal-1' },
            { id: 'e2', source: 'terminal-1', target: 'transform-1' },
            { id: 'e3', source: 'transform-1', target: 'end-1' },
        ],
    },
    {
        id: 'parallel-tools',
        name: 'Parallel Tools',
        description: 'Run two tools in parallel, then merge results.',
        nodes: [
            { id: 'start-1', type: 'start', position: { x: 60, y: 200 }, data: { label: 'Start' } },
            { id: 'tool-a', type: 'tool', position: { x: 280, y: 100 }, data: { label: 'Tool A', toolName: '' } },
            { id: 'tool-b', type: 'tool', position: { x: 280, y: 300 }, data: { label: 'Tool B', toolName: '' } },
            { id: 'merge-1', type: 'merge', position: { x: 500, y: 200 }, data: { label: 'Merge' } },
            { id: 'end-1', type: 'end', position: { x: 700, y: 200 }, data: { label: 'End' } },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'tool-a' },
            { id: 'e2', source: 'start-1', target: 'tool-b' },
            { id: 'e3', source: 'tool-a', target: 'merge-1' },
            { id: 'e4', source: 'tool-b', target: 'merge-1' },
            { id: 'e5', source: 'merge-1', target: 'end-1' },
        ],
    },
];
