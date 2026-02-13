import type { NodeProps } from 'reactflow';
import { Flag } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';

export default function RaceNode(props: NodeProps<WorkflowNodeData>) {
    return (
        <BaseNode
            {...props}
            icon={<Flag size={16} />}
            className="w-56 border-l-4 border-l-orange-500"
        >
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Race Mode</span>
                    <Badge variant="secondary" className="text-[10px] h-5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        First finishes
                    </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                    Continues when the first input branch completes.
                </div>
            </div>
        </BaseNode>
    );
}
