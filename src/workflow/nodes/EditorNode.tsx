import type { NodeProps } from 'reactflow';
import { FileCode } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function EditorNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const op = data.editorOperation ?? 'read';
    const preview = data.editorContent
        ? (data.editorContent.length > 28 ? data.editorContent.slice(0, 28) + '…' : data.editorContent)
        : null;

    return (
        <BaseNode
            {...props}
            icon={<FileCode size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Editor</span>
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">{op}</Badge>
                </div>

                {preview ? (
                    <div className="text-xs font-mono text-muted-foreground p-2 bg-muted/30 rounded border border-border/30 truncate" title={data.editorContent}>
                        {preview}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">
                        {op === 'read' ? 'Reads editor content' : 'No content set'}
                    </div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
