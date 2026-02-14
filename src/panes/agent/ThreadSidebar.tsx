import {
    Plus, MessageSquare, Settings, Trash2,
    Folder, ChevronRight, ChevronDown, Check, X,
    Archive, Edit2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgentStore, Thread } from '@/store/agentStore'
import { useState } from 'react'

interface ThreadSidebarProps {
    className?: string
    onOpenSettings?: () => void
}

export function ThreadSidebar({ className, onOpenSettings }: ThreadSidebarProps) {
    const {
        threads,
        projects,
        activeThreadId,
        createThread,
        switchThread,
        createProject,
        deleteProject,
        deleteThread,
        archiveThread,
        renameThread
    } = useAgentStore()

    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [showNewProjectInput, setShowNewProjectInput] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')

    // Group threads by project
    const unassignedThreads = threads.filter(t => !t.projectId && !t.archived)
    const archivedThreads = threads.filter(t => t.archived)

    const toggleProject = (projectId: string) => {
        setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }))
    }

    const handleCreateProject = () => {
        if (newProjectName.trim()) {
            createProject(newProjectName.trim())
            setNewProjectName('')
            setShowNewProjectInput(false)
        }
    }

    const startRename = (thread: Thread) => {
        setEditingThreadId(thread.id)
        setRenameValue(thread.title)
    }

    const submitRename = () => {
        if (editingThreadId && renameValue.trim()) {
            renameThread(editingThreadId, renameValue.trim())
            setEditingThreadId(null)
        }
    }

    return (
        <div className={cn("flex flex-col h-full bg-card/30 border-r border-border/40 text-sm", className)}>
            {/* Header / Actions */}
            <div className="p-2 space-y-1 shrink-0 border-b border-border/20">
                <Button
                    className="w-full justify-start gap-2 h-8 text-xs font-medium"
                    variant="ghost"
                    onClick={() => createThread()}
                >
                    <Plus size={14} />
                    <span>New Chat</span>
                </Button>

                <div className="flex items-center justify-between px-2 pt-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projects</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-accent/50"
                        onClick={() => setShowNewProjectInput(true)}
                    >
                        <Plus size={12} />
                    </Button>
                </div>

                {showNewProjectInput && (
                    <div className="px-2 pb-2 flex gap-1">
                        <input
                            autoFocus
                            className="flex-1 h-6 rounded border border-border/50 bg-background px-1.5 text-xs outline-none"
                            placeholder="Project Name..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateProject()
                                if (e.key === 'Escape') setShowNewProjectInput(false)
                            }}
                        />
                        <button onClick={handleCreateProject} className="text-primary hover:text-primary/80"><Check size={14} /></button>
                        <button onClick={() => setShowNewProjectInput(false)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    </div>
                )}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">

                {/* Projects */}
                <div className="space-y-1">
                    {projects.map(project => {
                        const projectThreads = threads.filter(t => t.projectId === project.id && !t.archived)
                        const isExpanded = expandedProjects[project.id] ?? true // Default open? Or closed?

                        return (
                            <div key={project.id} className="space-y-0.5">
                                <div
                                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent/40 rounded cursor-pointer group select-none"
                                    onClick={() => toggleProject(project.id)}
                                // onContextMenu (Delete logic etc.)
                                >
                                    {isExpanded ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
                                    <Folder size={14} className="text-primary/70" />
                                    <span className="text-xs font-medium flex-1 truncate">{project.name}</span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            // Handle add chat to project
                                            className="p-1 hover:text-foreground hover:bg-background/80 rounded"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                createThread('New Project Chat', project.id)
                                                if (!isExpanded) toggleProject(project.id)
                                            }}
                                            title="New Chat in Project"
                                        >
                                            <Plus size={12} />
                                        </button>
                                        <button
                                            className="p-1 hover:text-destructive hover:bg-background/80 rounded"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm(`Delete project "${project.name}"? This will ungroup its chats.`)) {
                                                    deleteProject(project.id)
                                                }
                                            }}
                                            title="Delete Project"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="pl-3 border-l border-border/20 ml-2 space-y-0.5">
                                        {projectThreads.length === 0 && (
                                            <div className="text-[10px] text-muted-foreground px-2 py-1 italic">Empty</div>
                                        )}
                                        {projectThreads.map(thread => (
                                            <ThreadItem
                                                key={thread.id}
                                                thread={thread}
                                                isActive={activeThreadId === thread.id}
                                                isEditing={editingThreadId === thread.id}
                                                renameValue={renameValue}
                                                onRenameChange={setRenameValue}
                                                onRenameSubmit={submitRename}
                                                onRenameCancel={() => setEditingThreadId(null)}
                                                onClick={() => switchThread(thread.id)}
                                                onStartRename={() => startRename(thread)}
                                                onArchive={() => archiveThread(thread.id)}
                                                onDelete={() => deleteThread(thread.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Unassigned Threads */}
                {(unassignedThreads.length > 0 || projects.length === 0) && (
                    <div className="space-y-0.5">
                        <h3 className="text-[10px] font-medium text-muted-foreground px-2 pb-1 uppercase tracking-wider">Threads</h3>
                        {unassignedThreads.map(thread => (
                            <ThreadItem
                                key={thread.id}
                                thread={thread}
                                isActive={activeThreadId === thread.id}
                                isEditing={editingThreadId === thread.id}
                                renameValue={renameValue}
                                onRenameChange={setRenameValue}
                                onRenameSubmit={submitRename}
                                onRenameCancel={() => setEditingThreadId(null)}
                                onClick={() => switchThread(thread.id)}
                                onStartRename={() => startRename(thread)}
                                onArchive={() => archiveThread(thread.id)}
                                onDelete={() => deleteThread(thread.id)}
                            />
                        ))}
                    </div>
                )}

                {/* Archived Threads */}
                {archivedThreads.length > 0 && (
                    <div className="pt-2 border-t border-border/20">
                        <div
                            className="flex items-center gap-2 px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                            onClick={() => toggleProject('__ARCHIVED__')} // Reuse logic
                        >
                            <Archive size={12} />
                            <span>Archived ({archivedThreads.length})</span>
                        </div>
                        {expandedProjects['__ARCHIVED__'] && (
                            <div className="pl-2 mt-1 space-y-0.5">
                                {archivedThreads.map(thread => (
                                    <ThreadItem
                                        key={thread.id}
                                        thread={thread}
                                        isActive={activeThreadId === thread.id}
                                        onClick={() => switchThread(thread.id)}
                                        readOnly
                                        onDelete={() => deleteThread(thread.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border/40 shrink-0 space-y-1 bg-card/20">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8 text-xs font-normal"
                    onClick={onOpenSettings}
                >
                    <Settings size={14} />
                    <span>Settings & Environment</span>
                </Button>
            </div>
        </div>
    )
}

interface ThreadItemProps {
    thread: Thread
    isActive: boolean
    isEditing?: boolean
    renameValue?: string
    readOnly?: boolean
    onRenameChange?: (val: string) => void
    onRenameSubmit?: () => void
    onRenameCancel?: () => void
    onClick: () => void
    onStartRename?: () => void
    onArchive?: () => void
    onDelete: () => void
}

function ThreadItem({
    thread, isActive, isEditing, renameValue, readOnly,
    onRenameChange, onRenameSubmit, onRenameCancel, onClick,
    onStartRename, onArchive, onDelete
}: ThreadItemProps) {
    const [isHovered, setIsHovered] = useState(false)

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 px-2 py-1 bg-accent/40 rounded">
                <input
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent text-xs outline-none border-b border-primary/50"
                    value={renameValue}
                    onChange={(e) => onRenameChange?.(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onRenameSubmit?.()
                        if (e.key === 'Escape') onRenameCancel?.()
                    }}
                    onBlur={onRenameSubmit}
                />
            </div>
        )
    }

    return (
        <div
            className={cn(
                "group flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer select-none",
                isActive ? "bg-accent/60 text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <MessageSquare size={13} className={cn("shrink-0 opacity-70", isActive && "text-primary")} />
            <span className="truncate flex-1">{thread.title || 'Untitled'}</span>

            {/* Actions on Hover */}
            {(isHovered || isActive) && !readOnly && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-1 hover:bg-background/80 rounded hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); onStartRename?.() }}
                        title="Rename"
                    >
                        <Edit2 size={10} />
                    </button>
                    {!thread.archived && onArchive && (
                        <button
                            className="p-1 hover:bg-background/80 rounded hover:text-warning"
                            onClick={(e) => { e.stopPropagation(); onArchive() }}
                            title="Archive"
                        >
                            <Archive size={10} />
                        </button>
                    )}
                    <button
                        className="p-1 hover:bg-background/80 rounded hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        title="Delete"
                    >
                        <Trash2 size={10} />
                    </button>
                </div>
            )}
            {/* ReadOnly Delete */}
            {readOnly && isHovered && (
                <button
                    className="p-1 hover:bg-background/80 rounded hover:text-destructive opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    title="Delete Permanently"
                >
                    <Trash2 size={10} />
                </button>
            )}
        </div>
    )
}
