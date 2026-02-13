import type { NodeProps } from 'reactflow';
import { Bell } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { OutputBadge } from './OutputBadge';

export default function NotifyNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const titlePreview = data.notifyTitle || data.label || 'Notification';
    const bodyPreview = data.notifyBody
        ? (data.notifyBody.length > 40 ? data.notifyBody.slice(0, 40) + '\u2026' : data.notifyBody)
        : null;

    return (
        <BaseNode
            {...props}
            icon={<Bell size={16} />}
            className="w-64"
        >
            <div className="p-4 space-y-2">
                <div className="text-sm font-semibold truncate" title={titlePreview}>
                    {titlePreview}
                </div>
                {bodyPreview && (
                    <div className="text-xs text-muted-foreground line-clamp-2" title={data.notifyBody}>
                        {bodyPreview}
                    </div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
