import { useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { usePaneStateStore } from './paneStateStore';
import { useState } from 'react';
import { Layout, X, Plus, Circle, FileCode, ChevronRight, GitBranch } from 'lucide-react';
import { PaneFileExplorer } from './PaneFileExplorer';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../store/settings';
import './EditorPane.css';

interface EditorFile {
    path: string;
    content: string;
    language: string;
    isDirty: boolean;
}

const detectLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() || 'txt';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        json: 'json', html: 'html', css: 'css', md: 'markdown', py: 'python'
    };
    return langMap[ext] || 'plaintext';
}

// --- COMPONENTS ---

interface EditorPaneProps {
    id: string;
    data?: Record<string, unknown> & { lastPaste?: number };
    onUpdate?: (data: unknown) => void;
}

export function EditorPane({ id, data, onUpdate }: EditorPaneProps) {
    const [files, setFiles] = useState<EditorFile[]>(() => {
        if (Array.isArray(data?.editorFiles)) {
            return (data.editorFiles as EditorFile[]).map((file) => ({
                ...file,
                language: file.language || detectLanguage(file.path),
                isDirty: Boolean(file.isDirty),
            }))
        }
        return []
    })
    const [activePath, setActivePath] = useState<string | null>(() => typeof data?.editorActivePath === 'string' ? data.editorActivePath : null)
    const activeFile = files.find(f => f.path === activePath);
    const theme = useSettingsStore((state) => state.theme);

    // --- WORKSPACE STATE ---
    const [showSidebar, setShowSidebar] = useState(Boolean(data?.editorShowSidebar));
    const [rootPath, setRootPath] = useState<string>(typeof data?.editorRootPath === 'string' ? data.editorRootPath : '');

    const addFile = (path: string, content: string) => {
        setFiles((currentFiles) => {
            if (currentFiles.some((file) => file.path === path)) {
                setActivePath(path)
                return currentFiles
            }

            return [
                ...currentFiles,
                { path, content, language: detectLanguage(path), isDirty: false }
            ]
        })
        setActivePath(path)
    }

    const closeFile = (path: string) => {
        setFiles((currentFiles) => {
            const newFiles = currentFiles.filter((file) => file.path !== path)
            setActivePath((currentActivePath) => {
                if (currentActivePath !== path) return currentActivePath
                return newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null
            })
            return newFiles
        })
    }

    const setActive = (path: string) => setActivePath(path)

    const updateFileContent = (path: string, content: string) => {
        setFiles((currentFiles) => currentFiles.map((file) =>
            file.path === path ? { ...file, content, isDirty: true } : file
        ))
    }

    const setDirty = (path: string, dirty: boolean) => {
        setFiles((currentFiles) => currentFiles.map((file) =>
            file.path === path ? { ...file, isDirty: dirty } : file
        ))
    }

    const handlePaneOpenFile = async (path: string, _name: string) => {
        if (!window.platform?.fs) return;
        try {
            const content = await window.platform.fs.readFile(path);
            addFile(path, content);
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    };

    // Initial Load & Sync from props
    useEffect(() => {
        if (typeof data?.editorRootPath === 'string' && data.editorRootPath !== rootPath) {
            setRootPath(data.editorRootPath)
        }
        if (typeof data?.editorShowSidebar === 'boolean' && data.editorShowSidebar !== showSidebar) {
            setShowSidebar(data.editorShowSidebar)
        }
        if (Array.isArray(data?.editorFiles)) {
            const nextFiles = (data.editorFiles as EditorFile[]).map((file) => ({
                ...file,
                language: file.language || detectLanguage(file.path),
                isDirty: Boolean(file.isDirty),
            }))
            const currentSnapshot = JSON.stringify(files)
            const nextSnapshot = JSON.stringify(nextFiles)
            if (currentSnapshot !== nextSnapshot) {
                setFiles(nextFiles)
            }
        }
        if (typeof data?.editorActivePath === 'string' && data.editorActivePath !== activePath) {
            setActivePath(data.editorActivePath)
        }
    }, [data?.editorRootPath, data?.editorShowSidebar, data?.editorFiles, data?.editorActivePath])

    useEffect(() => {
        if (data?.content && typeof data.content === 'string') {
            // Prioritize unique filePath from data if available, specially for "New Pane"
            // If not available, fall back to activePath, then default.
            const targetPath = (data.editorFilePath as string) || activePath || '/untitled.txt';

            const existing = files.find(f => f.path === targetPath);

            if (existing) {
                if (existing.content !== data.content) {
                    updateFileContent(targetPath, data.content);
                }
                // Also ensure it is active?
                if (activePath !== targetPath) {
                    setActive(targetPath);
                }
            } else {
                addFile(targetPath, data.content);
            }
        }
        else if (data?.editorFilePath && typeof data.editorFilePath === 'string') {
            const initialContent = (data.editorContent as string) || '';
            // check if already loaded
            if (!files.some(f => f.path === data.editorFilePath)) {
                addFile(data.editorFilePath, initialContent);
            }
        }
    }, [data?.lastPaste, data?.editorFilePath, data?.content, data?.editorContent, files, activePath]);
    // We strictly depend on data changes. `files` and actions are stable or safe to omit if we want to avoid loops, 
    // but ideally we include them. 
    // However, including `files` might loop if we modify files.
    // The key is protecting the `addFile`/`updateContent` calls with conditions.

    // Sync with Pane State Store
    useEffect(() => {
        if (activeFile) {
            usePaneStateStore.getState().setPaneState(id, {
                type: 'editor',
                filePath: activeFile.path,
                language: activeFile.language,
                isDirty: activeFile.isDirty,
                content: activeFile.content,
                selection: ''
            });
        }

        onUpdate?.({
            editorFiles: files,
            editorActivePath: activePath,
            editorContent: activeFile?.content,
            editorFilePath: activeFile?.path,
            editorRootPath: rootPath,
            editorShowSidebar: showSidebar,
        });
    }, [activeFile, activePath, files, id, onUpdate, rootPath, showSidebar]);

    const handleOpenFile = async () => {
        if (!window.platform?.fs) return;
        const picked = await window.platform.fs.openFileDialog();
        if (!picked) return;
        const content = await window.platform.fs.readFile(picked).catch(() => '');
        if (content !== null) addFile(picked, content);
    };

    const handleSave = async () => {
        if (!activeFile || !window.platform?.fs) return;
        await window.platform.fs.writeFile(activeFile.path, activeFile.content);
        setDirty(activeFile.path, false);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSave]);

    const handleEditorMount: OnMount = () => {
        // Configure editor settings here if needed
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // ALWAYS prevent default behavior (navigation)

        if (e.dataTransfer.types.includes('leion/filepath')) {
            e.dataTransfer.dropEffect = 'copy';
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling

        const path = e.dataTransfer.getData('leion/filepath');
        if (path && window.platform?.fs) {
            try {
                const content = await window.platform.fs.readFile(path);
                addFile(path, content);
            } catch (err) {
                console.error('Failed to open dropped file:', err);
            }
        }
    };

    return (
        <div
            className={cn(
                "flex h-full font-sans overflow-hidden",
                theme === 'dark' ? "bg-[#1e1e1e] text-[#cccccc]" : "bg-[#f8fafc] text-[#0f172a]"
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* EXPLORER SIDEBAR (Collapsible) */}
            {showSidebar && rootPath && (
                <PaneFileExplorer
                    rootPath={rootPath}
                    onOpenFile={handlePaneOpenFile}
                    onRootChange={setRootPath}
                />
            )}

            <div className="flex-1 flex flex-col h-full min-w-0">
                {/* TABS BAR */}
                <div className={cn(
                    "flex overflow-x-auto scrollbar-hide",
                    theme === 'dark' ? "bg-[#252526]" : "bg-[#e2e8f0]"
                )}>
                    {/* Toggle Sidebar Button */}
                    <button
                        onClick={async () => {
                            if (!showSidebar) {
                                // If opening and no root, ask for one
                                if (!rootPath && window.platform?.fs) {
                                    const picked = await window.platform.fs.openFolderDialog();
                                    if (picked) setRootPath(picked);
                                    else return; // Cancelled
                                }
                                setShowSidebar(true);
                            } else {
                                setShowSidebar(false);
                            }
                        }}
                        className={cn(
                            "h-9 w-9 flex items-center justify-center transition-colors border-r",
                            theme === 'dark'
                                ? "border-[#2d2d2d] hover:bg-[#3e3e42]"
                                : "border-[#cbd5e1] hover:bg-[#dbe4f0]",
                            showSidebar
                                ? theme === 'dark' ? "text-white bg-[#3e3e42]" : "text-[#0f172a] bg-[#dbe4f0]"
                                : theme === 'dark' ? "text-[#c5c5c5]" : "text-[#475569]"
                        )}
                        title={showSidebar ? "Hide Workspace" : "Show Workspace"}
                    >
                        <Layout size={16} />
                    </button>

                    {files.map(file => (
                        <div
                            key={file.path}
                            onClick={() => setActive(file.path)}
                            className={cn(
                                "group flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r cursor-pointer select-none text-xs",
                                theme === 'dark'
                                    ? "border-[#2d2d2d]"
                                    : "border-[#cbd5e1]",
                                activePath === file.path
                                    ? theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-[#f8fafc] text-[#0f172a]"
                                    : theme === 'dark' ? "bg-[#2d2d2d] text-[#969696] hover:bg-[#35363a]" : "bg-[#e2e8f0] text-[#475569] hover:bg-[#dbe4f0]"
                            )}
                        >
                            <FileCode size={14} className={cn("mr-2 shrink-0",
                                file.language === 'typescript' ? 'text-blue-400' :
                                    file.language === 'json' ? 'text-yellow-500' : 'text-slate-400'
                            )} />
                            <span className="truncate flex-1">{file.path.split(/[\\/]/).pop()}</span>
                            {file.isDirty ? (
                                <Circle size={8} fill="currentColor" className="ml-2 text-white/50 group-hover:hidden" />
                            ) : null}
                            <button
                                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                                className={cn(
                                    "ml-2 p-0.5 rounded-sm opacity-0 group-hover:opacity-100",
                                    theme === 'dark' ? "hover:bg-[#4a4a4a]" : "hover:bg-[#cbd5e1]",
                                    file.isDirty ? "group-hover:block" : ""
                                )}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {/* Add/Open Button */}
                    <button
                        onClick={handleOpenFile}
                        className={cn(
                            "h-9 w-9 flex items-center justify-center transition-colors",
                            theme === 'dark' ? "hover:bg-[#3e3e42] text-[#c5c5c5]" : "hover:bg-[#dbe4f0] text-[#475569]"
                        )}
                        title="Open File"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* BREADCRUMBS */}
                {activeFile && (
                    <div className={cn(
                        "h-6 flex items-center px-4 text-[11px] border-b",
                        theme === 'dark' ? "bg-[#1e1e1e] text-[#aaaaaa] border-[#2d2d2d]" : "bg-[#f8fafc] text-[#475569] border-[#cbd5e1]"
                    )}>
                        <span className="hover:text-white cursor-pointer transition-colors">src</span>
                        <ChevronRight size={12} className={cn("mx-1", theme === 'dark' ? "text-[#666]" : "text-[#94a3b8]")} />
                        <span className={cn(
                            "cursor-pointer transition-colors font-medium",
                            theme === 'dark' ? "hover:text-white text-white" : "hover:text-[#020617] text-[#0f172a]"
                        )}>
                            {activeFile.path.split(/[\\/]/).pop()}
                        </span>
                        {activeFile.isDirty && <span className="ml-2 text-[10px] text-amber-500 font-medium">● Unsaved</span>}
                    </div>
                )}

                {/* EDITOR AREA */}
                <div className={cn("flex-1 relative", theme === 'dark' ? "bg-[#1e1e1e]" : "bg-[#f8fafc]")}>
                    {activeFile ? (
                        <Editor
                            height="100%"
                            path={activeFile.path}
                            language={activeFile.language}
                            value={activeFile.content}
                            onChange={(val) => updateFileContent(activeFile.path, val || '')}
                            onMount={handleEditorMount}
                            theme={theme === 'dark' ? 'vs-dark' : 'light'}
                            options={{
                                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                fontSize: 13,
                                minimap: { enabled: true, renderCharacters: false },
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: "smooth",
                                cursorSmoothCaretAnimation: "on",
                                renderWhitespace: "selection",
                                padding: { top: 12, bottom: 12 },
                                tabSize: 2,
                                wordWrap: 'on'
                            }}
                        />
                    ) : (
                        <div className={cn(
                            "flex flex-col items-center justify-center h-full gap-4",
                            theme === 'dark' ? "text-[#666666]" : "text-[#64748b]"
                        )}>
                            <FileCode size={64} strokeWidth={1} />
                            <div className="text-sm">No file is open</div>
                            <div className="flex gap-2">
                                <button onClick={handleOpenFile} className="px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs rounded-sm transition-colors">
                                    Open File
                                </button>
                                <button
                                    onClick={async () => {
                                        if (window.platform?.fs) {
                                            const picked = await window.platform.fs.openFileDialog();
                                            if (picked) {
                                                const root = picked.replace(/[\\/][^\\/]+$/, '')
                                                setRootPath(root);
                                                const content = await window.platform.fs.readFile(picked).catch(() => '')
                                                if (content !== null) addFile(picked, content)
                                                setShowSidebar(true);
                                            }
                                        }
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-xs rounded-sm transition-colors",
                                        theme === 'dark' ? "bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white" : "bg-[#cbd5e1] hover:bg-[#94a3b8] text-[#0f172a]"
                                    )}
                                >
                                    Open Folder (Workspace)
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* STATUS BAR */}
                <div className={cn(
                    "h-6 text-[11px] flex items-center px-3 gap-4 select-none",
                    theme === 'dark' ? "bg-[#007acc] text-white" : "bg-[#2563eb] text-white"
                )}>
                    <div className="flex items-center gap-1 hover:bg-white/10 px-1 rounded cursor-pointer">
                        <GitBranch size={10} />
                        <span>main</span>
                    </div>
                    <div className="flex-1" />
                    {activeFile && (
                        <>
                            <div className="hover:bg-white/10 px-1 rounded cursor-pointer">
                                Ln 1, Col 1
                            </div>
                            <div className="hover:bg-white/10 px-1 rounded cursor-pointer">
                                UTF-8
                            </div>
                            <div className="hover:bg-white/10 px-1 rounded cursor-pointer uppercase">
                                {activeFile.language}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
