import { useState, useRef, useCallback, useEffect } from 'react'
import { useLayoutStore, getAllPaneIds } from '../layout/store'
import { useContextMenu, type MenuItem, SettingsModal, MCPStatus } from '../components'
import { PANE_TYPES, type PaneType, type BrowserData, type BrowserTab } from '../panes'
import type { MosaicNode } from 'react-mosaic-component'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import {
    ChevronLeft, ChevronRight, Plus, X,
    LayoutTemplate, Settings, Terminal, Globe, FileText,
    MessageSquare, Code, RefreshCw, SmilePlus
} from 'lucide-react'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { cn } from '../lib/utils'
import { PresetModal } from '../layout/PresetModal'
import { closePaneWithCleanup } from '../layout/paneLifecycle'

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
    const [newSpaceName, setNewSpaceName] = useState('')
    const [newSpaceIcon, setNewSpaceIcon] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [isCreatingSpace, setIsCreatingSpace] = useState(false)
    const [createSpaceName, setCreateSpaceName] = useState('')
    const [editingPaneId, setEditingPaneId] = useState<string | null>(null)
    const [editingPaneName, setEditingPaneName] = useState('')
    const [expandedPanes, setExpandedPanes] = useState<Set<string>>(new Set())
    const [draggedPaneId, setDraggedPaneId] = useState<string | null>(null)
    const [dragOverPaneId, setDragOverPaneId] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [showPresets, setShowPresets] = useState(false)

    const contextMenu = useContextMenu()

    const [width, setWidth] = useState(() => parseInt(localStorage.getItem('sidebar-width') || '256'))
    const [isResizing, setIsResizing] = useState(false)
    const sidebarRef = useRef<HTMLDivElement>(null)

    const startResizing = useCallback(() => {
        setIsResizing(true)
    }, [])

    const stopResizing = useCallback(() => {
        setIsResizing(false)
    }, [])

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX
            if (newWidth > 150 && newWidth < 600) {
                setWidth(newWidth)
                localStorage.setItem('sidebar-width', newWidth.toString())
            }
        }
    }, [isResizing])

    useEffect(() => {
        window.addEventListener('mousemove', resize)
        window.addEventListener('mouseup', stopResizing)
        return () => {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [resize, stopResizing])

    const layout = useLayoutStore((state) => state.layout)
    const panes = useLayoutStore((state) => state.panes)
    const spaces = useLayoutStore((state) => state.spaces)
    const activeSpaceId = useLayoutStore((state) => state.activeSpaceId)
    const setLayout = useLayoutStore((state) => state.setLayout)
    const setPaneType = useLayoutStore((state) => state.setPaneType)
    const updatePane = useLayoutStore((state) => state.updatePane)
    const createSpace = useLayoutStore((state) => state.createSpace)
    const deleteSpace = useLayoutStore((state) => state.deleteSpace)
    const updateSpace = useLayoutStore((state) => state.updateSpace)
    const switchSpace = useLayoutStore((state) => state.switchSpace)

    const paneIds = getAllPaneIds(layout)

    // Helper functions (same as before)
    const closePane = (idToRemove: string) => {
        closePaneWithCleanup(idToRemove)
    }

    const duplicatePane = (id: string) => {
        const pane = panes[id]
        if (!pane) return

        const newId = `pane-${Date.now()}`
        const newLayout: MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId
        setLayout(newLayout)
        setTimeout(() => {
            setPaneType(newId, pane.type)
            if (pane.data) {
                updatePane(newId, { data: pane.data })
            }
        }, 100)
    }

    const handlePaneContextMenu = (e: React.MouseEvent, paneId: string) => {
        e.preventDefault()
        const pane = panes[paneId]
        const currentType = pane?.type || 'empty'

        const typeItems: MenuItem[] = Object.entries(PANE_TYPES)
            .filter(([key]) => key !== 'empty' && key !== currentType)
            .map(([key, value]) => ({
                label: `Change to ${value.label}`,
                icon: value.icon,
                action: () => setPaneType(paneId, key as PaneType),
            }))

        const spaceItems: MenuItem[] = spaces
            .filter((s) => s.id !== activeSpaceId)
            .map((s) => ({
                label: `Move to ${s.name}`,
                icon: s.icon,
                action: () => {
                    console.log('Move pane to space:', s.id)
                },
            }))

        const items: MenuItem[] = [
            {
                label: 'Rename',
                icon: '✏️',
                action: () => {
                    setEditingPaneId(paneId)
                    setEditingPaneName(pane?.title || '')
                },
            },
            { separator: true, label: '', action: () => { } },
            ...typeItems,
            { separator: true, label: '', action: () => { } },
            { label: 'Duplicate', icon: '📋', action: () => duplicatePane(paneId) },
            ...(spaceItems.length > 0 ? [
                { separator: true, label: '', action: () => { } },
                ...spaceItems,
            ] : []),
            { separator: true, label: '', action: () => { } },
            {
                label: 'Close',
                icon: '✕',
                action: () => closePane(paneId),
                disabled: paneIds.length <= 1,
            },
        ]

        contextMenu.show(e.clientX, e.clientY, items)
    }

    const addPane = (type: PaneType = 'empty') => {
        const newId = `pane-${Date.now()}`
        const newLayout: MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 75 }
            : newId
        setLayout(newLayout)
        if (type !== 'empty') {
            setTimeout(() => setPaneType(newId, type), 100)
        }
    }

    const handleCreateSpace = () => {
        setIsCreatingSpace(true)
        setCreateSpaceName('')
    }

    const submitCreateSpace = () => {
        if (createSpaceName.trim()) {
            createSpace(createSpaceName.trim())
        }
        setIsCreatingSpace(false)
        setCreateSpaceName('')
    }

    const handleRenameSpace = (id: string, newName: string, newIcon: string) => {
        if (newName.trim()) {
            // We need to update the store to support icon updates. 
            // Temporarily just renaming.
            // I will update the store in the next step to support `updateSpace`.
            // For now, let's just call renameSpace and ignore icon until store is fixed.
            // Wait, I should fix store FIRST or concurrently.
            // I will assume `updateSpace` exists and I will add it.
            updateSpace(id, { name: newName.trim(), icon: newIcon.trim() || '🏠' })
        }
        setEditingSpaceId(null)
        setNewSpaceName('')
        setNewSpaceIcon('')
    }

    // Helper to sync state when editing starts
    const startEditingSpace = (space: import('../layout/store').Space) => {
        setEditingSpaceId(space.id)
        setNewSpaceName(space.name)
        setNewSpaceIcon(space.icon)
        setShowEmojiPicker(false)
    }

    const handleSpaceIconChange = (newIcon: string) => {
        // Enforce max length or emoji logic if needed
        setNewSpaceIcon(newIcon)
    }

    const handleRenamePane = (id: string, newTitle: string) => {
        if (newTitle.trim()) {
            updatePane(id, { title: newTitle.trim() })
        }
        setEditingPaneId(null)
        setEditingPaneName('')
    }

    const togglePaneExpanded = (paneId: string) => {
        setExpandedPanes((prev) => {
            const next = new Set(prev)
            if (next.has(paneId)) {
                next.delete(paneId)
            } else {
                next.add(paneId)
            }
            return next
        })
    }

    const getBrowserTabs = (paneId: string): BrowserTab[] => {
        const pane = panes[paneId]
        if (pane?.type !== 'browser' || !pane.data) return []
        const data = pane.data as unknown as BrowserData
        return data.tabs || []
    }

    const getActiveTabId = (paneId: string): string | null => {
        const pane = panes[paneId]
        if (pane?.type !== 'browser' || !pane.data) return null
        const data = pane.data as unknown as BrowserData
        return data.activeTabId || null
    }

    const switchTab = (paneId: string, tabId: string) => {
        const pane = panes[paneId]
        if (!pane?.data) return
        updatePane(paneId, {
            data: { ...pane.data, activeTabId: tabId }
        })
    }

    const closeTab = (paneId: string, tabId: string) => {
        const pane = panes[paneId]
        if (!pane?.data) return
        const data = pane.data as unknown as BrowserData
        if (data.tabs.length <= 1) return

        const newTabs = data.tabs.filter((t) => t.id !== tabId)
        const newActiveId = data.activeTabId === tabId ? newTabs[0]?.id : data.activeTabId
        updatePane(paneId, {
            data: { ...data, tabs: newTabs, activeTabId: newActiveId }
        })
    }

    const addTab = (paneId: string, url = 'https://www.google.com') => {
        const pane = panes[paneId]
        if (!pane?.data) return
        const data = pane.data as unknown as BrowserData
        const newTab: BrowserTab = {
            id: `tab-${Date.now()}`,
            url,
            title: 'New Tab',
            favicon: '',
            isLoading: false,
            isSecure: url.startsWith('https'),
        }
        updatePane(paneId, {
            data: { ...data, tabs: [...data.tabs, newTab], activeTabId: newTab.id }
        })
    }

    const handleTabContextMenu = (e: React.MouseEvent, paneId: string, tab: BrowserTab) => {
        e.preventDefault()
        e.stopPropagation()

        const items: MenuItem[] = [
            {
                label: 'Open in New Pane', icon: '📤', action: () => {
                    const newId = `pane-${Date.now()}`
                    const newLayout: MosaicNode<string> = layout
                        ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
                        : newId
                    setLayout(newLayout)
                    setTimeout(() => {
                        setPaneType(newId, 'browser')
                    }, 100)
                }
            },
            { label: 'Duplicate Tab', icon: '📋', action: () => addTab(paneId, tab.url) },
            { label: 'Copy URL', icon: '🔗', action: () => navigator.clipboard.writeText(tab.url) },
            { separator: true, label: '', action: () => { } },
            { label: 'Close Tab', icon: '✕', action: () => closeTab(paneId, tab.id), disabled: getBrowserTabs(paneId).length <= 1 },
        ]

        contextMenu.show(e.clientX, e.clientY, items)
    }

    const handleDragStart = (e: React.DragEvent, paneId: string) => {
        setDraggedPaneId(paneId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', paneId)
    }

    const handleDragOver = (e: React.DragEvent, paneId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (paneId !== draggedPaneId) {
            setDragOverPaneId(paneId)
        }
    }

    const handleDragEnd = () => {
        if (draggedPaneId && dragOverPaneId && draggedPaneId !== dragOverPaneId) {
            reorderPanes(draggedPaneId, dragOverPaneId)
        }
        setDraggedPaneId(null)
        setDragOverPaneId(null)
    }

    const handleDragLeave = () => {
        setDragOverPaneId(null)
    }

    const reorderPanes = (fromId: string, toId: string) => {
        if (!layout) return

        const currentOrder = [...paneIds]
        const fromIndex = currentOrder.indexOf(fromId)
        const toIndex = currentOrder.indexOf(toId)

        if (fromIndex === -1 || toIndex === -1) return

        currentOrder.splice(fromIndex, 1)
        currentOrder.splice(toIndex, 0, fromId)

        const buildLayout = (ids: string[]): MosaicNode<string> | null => {
            if (ids.length === 0) return null
            if (ids.length === 1) return ids[0]

            const mid = Math.ceil(ids.length / 2)
            const first = buildLayout(ids.slice(0, mid))
            const second = buildLayout(ids.slice(mid))

            if (!first) return second
            if (!second) return first

            return {
                direction: 'column',
                first,
                second,
                splitPercentage: 50,
            }
        }

        setLayout(buildLayout(currentOrder))
    }

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                "bg-card/30 backdrop-blur-xl border-r border-border/40 flex flex-col transition-all duration-75 ease-out relative group",
                collapsed ? "w-12" : ""
            )}
            style={{ width: collapsed ? undefined : width }}
        >
            {/* Drag Handle */}
            <div
                className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                onMouseDown={startResizing}
            />
            {/* Collapse toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-2 h-6 w-6 rounded-full border border-border bg-background shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </Button>

            {!collapsed && (
                <div className="flex flex-col h-full p-3 gap-6 overflow-hidden">
                    {/* Spaces section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spaces</h3>
                            {!isCreatingSpace && (
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCreateSpace}>
                                    <Plus size={14} />
                                </Button>
                            )}
                        </div>

                        <div className="space-y-1">
                            {spaces.map((space) => (
                                <div
                                    key={space.id}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group/space",
                                        space.id === activeSpaceId
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-accent text-foreground/80"
                                    )}
                                    onClick={() => switchSpace(space.id)}
                                    onDoubleClick={() => startEditingSpace(space)}
                                >
                                    {editingSpaceId === space.id ? (
                                        <div className="flex items-center gap-1 flex-1 min-w-0 relative" onClick={(e) => e.stopPropagation()}>
                                            <div
                                                className="h-6 w-8 flex items-center justify-center text-xs border rounded cursor-pointer hover:bg-accent"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            >
                                                {newSpaceIcon || <SmilePlus size={14} />}
                                            </div>

                                            {showEmojiPicker && (
                                                <div className="absolute top-8 left-0 z-50 shadow-xl border rounded-lg">
                                                    <EmojiPicker
                                                        onEmojiClick={(data: EmojiClickData) => {
                                                            handleSpaceIconChange(data.emoji)
                                                            setShowEmojiPicker(false)
                                                        }}
                                                        width={300}
                                                        height={400}
                                                        theme={"dark" as any} // Should infer from theme context but hardcoded for now or use system
                                                    />
                                                </div>
                                            )}

                                            <Input
                                                className="h-6 text-xs px-1 flex-1"
                                                value={newSpaceName}
                                                onChange={(e) => setNewSpaceName(e.target.value)}
                                                onBlur={() => {
                                                    // Only save if not clicking inside picker
                                                    // This is tricky. Let's rely on Enter/Escape or manual close for now.
                                                    // If we blur the input, we might want to save.
                                                    // But clicking the emoji button causes blur on input?
                                                    // Yes. So we should NOT auto-save on blur if we are interacting with picker.
                                                    // For now, let's remove onBlur auto-save to avoid conflicts, or use a refined check.
                                                    // User can press Enter to save.
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenameSpace(space.id, newSpaceName, newSpaceIcon)
                                                    if (e.key === 'Escape') {
                                                        setEditingSpaceId(null)
                                                        setShowEmojiPicker(false)
                                                    }
                                                }}
                                                autoFocus
                                                placeholder="Space Name"
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => handleRenameSpace(space.id, newSpaceName, newSpaceIcon)}
                                            >
                                                <RefreshCw size={12} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-base">{space.icon}</span>
                                            <span className="flex-1 truncate">{space.name}</span>
                                        </>
                                    )}
                                    {spaces.length > 1 && space.id !== activeSpaceId && (
                                        <button
                                            className="opacity-0 group-hover/space:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm(`Delete space "${space.name}"?`)) {
                                                    deleteSpace(space.id)
                                                }
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {isCreatingSpace && (
                                <div className="px-2">
                                    <Input
                                        className="h-7 text-xs"
                                        value={createSpaceName}
                                        onChange={(e) => setCreateSpaceName(e.target.value)}
                                        onBlur={() => submitCreateSpace()}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitCreateSpace()
                                            if (e.key === 'Escape') setIsCreatingSpace(false)
                                        }}
                                        placeholder="Space name..."
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panes list */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Panes</h3>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => addPane('empty')}>
                                <Plus size={14} />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {paneIds.map((id, index) => {
                                const pane = panes[id]
                                const type = pane?.type || 'empty'
                                const typeInfo = PANE_TYPES[type]
                                const icon = typeInfo?.icon || '📦'
                                const label = pane?.title || typeInfo?.label || id
                                const isBrowser = type === 'browser'
                                const tabs = isBrowser ? getBrowserTabs(id) : []
                                const activeTabId = isBrowser ? getActiveTabId(id) : null
                                const isExpanded = expandedPanes.has(id)
                                const isActive = draggedPaneId === id || dragOverPaneId === id

                                return (
                                    <div key={id} className="space-y-1">
                                        <div
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all cursor-pointer group/pane border border-transparent",
                                                isActive ? "bg-accent border-primary/20" : "hover:bg-accent/50",
                                                isBrowser && tabs.length > 0 && "font-medium"
                                            )}
                                            onContextMenu={(e) => handlePaneContextMenu(e, id)}
                                            onClick={isBrowser && tabs.length > 0 ? () => togglePaneExpanded(id) : undefined}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, id)}
                                            onDragOver={(e) => handleDragOver(e, id)}
                                            onDragEnd={handleDragEnd}
                                            onDragLeave={handleDragLeave}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {isBrowser && tabs.length > 0 && (
                                                    <span className="text-muted-foreground text-[10px] w-3">{isExpanded ? '▼' : '▶'}</span>
                                                )}
                                                <span className="text-base leading-none">{icon}</span>
                                                {editingPaneId === id ? (
                                                    <Input
                                                        className="h-6 text-xs px-1"
                                                        value={editingPaneName}
                                                        onChange={(e) => setEditingPaneName(e.target.value)}
                                                        onBlur={() => handleRenamePane(id, editingPaneName)}
                                                        onKeyDown={(e) => {
                                                            e.stopPropagation()
                                                            if (e.key === 'Enter') handleRenamePane(id, editingPaneName)
                                                            if (e.key === 'Escape') setEditingPaneId(null)
                                                        }}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="truncate text-xs">{label}</span>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground font-normal">
                                                {index + 1}
                                            </Badge>
                                        </div>

                                        {/* Browser tabs (Arc-style) */}
                                        {isBrowser && isExpanded && tabs.length > 0 && (
                                            <div className="pl-6 space-y-0.5 border-l border-border/50 ml-3">
                                                {tabs.map((tab) => (
                                                    <div
                                                        key={tab.id}
                                                        className={cn(
                                                            "flex items-center gap-2 px-2 py-1 rounded-sm text-xs cursor-pointer transition-colors group/tab",
                                                            tab.id === activeTabId ? "bg-accent/80 text-foreground" : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                                                        )}
                                                        onClick={() => switchTab(id, tab.id)}
                                                        onContextMenu={(e) => handleTabContextMenu(e, id, tab)}
                                                    >
                                                        {tab.favicon ? (
                                                            <img src={tab.favicon} className="w-3 h-3 rounded-sm" alt="" />
                                                        ) : (
                                                            <Globe size={12} className="text-muted-foreground/70" />
                                                        )}
                                                        <span className="truncate flex-1">{tab.title}</span>
                                                        {tab.isLoading && <RefreshCw size={10} className="animate-spin text-primary" />}
                                                    </div>
                                                ))}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full text-[10px] h-6 justify-start text-muted-foreground hover:text-foreground px-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        addTab(id)
                                                    }}
                                                >
                                                    <Plus size={12} className="mr-1" /> New Tab
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Add Section */}
                    <div className="border-t border-border/40 pt-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="h-8 justify-start px-2 text-xs" onClick={() => addPane('terminal')} title="New Terminal">
                                <Terminal size={14} className="mr-2" /> Term
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start px-2 text-xs" onClick={() => addPane('browser')} title="New Browser">
                                <Globe size={14} className="mr-2" /> Web
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start px-2 text-xs" onClick={() => addPane('notes')} title="New Notes">
                                <FileText size={14} className="mr-2" /> Note
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 justify-start px-2 text-xs" onClick={() => addPane('chat')} title="New AI Chat">
                                <MessageSquare size={14} className="mr-2" /> AI
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <div className="flex-1">
                                <MCPStatus />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowPresets(true)} title="Layout Presets">
                                <LayoutTemplate size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowSettings(true)}>
                                <Settings size={16} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collapsed View */}
            {collapsed && (
                <div className="flex flex-col items-center h-full py-4 gap-4">
                    <div className="flex flex-col gap-2">
                        {spaces.map(space => (
                            <div
                                key={space.id}
                                className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors",
                                    space.id === activeSpaceId ? "bg-primary/20 text-primary" : "hover:bg-accent text-muted-foreground"
                                )}
                                onClick={() => switchSpace(space.id)}
                                title={space.name}
                            >
                                <span className="text-lg">{space.icon}</span>
                            </div>
                        ))}
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={handleCreateSpace}>
                            <Plus size={16} />
                        </Button>
                    </div>

                    <div className="w-4 h-[1px] bg-border/50 my-2" />

                    <div className="flex flex-col gap-2 flex-1 overflow-y-auto w-full items-center custom-scrollbar">
                        {paneIds.map(id => {
                            const pane = panes[id]
                            const type = pane?.type || 'empty'
                            const PANE_ICONS: Record<string, any> = {
                                terminal: Terminal,
                                browser: Globe,
                                notes: FileText,
                                chat: MessageSquare,
                                codeserver: Code,
                                empty: LayoutTemplate
                            }
                            const Icon = PANE_ICONS[type] || LayoutTemplate

                            return (
                                <div
                                    key={id}
                                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-foreground/70 cursor-pointer"
                                    onClick={() => togglePaneExpanded(id)}
                                    title={pane.title || id}
                                >
                                    <Icon size={16} />
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setShowSettings(true)}>
                            <Settings size={16} />
                        </Button>
                    </div>
                </div>
            )}

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            <PresetModal isOpen={showPresets} onClose={() => setShowPresets(false)} />
        </aside>
    )
}
