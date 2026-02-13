import { useWorkflowStore } from '../store';
import { cn } from '../../lib/utils';

/**
 * Small badge shown on a node after successful execution,
 * summarizing the output (key count or value preview).
 */
export function OutputBadge({ nodeId, className }: { nodeId: string; className?: string }) {
    const stepResult = useWorkflowStore((s) => s.executionContext?.stepResults[nodeId] ?? null);

    if (!stepResult || stepResult.status !== 'success') return null;

    const output = stepResult.output;
    let preview = '';

    if (output === null || output === undefined) {
        preview = 'null';
    } else if (typeof output === 'object' && !Array.isArray(output)) {
        const keys = Object.keys(output as object);
        preview = keys.length === 1 ? keys[0] : `${keys.length} keys`;
    } else if (Array.isArray(output)) {
        preview = `[${output.length}]`;
    } else {
        const str = String(output);
        preview = str.length > 20 ? str.slice(0, 20) + '…' : str;
    }

    return (
        <div className={cn('output-badge', className)} title={JSON.stringify(output, null, 2)}>
            {preview}
        </div>
    );
}
