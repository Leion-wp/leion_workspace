import { useEffect } from 'react'
import { Titlebar } from './Titlebar'
import { Sidebar } from './Sidebar'
import { FileExplorer } from './FileExplorer'
import { LayoutManager } from '../layout/LayoutManager'
import { CommandPalette } from '../layout/CommandPalette'
import { PopoutApp } from './PopoutApp'
import { ContextMenuProvider } from '../components'
import { useShortcuts, useShortcutsStore } from '../hooks/useShortcuts'
import { useLayoutStore } from '../layout/store'
import { useSettingsStore } from '../store/settings'
import { useFusionStore } from '../panes/fusionStore'
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
    const loadShortcuts = useShortcutsStore((state) => state.loadShortcuts)
    const setActivePane = useShortcutsStore((state) => state.setActivePane)
    const loadSettings = useSettingsStore((state) => state.loadSettings)
    const loadPresetsFromStorage = useLayoutStore((state) => state.loadPresetsFromStorage)
    const loadFusions = useFusionStore((state) => state.loadFusions)

    // Load everything on mount
    useEffect(() => {
        loadShortcuts()
        loadSettings()
        loadLayout()
        loadPresetsFromStorage()
        loadFusions()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-save when panes or spaces change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => saveLayout(), 800)
        return () => clearTimeout(timer)
    }, [panes, spaces, saveLayout])

    // Get all pane IDs in order
    const getAllPaneIds = (node: MosaicNode<string> | null): string[] => {
        if (!node) return []
        if (typeof node === 'string') return [node]
        return [...getAllPaneIds(node.first), ...getAllPaneIds(node.second)]
    }

    const paneIds = getAllPaneIds(layout)

    // Create a new pane
    const addPane = (type: 'empty' | 'terminal' | 'browser' | 'notes' | 'chat' | 'codeserver' = 'empty') => {
        const newId = `pane-${Date.now()}`
        const newLayout: MosaicNode<string> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId
        setLayout(newLayout)
        if (type !== 'empty') {
            setTimeout(() => setPaneType(newId, type), 100)
        }
    }

    // Close active pane (or first pane if none active)
    const closePane = () => {
        if (paneIds.length <= 1) return // Keep at least one pane

        const removePane = (node: MosaicNode<string> | null, idToRemove: string): MosaicNode<string> | null => {
            if (!node) return null
            if (typeof node === 'string') return node === idToRemove ? null : node

            const first = removePane(node.first, idToRemove)
            const second = removePane(node.second, idToRemove)

            if (!first) return second as MosaicNode<string>
            if (!second) return first as MosaicNode<string>
            return { ...node, first, second }
        }

        const paneToRemove = paneIds[paneIds.length - 1] // Remove last pane
        setLayout(removePane(layout, paneToRemove))
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
        </ContextMenuProvider>
    )
}

export default App
