import type { NodeProps } from 'reactflow';
import { FolderOpen } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function FileNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const op = data.fileOperation ?? 'read';
    const pathPreview = data.filePath
        ? (data.filePath.length > 28 ? '\u2026' + data.filePath.slice(-28) : data.filePath)
        : null;

    return (
        <BaseNode
            {...props}
            icon={<FolderOpen size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Badge variant={op === 'write' ? 'destructive' : 'secondary'} className="capitalize h-5 px-1.5 text-[10px]">
                        {op}
                    </Badge>
                    {pathPreview ? (
                        <span className="text-xs font-mono text-muted-foreground truncate flex-1" title={data.filePath}>
                            {pathPreview}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground italic flex-1">No path set</span>
                    )}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
