import type { NodeProps } from 'reactflow';
import type { WorkflowNodeData } from '../types';
import { Repeat } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';

export default function LoopNode(props: NodeProps<WorkflowNodeData>) {
    const { data } = props;
    const count = data.loopCount ?? 3;
    const hasExpression = !!data.loopItemsExpression?.trim();

    return (
        <BaseNode
            {...props}
            icon={<Repeat size={16} />}
            className="w-56"
        >
            <div className="p-4 flex items-center gap-2">
                <span className="text-sm font-medium">Mode:</span>
                {hasExpression ? (
                    <Badge variant="secondary" className="font-mono text-xs">Each Item</Badge>
                ) : (
                    <Badge variant="outline" className="font-mono text-xs">{count} times</Badge>
                )}
            </div>
        </BaseNode>
    );
}
