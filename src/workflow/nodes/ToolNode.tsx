import { type NodeProps } from 'reactflow';
import { Wrench } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function ToolNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    return (
        <BaseNode
            {...props}
            icon={<Wrench size={16} />}
            className="w-64"
        >
            <div className="flex flex-col gap-2">
                <div className="text-xs text-muted-foreground/80 line-clamp-2">
                    {data.description || 'Executes a tool action based on input parameters.'}
                </div>
                <OutputBadge nodeId={id} />
                {data.toolName && (
                    <div className="mt-2 text-[10px] font-mono bg-secondary/50 p-1 rounded text-secondary-foreground truncate">
                        {data.toolName}
                    </div>
                )}
            </div>
        </BaseNode>
    );
}
