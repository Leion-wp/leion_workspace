import type { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function GitNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const op = data.gitOperation ?? 'status';
    const detail = data.gitBranch || data.gitMessage || data.gitWorkingDir || '';
    const detailPreview = detail.length > 25 ? detail.slice(0, 25) + '\u2026' : detail;

    return (
        <BaseNode
            {...props}
            icon={<GitBranch size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize h-5 px-1.5 text-[10px] bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800">
                        {op}
                    </Badge>
                    {detailPreview ? (
                        <span className="text-xs font-mono text-muted-foreground truncate flex-1" title={detail}>
                            {detailPreview}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground italic flex-1">No details</span>
                    )}
                </div>
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
