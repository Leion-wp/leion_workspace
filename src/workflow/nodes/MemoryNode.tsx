import type { NodeProps } from 'reactflow';
import { BookOpen, BookMarked, SlidersHorizontal } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export function MemoryReadNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    return (
        <BaseNode
            {...props}
            icon={<BookOpen size={16} />}
            className="w-56"
        >
            <div className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Read Key</span>
                    <Badge variant="outline" className="text-[10px] h-5">MEMORY</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-all">
                    {data.memoryKey || 'No key set'}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}

export function MemoryWriteNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    return (
        <BaseNode
            {...props}
            icon={<BookMarked size={16} />}
            className="w-56"
        >
            <div className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Write Key</span>
                    <Badge variant="secondary" className="text-[10px] h-5">MEMORY</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-all">
                    {data.memoryKey || 'No key set'}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}

export function VariableNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    return (
        <BaseNode
            {...props}
            icon={<SlidersHorizontal size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Variable</span>
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">VAR</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-all">
                    {data.memoryKey ? (
                        <>
                            <span className="text-primary">var</span> {data.memoryKey}
                            {data.memoryValue && <span className="text-muted-foreground"> = {data.memoryValue}</span>}
                        </>
                    ) : (
                        'No variable set'
                    )}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
