import { useCallback } from 'react'
import { useLayoutStore, getAllPaneIds, type PaneId } from './store'
import { useContextMenu, type MenuItem } from '../components'
import { TabbedPaneGroup } from './TabbedPaneGroup'
import { useFusionStore } from '../panes/fusionStore'
import { usePaneStateStore } from '../panes/paneStateStore'
import { useTerminalProfileStore } from '../panes/terminalProfileStore'
import { useShortcutsStore } from '../hooks/useShortcuts'
import { closePaneWithCleanup } from './paneLifecycle'
import {
    NotesPane,
    BrowserPane,
    TerminalPane,
    ChatPane,
    CodeServerPane,
    WorkflowPane,
    EditorPane,
    DatabasePane,
    AgentPane,
    PaneSelector,
    type PaneType,
    PANE_TYPES,
} from '../panes'

interface PaneProps {
    id: PaneId
    paneConfig?: import('../panes/types').PaneConfig
}

export function Pane({ id, paneConfig: paneConfigOverride }: PaneProps) {
    const paneFromStore = useLayoutStore((state) => state.panes[id])
    const pane = paneConfigOverride ?? paneFromStore
    const setPaneType = useLayoutStore((state) => state.setPaneType)
    const updatePane = useLayoutStore((state) => state.updatePane)
    const setLayout = useLayoutStore((state) => state.setLayout)
    const movePane = useLayoutStore((state) => state.movePane)
    const movePaneToZone = useLayoutStore((state) => state.movePaneToZone)
    const tabGroups = useLayoutStore((state) => state.tabGroups)
    const createTabGroup = useLayoutStore((state) => state.createTabGroup)
    const dissolveTabGroup = useLayoutStore((state) => state.dissolveTabGroup)
    const layout = useLayoutStore((state) => state.layout)
    const panes = useLayoutStore((state) => state.panes)
    const setActivePane = useShortcutsStore((state) => state.setActivePane)
    const contextMenu = useContextMenu()

    // Check if this id is a tab group
    const tabGroup = tabGroups[id]
    if (tabGroup) {
        return <TabbedPaneGroup group={tabGroup} />
    }

    const type = pane?.type || 'empty'

    const handleUpdate = useCallback((data: unknown) => {
        const currentPane = useLayoutStore.getState().panes[id]
        const nextData = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
        const currentData = (currentPane?.data && typeof currentPane.data === 'object' ? currentPane.data : {}) as Record<string, unknown>
        updatePane(id, { data: { ...currentData, ...nextData } })
    }, [id, updatePane])

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()

        // Build "Stack with..." submenu from other panes
        const allPaneIds = getAllPaneIds(layout).flatMap(pid => tabGroups[pid]?.paneIds || [pid])
        const otherPanes = allPaneIds.filter(pid => pid !== id && !pid.startsWith('tabgroup-'))
        const stackItems: MenuItem[] = otherPanes.length > 0 ? [
            { separator: true, label: '', action: () => { } },
            ...otherPanes.slice(0, 8).map(pid => {
                const otherPane = panes[pid]
                const otherType = otherPane?.type || 'empty'
                const otherInfo = PANE_TYPES[otherType]
                return {
                    label: `Stack with ${otherInfo?.icon || ''} ${otherPane?.title || otherInfo?.label || pid}`,
                    icon: '📑',
                    action: () => createTabGroup(id, pid),
                }
            }),
        ] : []

        // Check if this pane is inside a tab group (for "Unstack" option)
        const parentGroup = Object.values(tabGroups).find(g => g.paneIds.includes(id))
        const unstackItems: MenuItem[] = parentGroup ? [
            { separator: true, label: '', action: () => { } },
            { label: 'Unstack All', icon: '📤', action: () => dissolveTabGroup(parentGroup.id) },
        ] : []

        const terminalAmbientState = usePaneStateStore.getState().paneStates[id]
        const terminalCwd = terminalAmbientState?.type === 'terminal' ? terminalAmbientState.cwd : ''
        const terminalSettingsItems: MenuItem[] = (type === 'terminal' || type === 'gemini') ? [
            { separator: true, label: '', action: () => { } },
            {
                label: 'Terminal: Set Shared CWD From This Pane',
                icon: '📂',
                disabled: !terminalCwd,
                action: () => useTerminalProfileStore.getState().setSharedCwd(terminalCwd, id),
            },
            {
                label: 'Terminal: Edit Shared ENV',
                icon: '🧪',
                action: () => {
                    const current = useTerminalProfileStore.getState().envAsText()
                    const next = window.prompt('Shared ENV (KEY=VALUE, one per line)', current)
                    if (next === null) return
                    const result = useTerminalProfileStore.getState().applyEnvText(next)
                    if (!result.ok) {
                        window.alert(result.error || 'Invalid env format')
                    }
                },
            },
            {
                label: 'Terminal: Edit Startup Commands',
                icon: '⚙️',
                action: () => {
                    const current = useTerminalProfileStore.getState().bootstrapAsText()
                    const next = window.prompt('Startup commands (one per line)', current)
                    if (next === null) return
                    useTerminalProfileStore.getState().applyBootstrapText(next)
                },
            },
            {
                label: `Terminal: CWD Sync ${useTerminalProfileStore.getState().syncCwdAcrossTerminals ? 'ON' : 'OFF'}`,
                icon: '🔄',
                action: () => {
                    const current = useTerminalProfileStore.getState().syncCwdAcrossTerminals
                    useTerminalProfileStore.getState().setSyncCwdAcrossTerminals(!current)
                },
            },
        ] : []

        const items: MenuItem[] = [
            { label: 'Move to Top', icon: '⬆️', action: () => movePane(id, 'top') },
            { label: 'Move to Bottom', icon: '⬇️', action: () => movePane(id, 'bottom') },
            { label: 'Move to Left', icon: '⬅️', action: () => movePane(id, 'left') },
            { label: 'Move to Right', icon: '➡️', action: () => movePane(id, 'right') },
            { separator: true, label: '', action: () => { } },
            // Grid Snap Actions
            { label: 'Snap Top-Left', icon: '↖️', action: () => movePaneToZone(id, 0) },
            { label: 'Snap Top-Mid', icon: '⬆️', action: () => movePaneToZone(id, 1) },
            { label: 'Snap Top-Right', icon: '↗️', action: () => movePaneToZone(id, 2) },
            { label: 'Snap Bottom-Left', icon: '↙️', action: () => movePaneToZone(id, 3) },
            { label: 'Snap Bottom-Mid', icon: '⬇️', action: () => movePaneToZone(id, 4) },
            { label: 'Snap Bottom-Right', icon: '↘️', action: () => movePaneToZone(id, 5) },
            ...terminalSettingsItems,
            ...stackItems,
            ...unstackItems,
            // Fusion (Link) items
            ...(() => {
                const fusionState = useFusionStore.getState()
                const currentFusion = fusionState.getFusionForPane(id)
                const fusionItems: MenuItem[] = [{ separator: true, label: '', action: () => { } }]
                if (currentFusion) {
                    fusionItems.push({
                        label: `Unlink from "${currentFusion.name}"`,
                        icon: '🔗',
                        action: () => useFusionStore.getState().unlinkPane(id),
                    })
                } else {
                    const linkTargets = allPaneIds.filter(pid => pid !== id && !pid.startsWith('tabgroup-'))
                    for (const pid of linkTargets.slice(0, 6)) {
                        const otherPane = panes[pid]
                        const otherType = otherPane?.type || 'empty'
                        const otherInfo = PANE_TYPES[otherType]
                        fusionItems.push({
                            label: `Link with ${otherInfo?.icon || ''} ${otherPane?.title || otherInfo?.label || pid}`,
                            icon: '🔗',
                            action: () => useFusionStore.getState().linkPanes(id, pid),
                        })
                    }
                }
                return fusionItems
            })(),
            { separator: true, label: '', action: () => { } },
            { label: 'Change to Terminal', icon: '⬛', action: () => setPaneType(id, 'terminal') },
            { label: 'Change to Editor', icon: '📄', action: () => setPaneType(id, 'editor') },
            { label: 'Change to Browser', icon: '🌐', action: () => setPaneType(id, 'browser') },
            { label: 'Change to Notes', icon: '📝', action: () => setPaneType(id, 'notes') },
            { label: 'Change to AI Chat', icon: '💬', action: () => setPaneType(id, 'chat') },
            { label: 'Change to VS Code', icon: '💻', action: () => setPaneType(id, 'codeserver') },
            { label: 'Change to Workflow', icon: '⚡', action: () => setPaneType(id, 'workflow') },
            { label: 'Change to Database', icon: '🗄️', action: () => setPaneType(id, 'database') },
            { label: 'Change to Agent', icon: '🧠', action: () => setPaneType(id, 'agent') },
            { separator: true, label: '', action: () => { } },
            { label: 'Duplicate', icon: '📋', action: () => duplicatePane(id) },
            { label: 'Close', icon: '✕', action: () => closePaneWithCleanup(id), disabled: allPaneIds.length <= 1 },
        ]

        contextMenu.show(e.clientX, e.clientY, items)
    }

    const duplicatePane = (paneId: string) => {
        const source = panes[paneId]
        if (!source) return

        const newId = `pane-${Date.now()}`
        const newLayout: import('react-mosaic-component').MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId

        setLayout(newLayout)
        setPaneType(newId, source.type)
        updatePane(newId, {
            title: source.title ? `${source.title} copy` : source.title,
            data: source.data ? { ...source.data } : source.data,
            collapsed: false,
        })
    }

    const renderContent = () => {
        if (pane?.collapsed) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/10">
                    <span className="text-xs italic">Collapsed</span>
                </div>
            )
        }

        switch (type) {
            case 'notes':
                return <NotesPane data={pane?.data as any} onUpdate={handleUpdate} />
            case 'browser':
                return <BrowserPane id={id} data={pane?.data as any} onUpdate={handleUpdate} />
            case 'terminal':
                return <TerminalPane id={id} type="terminal" />
            case 'gemini':
                return <TerminalPane id={id} type="gemini" />
            case 'chat':
                return <ChatPane id={id} data={pane?.data as any} onUpdate={handleUpdate} />
            case 'codeserver':
                return <CodeServerPane data={pane?.data as any} onUpdate={handleUpdate} />
            case 'workflow':
                return <WorkflowPane data={pane?.data as Record<string, unknown> | undefined} onUpdate={handleUpdate} />
            case 'editor':
                return <EditorPane id={id} data={pane?.data} onUpdate={handleUpdate} />
            case 'database':
                return <DatabasePane id={id} data={pane?.data as Record<string, unknown>} onUpdate={handleUpdate} />
            case 'agent':
                return <AgentPane id={id} data={pane?.data as Record<string, unknown>} onUpdate={handleUpdate} />
            case 'empty':
            default:
                return (
                    <PaneSelector
                        currentType={type}
                        onSelect={(newType) => setPaneType(id, newType)}
                    />
                )
        }
    }

    return (
        <div
            data-pane-id={id}
            style={{ height: '100%', width: '100%' }}
            tabIndex={-1}
            onMouseDown={() => setActivePane(id)}
            onFocus={() => setActivePane(id)}
            onContextMenu={handleContextMenu}
        >
            {renderContent()}
        </div>
    )
}

export function getPaneTitle(id: PaneId, type: PaneType): string {
    return type === 'empty' ? id : PANE_TYPES[type]?.label || id
}
