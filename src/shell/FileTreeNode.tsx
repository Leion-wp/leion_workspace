import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileCode, FileJson, FileType } from 'lucide-react';
import { useFsStore } from './useFsStore';
import { cn } from '../lib/utils';

interface Props {
    entry: FsEntry;
    depth: number;
    onOpenFile: (path: string, name: string) => void;
}

function getFileIcon(entry: FsEntry) {
    if (entry.isDirectory) return Folder;
    if (entry.name.endsWith('.json')) return FileJson;
    if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) return FileCode;
    if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) return FileCode;
    if (entry.name.endsWith('.css')) return FileType;
    return File;
}

function isWorkflowJson(entry: FsEntry): boolean {
    return entry.extension === '.json' && (
        entry.name.includes('workflow') ||
        entry.name.includes('flow') ||
        entry.name.includes('wf-')
    );
}

export function FileTreeNode({ entry, depth, onOpenFile }: Props) {
    const toggleExpand = useFsStore((s) => s.toggleExpand);
    const isExpanded = useFsStore((s) => s.isExpanded(entry.path));
    const isLoading = useFsStore((s) => s.isLoading(entry.path));
    const children = useFsStore((s) => s.cache[entry.path]);

    const indent = depth * 12;
    const Icon = getFileIcon(entry);
    const isWorkflow = isWorkflowJson(entry);

    if (entry.isDirectory) {
        return (
            <div>
                <div
                    className={cn(
                        "flex items-center gap-1.5 py-1 pr-2 rounded-sm cursor-pointer select-none transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        isExpanded && "text-foreground"
                    )}
                    style={{ paddingLeft: `${8 + indent}px` }}
                    onClick={() => toggleExpand(entry.path)}
                    title={entry.path}
                >
                    <span className="text-muted-foreground/70">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="text-blue-400">
                        {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                    </span>
                    <span className="truncate text-xs">{entry.name}</span>
                    {isLoading && <span className="animate-spin ml-auto text-xs">⟳</span>}
                </div>
                {isExpanded && children && (
                    <div>
                        {children.map((child) => (
                            <FileTreeNode
                                key={child.path}
                                entry={child}
                                depth={depth + 1}
                                onOpenFile={onOpenFile}
                            />
                        ))}
                        {children.length === 0 && (
                            <div className="text-[10px] text-muted-foreground italic py-1" style={{ paddingLeft: `${8 + indent + 24}px` }}>
                                empty
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('leion/filepath', entry.path);
        e.dataTransfer.setData('text/plain', entry.path);
        e.dataTransfer.effectAllowed = 'copy';
        // Add a nice drag image if possible, or just let browser handle it
    };

    return (
        <div
            className={cn(
                "flex items-center gap-2 py-1 pr-2 rounded-sm cursor-pointer select-none transition-colors hover:bg-accent/50 group",
                isWorkflow ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
            )}
            style={{ paddingLeft: `${8 + indent + 16}px` }}
            onClick={() => onOpenFile(entry.path, entry.name)}
            title={`Click to open\n${entry.path}`}
            draggable
            onDragStart={handleDragStart}
        >
            <span className={cn(isWorkflow ? "text-amber-400" : "text-muted-foreground/70 group-hover:text-foreground/70")}>
                {isWorkflow ? <FileJson size={14} /> : <Icon size={14} />}
            </span>
            <span className="truncate text-xs">{entry.name}</span>
        </div>
    );
}
