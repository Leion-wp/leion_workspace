import { useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { usePaneStateStore } from './paneStateStore';
import { create } from 'zustand';
import { useState } from 'react';
import { Layout, X, Plus, Circle, FileCode, ChevronRight, GitBranch } from 'lucide-react';
import { PaneFileExplorer } from './PaneFileExplorer';
import { cn } from '../lib/utils';
import './EditorPane.css';

// --- EDITOR STORE (internal for now, could be moved) ---
interface EditorFile {
    path: string;
    content: string;
    language: string;
    isDirty: boolean;
}

interface EditorState {
    files: EditorFile[];
    activePath: string | null;
    addFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActive: (path: string) => void;
    updateContent: (path: string, content: string) => void;
    setDirty: (path: string, dirty: boolean) => void;
}

const useEditorStore = create<EditorState>((set) => ({
    files: [],
    activePath: null,
    addFile: (path, content) => set((state) => {
        if (state.files.some(f => f.path === path)) {
            return { activePath: path };
        }
        const ext = path.split('.').pop()?.toLowerCase() || 'txt';
        // Simple language detection
        const langMap: Record<string, string> = {
            ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
            json: 'json', html: 'html', css: 'css', md: 'markdown', py: 'python'
        };
        const language = langMap[ext] || 'plaintext';

        return {
            files: [...state.files, { path, content, language, isDirty: false }],
            activePath: path
        };
    }),
    closeFile: (path) => set((state) => {
        const newFiles = state.files.filter(f => f.path !== path);
        let newActive = state.activePath;
        if (state.activePath === path) {
            newActive = newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null;
        }
        return { files: newFiles, activePath: newActive };
    }),
    setActive: (path) => set({ activePath: path }),
    updateContent: (path, content) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, content, isDirty: true } : f)
    })),
    setDirty: (path, dirty) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, isDirty: dirty } : f)
    })),
}));

// --- COMPONENTS ---

interface EditorPaneProps {
    id: string;
    data?: Record<string, unknown> & { lastPaste?: number };
    onUpdate?: (data: unknown) => void;
}

export function EditorPane({ id, data, onUpdate }: EditorPaneProps) {
    const { files, activePath, addFile, closeFile, setActive, updateContent, setDirty } = useEditorStore();
    const activeFile = files.find(f => f.path === activePath);

    // --- WORKSPACE STATE ---
    const [showSidebar, setShowSidebar] = useState(false);
    const [rootPath, setRootPath] = useState<string>('');

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
        if (data?.content && typeof data.content === 'string') {
            // Prioritize unique filePath from data if available, specially for "New Pane"
            // If not available, fall back to activePath, then default.
            const targetPath = (data.editorFilePath as string) || activePath || '/untitled.txt';

            const existing = files.find(f => f.path === targetPath);

            if (existing) {
                if (existing.content !== data.content) {
                    updateContent(targetPath, data.content);
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
    }, [data?.lastPaste, data?.editorFilePath, data?.content, data?.editorContent, files, activePath, addFile, setActive, updateContent]);
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

            onUpdate?.({
                editorContent: activeFile.content,
                editorFilePath: activeFile.path,
            });
        }
    }, [activeFile, id, onUpdate]);

    const handleOpenFile = async () => {
        if (!window.platform?.fs) return;
        const picked = await window.platform.fs.openFolderDialog(); // Actually file picker in this context
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
            className="flex h-full bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden"
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
                <div className="flex bg-[#252526] overflow-x-auto scrollbar-hide">
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
                            "h-9 w-9 flex items-center justify-center hover:bg-[#3e3e42] transition-colors border-r border-[#2d2d2d]",
                            showSidebar ? "text-white bg-[#3e3e42]" : "text-[#c5c5c5]"
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
                                "group flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r border-[#2d2d2d] cursor-pointer select-none text-xs",
                                activePath === file.path ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]"
                            )}
                        >
                            <FileCode size={14} className={cn("mr-2 shrink-0",
                                file.language === 'typescript' ? 'text-blue-400' :
                                    file.language === 'json' ? 'text-yellow-400' : 'text-slate-400'
                            )} />
                            <span className="truncate flex-1">{file.path.split(/[\\/]/).pop()}</span>
                            {file.isDirty ? (
                                <Circle size={8} fill="currentColor" className="ml-2 text-white/50 group-hover:hidden" />
                            ) : null}
                            <button
                                onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                                className={cn(
                                    "ml-2 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-[#4a4a4a]",
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
                        className="h-9 w-9 flex items-center justify-center hover:bg-[#3e3e42] text-[#c5c5c5] transition-colors"
                        title="Open File"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* BREADCRUMBS */}
                {activeFile && (
                    <div className="h-6 flex items-center px-4 bg-[#1e1e1e] text-[11px] text-[#aaaaaa] border-b border-[#2d2d2d]">
                        <span className="hover:text-white cursor-pointer transition-colors">src</span>
                        <ChevronRight size={12} className="mx-1 text-[#666]" />
                        <span className="hover:text-white cursor-pointer transition-colors font-medium text-white">
                            {activeFile.path.split(/[\\/]/).pop()}
                        </span>
                        {activeFile.isDirty && <span className="ml-2 text-[10px] text-amber-500 font-medium">● Unsaved</span>}
                    </div>
                )}

                {/* EDITOR AREA */}
                <div className="flex-1 relative bg-[#1e1e1e]">
                    {activeFile ? (
                        <Editor
                            height="100%"
                            path={activeFile.path}
                            language={activeFile.language}
                            value={activeFile.content}
                            onChange={(val) => updateContent(activeFile.path, val || '')}
                            onMount={handleEditorMount}
                            theme="vs-dark"
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
                        <div className="flex flex-col items-center justify-center h-full text-[#666666] gap-4">
                            <FileCode size={64} strokeWidth={1} />
                            <div className="text-sm">No file is open</div>
                            <div className="flex gap-2">
                                <button onClick={handleOpenFile} className="px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs rounded-sm transition-colors">
                                    Open File
                                </button>
                                <button
                                    onClick={async () => {
                                        if (window.platform?.fs) {
                                            const picked = await window.platform.fs.openFolderDialog();
                                            if (picked) {
                                                setRootPath(picked);
                                                setShowSidebar(true);
                                            }
                                        }
                                    }}
                                    className="px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white text-xs rounded-sm transition-colors"
                                >
                                    Open Folder (Workspace)
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* STATUS BAR */}
                <div className="h-6 bg-[#007acc] text-white text-[11px] flex items-center px-3 gap-4 select-none">
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
