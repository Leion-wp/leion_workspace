import type { NodeProps } from 'reactflow';
import { Layout } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function SpaceNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;

    return (
        <BaseNode
            {...props}
            icon={<Layout size={16} />}
            className="w-56"
        >
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Target Space</span>
                    {data.targetSpaceId ? (
                        <Badge variant="secondary" className="font-mono text-[10px] h-5">Space {data.targetSpaceId}</Badge>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
