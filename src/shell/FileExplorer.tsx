import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, RefreshCw } from 'lucide-react';
import { useFsStore } from './useFsStore';
import { FileTreeNode } from './FileTreeNode';
import { useLayoutStore } from '../layout/store';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export function FileExplorer() {
    const [open, setOpen] = useState(true);
    const rootPath = useFsStore((s) => s.rootPath);
    const rootEntries = useFsStore((s) => s.cache[s.rootPath]);
    const isLoading = useFsStore((s) => s.isLoading(s.rootPath));
    const loadDir = useFsStore((s) => s.loadDir);
    const refresh = useFsStore((s) => s.refresh);
    const setRootPath = useFsStore((s) => s.setRootPath);
    const openWorkflowFile = useLayoutStore((s) => s.openWorkflowFile);

    // Load root on mount
    useEffect(() => {
        loadDir(rootPath);
    }, [rootPath, loadDir]);

    const handleOpenFolder = async () => {
        const picked = await window.platform.fs.openFolderDialog();
        if (picked) setRootPath(picked);
    };

    const handleOpenFile = async (filePath: string, fileName: string) => {
        if (!fileName.endsWith('.json')) return;
        try {
            const content = await window.platform.fs.readFile(filePath);
            const parsed = JSON.parse(content);
            openWorkflowFile(filePath, parsed);
        } catch (err) {
            console.warn('Failed to open file:', filePath, err);
        }
    };

    const rootName = rootPath.split('/').filter(Boolean).pop() ?? rootPath;

    return (
        <div className={cn(
            "flex flex-col border-r border-border/40 bg-secondary/20 transition-all duration-300 ease-in-out",
            open ? "w-64" : "w-8"
        )}>
            <div
                className="h-8 flex items-center px-2 cursor-pointer hover:bg-accent/50 select-none border-b border-border/40"
                onClick={() => setOpen((v) => !v)}
            >
                <div className="flex items-center justify-center w-4 text-muted-foreground">
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {open && <span className="ml-2 text-xs font-semibold tracking-wider text-muted-foreground">EXPLORER</span>}
            </div>

            {open && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground group">
                        <span className="truncate" title={rootPath}>
                            {rootName}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => refresh(rootPath)}
                                title="Refresh"
                            >
                                <RefreshCw size={12} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={handleOpenFolder}
                                title="Open folder"
                            >
                                <FolderOpen size={12} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                        {isLoading && <div className="text-xs text-muted-foreground px-2 py-1">Loading…</div>}
                        {!isLoading && !rootEntries && (
                            <div className="text-xs text-destructive px-2 py-1">Unable to read directory</div>
                        )}
                        {rootEntries?.map((entry) => (
                            <FileTreeNode
                                key={entry.path}
                                entry={entry}
                                depth={0}
                                onOpenFile={handleOpenFile}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
