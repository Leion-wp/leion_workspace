import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, RefreshCw } from 'lucide-react';
import { useFsStore } from '../shell/useFsStore';
import { FileTreeNode } from '../shell/FileTreeNode';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

interface PaneFileExplorerProps {
    rootPath: string;
    onOpenFile: (path: string, name: string) => void;
    onRootChange?: (newRoot: string) => void;
}

export function PaneFileExplorer({ rootPath, onOpenFile, onRootChange }: PaneFileExplorerProps) {
    const rootEntries = useFsStore((s) => s.cache[rootPath]);
    const isLoading = useFsStore((s) => s.isLoading(rootPath));
    const loadDir = useFsStore((s) => s.loadDir);
    const refresh = useFsStore((s) => s.refresh);

    // Load root on mount or change
    useEffect(() => {
        loadDir(rootPath);
    }, [rootPath, loadDir]);

    const handleOpenFolder = async () => {
        if (!window.platform?.fs) return;
        const picked = await window.platform.fs.openFolderDialog();
        if (picked && onRootChange) {
            onRootChange(picked);
        }
    };

    const rootName = rootPath.split(/[\\/]/).filter(Boolean).pop() ?? rootPath;

    return (
        <div className="flex flex-col h-full bg-[#252526] border-r border-[#2d2d2d] w-64 min-w-[160px]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-[#cccccc] hover:text-white group bg-[#252526]">
                <span className="truncate font-bold uppercase tracking-wider" title={rootPath}>
                    {rootName}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-[#3e3e42] text-[#cccccc]"
                        onClick={() => refresh(rootPath)}
                        title="Refresh"
                    >
                        <RefreshCw size={12} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-[#3e3e42] text-[#cccccc]"
                        onClick={handleOpenFolder}
                        title="Change Folder"
                    >
                        <FolderOpen size={12} />
                    </Button>
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                {isLoading && <div className="text-xs text-[#666666] px-2 py-1">Loading…</div>}
                {!isLoading && !rootEntries && (
                    <div className="text-xs text-red-400 px-2 py-1">Unable to read directory</div>
                )}
                {rootEntries?.map((entry) => (
                    <FileTreeNode
                        key={entry.path}
                        entry={entry}
                        depth={0}
                        onOpenFile={onOpenFile}
                    />
                ))}
                {!isLoading && rootEntries?.length === 0 && (
                    <div className="text-xs text-[#666666] px-2 py-1 italic">Empty folder</div>
                )}
            </div>
        </div>
    );
}
