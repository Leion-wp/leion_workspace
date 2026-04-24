import { useEffect, useMemo } from 'react'
import { Titlebar } from './Titlebar'
import { Sidebar } from './Sidebar'
import { FileExplorer } from './FileExplorer'
import { LayoutManager } from '../layout/LayoutManager'
import { CommandPalette } from '../layout/CommandPalette'
import { PopoutApp } from './PopoutApp'
import { ContextMenuProvider, PaneSettingsModal } from '../components'
import { useShortcuts, useShortcutsStore } from '../hooks/useShortcuts'
import { useLayoutStore } from '../layout/store'
import { useBroadcastStore } from '../layout/broadcastStore'
import { useSettingsStore } from '../store/settings'
import { useFusionStore } from '../panes/fusionStore'
import { useTerminalProfileStore } from '../panes/terminalProfileStore'
import { usePaneStateStore } from '../panes/paneStateStore'
import { closePaneWithCleanup, resolvePaneToClose } from '../layout/paneLifecycle'
import type { PaneConfig } from '../panes/types'
import type { MosaicNode } from 'react-mosaic-component'
import 'react-mosaic-component/react-mosaic-component.css'

// Detect popout mode from URL params
const isPopout = new URLSearchParams(window.location.search).has('popout')

function App() {
    // If this is a popout window, render minimal popout shell
    if (isPopout) return <PopoutApp />
    const setLayout = useLayoutStore((state) => state.setLayout)
    const layout = useLayoutStore((state) => state.layout)
    const setPaneType = useLayoutStore((state) => state.setPaneType)
    const saveLayout = useLayoutStore((state) => state.saveLayout)
    const loadLayout = useLayoutStore((state) => state.loadLayout)
    const spaces = useLayoutStore((state) => state.spaces)
    const panes = useLayoutStore((state) => state.panes)
    const tabGroups = useLayoutStore((state) => state.tabGroups)
    const updatePane = useLayoutStore((state) => state.updatePane)
    const loadShortcuts = useShortcutsStore((state) => state.loadShortcuts)
    const setActivePane = useShortcutsStore((state) => state.setActivePane)
    const loadSettings = useSettingsStore((state) => state.loadSettings)
    const toggleTheme = useSettingsStore((state) => state.toggleTheme)
    const loadPresetsFromStorage = useLayoutStore((state) => state.loadPresetsFromStorage)
    const loadFusions = useFusionStore((state) => state.loadFusions)
    const loadTerminalProfile = useTerminalProfileStore((state) => state.loadProfile)
    const paneStates = usePaneStateStore((state) => state.paneStates)
    const loadPaneStates = usePaneStateStore((state) => state.loadPaneStates)
    const savePaneStates = usePaneStateStore((state) => state.savePaneStates)
    const removeBroadcastPane = useBroadcastStore((state) => state.removePane)

    // Load everything on mount
    useEffect(() => {
        loadShortcuts()
        loadSettings()
        loadLayout()
        loadPresetsFromStorage()
        loadFusions()
        loadTerminalProfile()
        loadPaneStates()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-save when panes or spaces change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => saveLayout(), 800)
        return () => clearTimeout(timer)
    }, [panes, spaces, saveLayout])

    // Auto-save pane ambient state separately for restart restoration.
    useEffect(() => {
        const timer = setTimeout(() => savePaneStates(), 400)
        return () => clearTimeout(timer)
    }, [paneStates, savePaneStates])

    // Get all pane IDs in order
    const getAllPaneIds = (node: MosaicNode<string> | null): string[] => {
        if (!node) return []
        if (typeof node === 'string') return [node]
        return [...getAllPaneIds(node.first), ...getAllPaneIds(node.second)]
    }

    const paneIds = getAllPaneIds(layout)
    const allLivePaneIds = useMemo(() => new Set([
        ...paneIds,
        ...Object.values(tabGroups).flatMap(group => group.paneIds),
    ]), [paneIds, tabGroups])

    // Keep broadcast mappings clean when panes disappear
    useEffect(() => {
        const broadcastMap = useBroadcastStore.getState().paneGroupMap
        for (const trackedPaneId of Object.keys(broadcastMap)) {
            if (!allLivePaneIds.has(trackedPaneId)) {
                removeBroadcastPane(trackedPaneId)
            }
        }
    }, [allLivePaneIds, removeBroadcastPane])

    // Create a new pane
    const addPane = (type: 'empty' | 'terminal' | 'browser' | 'notes' | 'chat' | 'codeserver' = 'empty') => {
        const newId = `pane-${Date.now()}`
        const newLayout: MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId
        setLayout(newLayout)
        setActivePane(newId)
        if (type !== 'empty') {
            setTimeout(() => setPaneType(newId, type), 100)
        }
    }

    // Close active pane (fallback to last visible pane)
    const closePane = () => {
        const paneToRemove = resolvePaneToClose()
        if (!paneToRemove) return
        closePaneWithCleanup(paneToRemove)
    }

    // Focus pane by index
    const focusPane = (index: number) => {
        if (index < paneIds.length) {
            setActivePane(paneIds[index])
            const paneElement = document.querySelector(`[data-pane-id="${paneIds[index]}"]`)
            if (paneElement) {
                (paneElement as HTMLElement).focus()
            }
        }
    }

    // Next/Previous pane
    const currentIndex = paneIds.indexOf(useShortcutsStore.getState().activePane || '')
    const nextPane = () => focusPane((currentIndex + 1) % paneIds.length)
    const prevPane = () => focusPane((currentIndex - 1 + paneIds.length) % paneIds.length)

    // Setup shortcuts
    const { handleKeyDown } = useShortcuts({
        newPane: () => addPane('empty'),
        closePane,
        newTerminal: () => addPane('terminal'),
        newBrowser: () => addPane('browser'),
        newNotes: () => addPane('notes'),
        focusPane1: () => focusPane(0),
        focusPane2: () => focusPane(1),
        focusPane3: () => focusPane(2),
        focusPane4: () => focusPane(3),
        focusPane5: () => focusPane(4),
        nextPane,
        prevPane,
        toggleTheme,
        saveLayout: () => saveLayout(),
        commandPalette: () => {}, // handled by CommandPalette component directly
    })

    // Global keyboard listener & Drag prevention
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)

        // Prevent default drag/drop behavior to stop Electron from navigating to dropped files
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
        }
        const handleDrop = (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
        }

        window.addEventListener('dragover', handleDragOver)
        window.addEventListener('drop', handleDrop)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('dragover', handleDragOver)
            window.removeEventListener('drop', handleDrop)
        }
    }, [handleKeyDown])

    // Popout action bridge (popout window -> main renderer state)
    useEffect(() => {
        if (isPopout || !window.platform?.popout) return

        const offAction = window.platform.popout.onAction((action: any) => {
            if (!action || typeof action !== 'object') return

            if (action.type === 'ready' && typeof action.paneId === 'string') {
                const paneConfig = useLayoutStore.getState().panes[action.paneId]
                if (paneConfig) {
                    window.platform.popout?.stateRelay(action.paneId, {
                        paneConfig,
                        title: paneConfig.title ?? action.paneId,
                    })
                }
                return
            }

            if (
                action.type === 'pane:update' &&
                typeof action.paneId === 'string' &&
                action.paneConfig &&
                typeof action.paneConfig === 'object'
            ) {
                updatePane(action.paneId, action.paneConfig as Partial<PaneConfig>)
            }
        })

        return () => {
            offAction()
        }
    }, [updatePane])

    // Main renderer state -> popout windows
    useEffect(() => {
        if (isPopout || !window.platform?.popout) return
        Object.entries(panes).forEach(([paneId, paneConfig]) => {
            window.platform.popout?.stateRelay(paneId, {
                paneConfig,
                title: paneConfig.title ?? paneId,
            })
        })
    }, [panes])

    return (
        <ContextMenuProvider>
            <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
                <Titlebar />
                <div className="flex-1 flex overflow-hidden">
                    <Sidebar />
                    <FileExplorer />
                    <main className="flex-1 relative bg-background/50">
                        <LayoutManager />
                    </main>
                </div>
            </div>
            <CommandPalette />
            <PaneSettingsModal />
        </ContextMenuProvider>
    )
}

export default App
