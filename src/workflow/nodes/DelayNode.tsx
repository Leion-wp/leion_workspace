import type { NodeProps } from 'reactflow';
import { Timer } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';

export default function DelayNode(props: NodeProps<WorkflowNodeData>) {
    const { data } = props;
    const ms = data.delayMs ?? 1000;
    const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

    return (
        <BaseNode
            {...props}
            icon={<Timer size={16} />}
            className="w-48"
        >
            <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Wait:</span>
                <Badge variant="secondary" className="font-mono text-xs">{label}</Badge>
            </div>
        </BaseNode>
    );
}
