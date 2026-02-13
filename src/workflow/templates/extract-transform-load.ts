import type { WorkflowTemplate } from './types';

export const extractTransformLoadTemplate: WorkflowTemplate = {
    id: 'extract-transform-load',
    name: 'Extract Transform Load (ETL)',
    description: 'Read a source file, parse and filter records via transform, write to destination, and notify with count.',
    category: 'files',
    tags: ['etl', 'file', 'transform', 'data', 'pipeline'],
    definition: {
        name: 'Extract Transform Load (ETL)',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 150 },
                data: { label: 'Start' },
            },
            {
                id: 'read-file-1',
                type: 'read-file',
                position: { x: 330, y: 150 },
                data: {
                    label: 'Extract: Read Source',
                    filePath: '{{variables.source}}',
                },
            },
            {
                id: 'transform-1',
                type: 'transform',
                position: { x: 580, y: 150 },
                data: {
                    label: 'Transform: Parse & Filter',
                    transformCode: `const raw = inputs.content ?? '';
let records = [];
try {
  // Try JSON array first
  records = JSON.parse(raw);
  if (!Array.isArray(records)) records = [records];
} catch {
  // Fallback: treat each non-empty line as a record
  records = raw.split('\\n').filter(l => l.trim());
}
// Filter out empty / null records
const filtered = records.filter(r => r !== null && r !== undefined && r !== '');
return {
  records: filtered,
  count: filtered.length,
  output: JSON.stringify(filtered, null, 2),
};`,
                },
            },
            {
                id: 'write-file-1',
                type: 'write-file',
                position: { x: 830, y: 150 },
                data: {
                    label: 'Load: Write Destination',
                    filePath: '{{variables.dest}}',
                    fileContent: '{{steps["transform-1"].output.output}}',
                },
            },
            {
                id: 'notify-1',
                type: 'notify',
                position: { x: 1080, y: 150 },
                data: {
                    label: 'Notify Complete',
                    notifyTitle: 'ETL Complete',
                    notifyBody: 'ETL complete: {{steps["transform-1"].output.count}} records processed',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 1330, y: 150 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'read-file-1' },
            { id: 'e2', source: 'read-file-1', target: 'transform-1' },
            { id: 'e3', source: 'transform-1', target: 'write-file-1' },
            { id: 'e4', source: 'write-file-1', target: 'notify-1' },
            { id: 'e5', source: 'notify-1', target: 'end-1' },
        ],
        variables: {
            source: '/path/to/source.json',
            dest: '/path/to/output.json',
        },
    },
};
