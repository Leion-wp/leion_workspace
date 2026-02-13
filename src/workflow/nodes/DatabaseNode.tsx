import type { NodeProps } from 'reactflow';
import { Database } from 'lucide-react';
import type { WorkflowNodeData } from '../types';
import { BaseNode } from './BaseNode';
import { Badge } from '../../components/ui/badge';
import { OutputBadge } from './OutputBadge';

export default function DatabaseNode(props: NodeProps<WorkflowNodeData>) {
    const { id, data } = props;
    const op = data.databaseOperation ?? 'query';
    const sqlPreview = data.databaseSql
        ? data.databaseSql.replace(/\s+/g, ' ').trim().slice(0, 40) + (data.databaseSql.length > 40 ? '\u2026' : '')
        : '';
    const pathPreview = data.databasePath ?? ':memory:';

    return (
        <BaseNode
            {...props}
            icon={<Database size={16} />}
            className="w-72"
        >
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">
                        {op}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground truncate flex-1" title={pathPreview}>
                        {pathPreview}
                    </span>
                </div>

                {sqlPreview ? (
                    <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded border border-border/50 break-words">
                        {sqlPreview}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic">No SQL set</div>
                )}
            </div>
            <OutputBadge nodeId={id} className="absolute -bottom-3 right-4 z-10" />
        </BaseNode>
    );
}
