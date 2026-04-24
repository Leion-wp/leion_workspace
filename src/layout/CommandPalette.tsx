import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Terminal, Globe, FileText, MessageSquare, Layout, ArrowRight, Database, Workflow, Code, SplitSquareHorizontal, Maximize2, Save, Plus, Moon, Sun, Settings } from 'lucide-react'
import { useLayoutStore, getAllPaneIds } from './store'
import { useShortcutsStore } from '../hooks/useShortcuts'
import { PANE_TYPES, type PaneType } from '../panes'
import { usePaneStateStore } from '../panes/paneStateStore'
import { useTerminalProfileStore } from '../panes/terminalProfileStore'
import { useSettingsStore } from '../store/settings'
import type { MosaicNode } from 'react-mosaic-component'

interface Command {
    id: string
    label: string
    category: 'Pane' | 'Layout' | 'Workflow' | 'Navigation'
    icon: React.ReactNode
    shortcut?: string
    action: () => void
    keywords?: string[]
}

function fuzzyScore(query: string, target: string): number {
    const q = query.toLowerCase()
    const t = target.toLowerCase()
    if (!q) return 1
    if (t.includes(q)) return 2  // exact substring
    let i = 0
    for (const ch of q) {
        const idx = t.indexOf(ch, i)
        if (idx === -1) return 0
        i = idx + 1
    }
    return 1  // fuzzy character match
}

function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query) return text
    const lower = text.toLowerCase()
    const q = query.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx !== -1) {
        return (
            <>
                {text.slice(0, idx)}
                <span className="text-primary font-semibold">{text.slice(idx, idx + q.length)}</span>
                {text.slice(idx + q.length)}
            </>
        )
    }
    return text
}

export function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Store selectors
    const layout = useLayoutStore(s => s.layout)
    const panes = useLayoutStore(s => s.panes)
    const tabGroups = useLayoutStore(s => s.tabGroups)
    const spaces = useLayoutStore(s => s.spaces)
    const activeSpaceId = useLayoutStore(s => s.activeSpaceId)
    const setLayout = useLayoutStore(s => s.setLayout)
    const setPaneType = useLayoutStore(s => s.setPaneType)
    const switchSpace = useLayoutStore(s => s.switchSpace)
    const saveLayout = useLayoutStore(s => s.saveLayout)
    const splitActivePane = useLayoutStore(s => s.splitActivePane)
    const syncCwdAcrossTerminals = useTerminalProfileStore(s => s.syncCwdAcrossTerminals)
    const theme = useSettingsStore(s => s.theme)

    const paneIds = useMemo(() => {
        const ids = getAllPaneIds(layout)
        return ids.flatMap(id => tabGroups[id]?.paneIds || [id])
    }, [layout, tabGroups])

    // Listen for open/close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                // Skip if typing in input/textarea (unless it's our own input)
                const target = e.target as HTMLElement
                if (target !== inputRef.current &&
                    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                    return
                }
                e.preventDefault()
                setIsOpen(prev => {
                    if (prev) return false
                    setQuery('')
                    setSelectedIndex(0)
                    return true
                })
            }
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault()
                setIsOpen(false)
            }
        }
        window.addEventListener('keydown', handler, true) // capture phase
        return () => window.removeEventListener('keydown', handler, true)
    }, [isOpen])

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => inputRef.current?.focus())
        }
    }, [isOpen])

    // Add pane helper
    const addPane = useCallback((type: PaneType) => {
        const newId = `pane-${Date.now()}`
        const newLayout: MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId
        setLayout(newLayout)
        if (type !== 'empty') {
            setTimeout(() => setPaneType(newId, type), 100)
        }
        setIsOpen(false)
    }, [layout, setLayout, setPaneType])

    // Focus pane helper
    const focusPane = useCallback((paneId: string) => {
        useShortcutsStore.getState().setActivePane(paneId)
        const el = document.querySelector(`[data-pane-id="${paneId}"]`) as HTMLElement
        el?.focus()
        setIsOpen(false)
    }, [])

    // Build commands
    const commands = useMemo((): Command[] => {
        const cmds: Command[] = []

        // Pane creation
        cmds.push(
            { id: 'new-terminal', label: 'New Terminal', category: 'Pane', icon: <Terminal size={14} />, shortcut: 'Ctrl+Shift+T', action: () => addPane('terminal'), keywords: ['term', 'shell', 'bash'] },
            { id: 'new-browser', label: 'New Browser', category: 'Pane', icon: <Globe size={14} />, shortcut: 'Ctrl+Shift+B', action: () => addPane('browser'), keywords: ['web', 'chrome'] },
            { id: 'new-notes', label: 'New Notes', category: 'Pane', icon: <FileText size={14} />, shortcut: 'Ctrl+Shift+N', action: () => addPane('notes'), keywords: ['note', 'text'] },
            { id: 'new-editor', label: 'New Editor', category: 'Pane', icon: <Code size={14} />, action: () => addPane('editor'), keywords: ['code', 'file'] },
            { id: 'new-chat', label: 'New AI Chat', category: 'Pane', icon: <MessageSquare size={14} />, action: () => addPane('chat'), keywords: ['ai', 'llm'] },
            { id: 'new-workflow', label: 'New Workflow', category: 'Pane', icon: <Workflow size={14} />, action: () => addPane('workflow'), keywords: ['flow', 'automation'] },
            { id: 'new-database', label: 'New Database', category: 'Pane', icon: <Database size={14} />, action: () => addPane('database'), keywords: ['sql', 'sqlite', 'db'] },
            { id: 'new-empty', label: 'New Empty Pane', category: 'Pane', icon: <Plus size={14} />, shortcut: 'Ctrl+T', action: () => addPane('empty') },
        )

        // Focus existing panes
        paneIds.forEach((id, index) => {
            const pane = panes[id]
            const type = pane?.type || 'empty'
            const typeInfo = PANE_TYPES[type]
            const label = pane?.title || typeInfo?.label || id
            const shortcut = index < 5 ? `Ctrl+${index + 1}` : undefined
            cmds.push({
                id: `focus-${id}`,
                label: `Focus: ${typeInfo?.icon || ''} ${label}`,
                category: 'Pane',
                icon: <ArrowRight size={14} />,
                shortcut,
                action: () => focusPane(id),
                keywords: [type, label.toLowerCase()],
            })
        })

        // Layout actions
        const activePaneId = useShortcutsStore.getState().activePane
        const activePaneState = activePaneId ? usePaneStateStore.getState().paneStates[activePaneId] : null
        const activeTerminalCwd = activePaneState?.type === 'terminal' ? activePaneState.cwd : ''

        cmds.push(
            { id: 'split-h', label: 'Split Pane Horizontally', category: 'Layout', icon: <SplitSquareHorizontal size={14} />, action: () => { splitActivePane('row'); setIsOpen(false) }, keywords: ['split', 'horizontal', 'side'] },
            { id: 'split-v', label: 'Split Pane Vertically', category: 'Layout', icon: <SplitSquareHorizontal size={14} className="rotate-90" />, action: () => { splitActivePane('column'); setIsOpen(false) }, keywords: ['split', 'vertical', 'stack'] },
            { id: 'save-layout', label: 'Save Layout', category: 'Layout', icon: <Save size={14} />, shortcut: 'Ctrl+S', action: () => { saveLayout(); setIsOpen(false) } },
            {
                id: 'toggle-theme',
                label: `Theme: Switch to ${theme === 'dark' ? 'Light' : 'Dark'}`,
                category: 'Layout',
                icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />,
                shortcut: 'Ctrl+Shift+D',
                action: () => {
                    useSettingsStore.getState().toggleTheme()
                    setIsOpen(false)
                },
                keywords: ['theme', 'dark', 'light', 'appearance'],
            },
            {
                id: 'open-settings',
                label: 'Open Settings',
                category: 'Navigation',
                icon: <Settings size={14} />,
                action: () => {
                    window.dispatchEvent(new CustomEvent('leion:open-settings'))
                    setIsOpen(false)
                },
                keywords: ['settings', 'preferences', 'appearance'],
            },
            {
                id: 'open-active-pane-settings',
                label: 'Open active pane settings',
                category: 'Navigation',
                icon: <Settings size={14} />,
                action: () => {
                    const currentPaneId = useShortcutsStore.getState().activePane
                    if (currentPaneId) {
                        window.dispatchEvent(new CustomEvent('leion:open-pane-settings', { detail: { paneId: currentPaneId } }))
                    }
                    setIsOpen(false)
                },
                keywords: ['pane', 'settings', 'config', 'active'],
            },
            { id: 'maximize', label: 'Maximize Active Pane', category: 'Layout', icon: <Maximize2 size={14} />, action: () => { /* handled by mosaic expand */ setIsOpen(false) } },
            {
                id: 'toggle-terminal-cwd-sync',
                label: `Terminal CWD Sync: ${syncCwdAcrossTerminals ? 'Disable' : 'Enable'}`,
                category: 'Layout',
                icon: <Terminal size={14} />,
                action: () => {
                    const current = useTerminalProfileStore.getState().syncCwdAcrossTerminals
                    useTerminalProfileStore.getState().setSyncCwdAcrossTerminals(!current)
                    setIsOpen(false)
                },
                keywords: ['terminal', 'cwd', 'sync'],
            },
            {
                id: 'set-shared-cwd-from-active-terminal',
                label: 'Terminal: Set Shared CWD From Active Pane',
                category: 'Layout',
                icon: <Terminal size={14} />,
                action: () => {
                    if (activeTerminalCwd) {
                        useTerminalProfileStore.getState().setSharedCwd(activeTerminalCwd, activePaneId || null)
                    }
                    setIsOpen(false)
                },
                keywords: ['terminal', 'cwd', 'shared', 'active'],
            },
        )

        // Space navigation
        spaces.forEach(space => {
            if (space.id === activeSpaceId) return
            cmds.push({
                id: `space-${space.id}`,
                label: `Switch to Space: ${space.icon} ${space.name}`,
                category: 'Navigation',
                icon: <Layout size={14} />,
                action: () => { switchSpace(space.id); setIsOpen(false) },
                keywords: [space.name.toLowerCase()],
            })
        })

        return cmds
    }, [paneIds, panes, spaces, activeSpaceId, addPane, focusPane, splitActivePane, saveLayout, switchSpace, syncCwdAcrossTerminals, theme])

    // Filter and sort
    const filtered = useMemo(() => {
        if (!query.trim()) return commands.slice(0, 20)
        return commands
            .map(cmd => {
                const labelScore = fuzzyScore(query, cmd.label)
                const keywordScore = (cmd.keywords || []).reduce((max, kw) => Math.max(max, fuzzyScore(query, kw)), 0)
                const categoryScore = fuzzyScore(query, cmd.category) * 0.5
                return { cmd, score: Math.max(labelScore, keywordScore, categoryScore) }
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
            .map(x => x.cmd)
    }, [commands, query])

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(i => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' && filtered[selectedIndex]) {
            e.preventDefault()
            filtered[selectedIndex].action()
            setIsOpen(false)
        }
    }

    // Scroll selected into view
    useEffect(() => {
        const list = listRef.current
        if (!list) return
        const item = list.children[selectedIndex] as HTMLElement
        item?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    if (!isOpen) return null

    // Group by category
    const categories = ['Pane', 'Layout', 'Navigation', 'Workflow'] as const
    let currentIndex = -1

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="bg-card border border-border/60 text-card-foreground rounded-xl shadow-2xl w-[520px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                    <Search size={16} className="text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                        placeholder="Type a command..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <kbd className="text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1.5 py-0.5">Esc</kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
                    {filtered.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No matching commands
                        </div>
                    )}
                    {categories.map(cat => {
                        const items = filtered.filter(c => c.category === cat)
                        if (items.length === 0) return null

                        return (
                            <div key={cat}>
                                <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                                    {cat}
                                </div>
                                {items.map(cmd => {
                                    currentIndex++
                                    const idx = currentIndex
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <div
                                            key={cmd.id}
                                            className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                                            }`}
                                            onClick={() => { cmd.action(); setIsOpen(false) }}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <span className="text-muted-foreground shrink-0">{cmd.icon}</span>
                                            <span className="flex-1 text-sm truncate">
                                                {highlightMatch(cmd.label, query)}
                                            </span>
                                            {cmd.shortcut && (
                                                <kbd className="text-[10px] text-muted-foreground/50 border border-border/30 rounded px-1.5 py-0.5 shrink-0">
                                                    {cmd.shortcut}
                                                </kbd>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 px-4 py-2 border-t border-border/40 text-[10px] text-muted-foreground/50">
                    <span><kbd className="border border-border/30 rounded px-1">↑↓</kbd> Navigate</span>
                    <span><kbd className="border border-border/30 rounded px-1">Enter</kbd> Execute</span>
                    <span><kbd className="border border-border/30 rounded px-1">Esc</kbd> Close</span>
                </div>
            </div>
        </div>,
        document.body
    )
}
