import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import { create6ZoneGrid, findPathToNode, getNodeAtPath, setSplitPercentageAtPath } from './gridHelper'
import type { PaneConfig, PaneType } from '../panes/types'
import { useShortcutsStore } from '../hooks/useShortcuts'
import type { LayoutPreset, PresetPaneSnapshot } from './presets'
import type { TabGroup } from './TabbedPaneGroup'

export type PaneId = string
export type SpaceId = string
export interface Space {
    id: SpaceId
    name: string
    icon: string
    layout: MosaicNode<PaneId> | null
    panes: Record<PaneId, PaneConfig>
}

export interface LayoutState {
    // Spaces
    spaces: Space[]
    activeSpaceId: SpaceId

    // Current space shortcuts
    layout: MosaicNode<PaneId> | null
    panes: Record<PaneId, PaneConfig>

    // Space operations
    createSpace: (name: string, icon?: string) => void
    deleteSpace: (id: SpaceId) => void
    updateSpace: (id: SpaceId, updates: Partial<Space>) => void
    switchSpace: (id: SpaceId) => void

    // Layout operations
    setLayout: (layout: MosaicNode<PaneId> | null) => void
    setPaneType: (id: PaneId, type: PaneType) => void
    updatePane: (id: PaneId, updates: Partial<PaneConfig>) => void
    movePane: (id: PaneId, direction: 'left' | 'right' | 'top' | 'bottom') => void
    movePaneToZone: (id: PaneId, zone: 0 | 1 | 2 | 3 | 4 | 5) => void
    enforce6ZoneGrid: () => void
    togglePaneCollapse: (id: PaneId) => void
    openWorkflowFile: (filePath: string, fileContent: unknown) => void

    // Persistence
    saveLayout: () => Promise<void>
    loadLayout: () => Promise<void>

    // Layout helpers
    splitActivePane: (direction: 'row' | 'column') => void

    // Presets
    savedPresets: LayoutPreset[]
    saveCurrentAsPreset: (name: string) => void
    loadPreset: (preset: LayoutPreset) => void
    deletePreset: (id: string) => void
    loadPresetsFromStorage: () => Promise<void>

    // Tab Groups
    tabGroups: Record<string, TabGroup>
    createTabGroup: (paneIdA: PaneId, paneIdB: PaneId) => string | null
    addToTabGroup: (groupId: string, paneId: PaneId) => void
    removeFromTabGroup: (groupId: string, paneId: PaneId) => void
    setActiveTab: (groupId: string, paneId: PaneId) => void
    dissolveTabGroup: (groupId: string) => void

    // Clipboard Actions
    pasteToEditor: (content: string) => void
    pasteToNotes: (content: string) => void
    pasteToChat: (content: string) => void
    createPaneWithContent: (content: string, type: 'text' | 'code' | 'json' | 'url') => void
}

const createPane = (id: string): PaneConfig => ({
    id,
    type: 'empty',
    title: id,
})

const clonePaneData = (data: Record<string, unknown> | undefined) => {
    if (!data) return undefined
    try {
        return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
    } catch {
        return { ...data }
    }
}

const buildPresetDescription = (snapshots: Record<string, PresetPaneSnapshot>) =>
    Object.values(snapshots)
        .map((snapshot) => snapshot.title || snapshot.type)
        .join(' • ')

const DEFAULT_PANES: Record<PaneId, PaneConfig> = {
    'pane-1': createPane('pane-1'),
    'pane-2': createPane('pane-2'),
    'pane-3': createPane('pane-3'),
}

const DEFAULT_LAYOUT: MosaicNode<PaneId> = {
    direction: 'row',
    first: 'pane-1',
    second: {
        direction: 'column',
        first: 'pane-2',
        second: 'pane-3',
    },
    splitPercentage: 60,
}

const DEFAULT_SPACE: Space = {
    id: 'main',
    name: 'Main',
    icon: '🏠',
    layout: DEFAULT_LAYOUT,
    panes: DEFAULT_PANES,
}

// Helper to remove a node from the tree
function removeNode(root: MosaicNode<PaneId> | null, idToRemove: PaneId): MosaicNode<PaneId> | null {
    if (!root) return null
    if (typeof root === 'string') return root === idToRemove ? null : root

    const first = removeNode(root.first, idToRemove)
    const second = removeNode(root.second, idToRemove)

    if (!first) return second
    if (!second) return first

    return { ...root, first, second }
}

// Helper to add a node to the tree
function addNode(root: MosaicNode<PaneId> | null, idToAdd: PaneId, direction: 'left' | 'right' | 'top' | 'bottom'): MosaicNode<PaneId> {
    if (!root) return idToAdd

    const dir = direction === 'left' || direction === 'right' ? 'row' : 'column'
    const first = direction === 'left' || direction === 'top' ? idToAdd : root
    const second = direction === 'left' || direction === 'top' ? root : idToAdd

    return {
        direction: dir,
        first,
        second,
        splitPercentage: 50, // Default 50/50 split
    }
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
    spaces: [DEFAULT_SPACE],
    activeSpaceId: 'main',
    layout: DEFAULT_LAYOUT,
    panes: DEFAULT_PANES,
    savedPresets: [],
    tabGroups: {},

    createSpace: (name, icon = '📁') => {
        const newSpace: Space = {
            id: `space-${Date.now()}`,
            name,
            icon,
            layout: 'pane-1',
            panes: { 'pane-1': createPane('pane-1') },
        }
        set((state) => ({
            spaces: [...state.spaces, newSpace],
        }))
    },

    deleteSpace: (id) => {
        const { spaces, activeSpaceId } = get()
        if (spaces.length <= 1) return // Keep at least one space

        const newSpaces = spaces.filter((s) => s.id !== id)
        const wasActive = id === activeSpaceId

        set({
            spaces: newSpaces,
            ...(wasActive && {
                activeSpaceId: newSpaces[0].id,
                layout: newSpaces[0].layout,
                panes: newSpaces[0].panes,
            }),
        })
    },

    updateSpace: (id, updates) => {
        set((state) => ({
            spaces: state.spaces.map((s) =>
                s.id === id ? { ...s, ...updates } : s
            ),
        }))
    },

    renameSpace: (id: SpaceId, name: string) => { // Deprecated but kept for compatibility if needed, though we removed it from interface
        get().updateSpace(id, { name })
    },

    switchSpace: (id) => {
        const { spaces, activeSpaceId, layout, panes } = get()

        // Save current space state
        const updatedSpaces = spaces.map((s) =>
            s.id === activeSpaceId ? { ...s, layout, panes } : s
        )

        // Load target space
        const targetSpace = updatedSpaces.find((s) => s.id === id)
        if (targetSpace) {
            set({
                spaces: updatedSpaces,
                activeSpaceId: id,
                layout: targetSpace.layout,
                panes: targetSpace.panes,
            })
        }
    },

    setLayout: (layout) => {
        set({ layout })
        // Auto-register new panes
        const ids = getAllPaneIds(layout)
        const { panes } = get()
        const newPanes = { ...panes }
        let changed = false
        ids.forEach(id => {
            if (!newPanes[id]) {
                newPanes[id] = createPane(id)
                changed = true
            }
        })
        if (changed) set({ panes: newPanes })
    },

    setPaneType: (id, type) => {
        const { panes } = get()
        if (panes[id]) {
            set({
                panes: {
                    ...panes,
                    [id]: { ...panes[id], type, title: type === 'empty' ? id : type },
                },
            })
        }
    },

    updatePane: (id, updates) => {
        const { panes } = get()
        if (panes[id]) {
            set({
                panes: {
                    ...panes,
                    [id]: { ...panes[id], ...updates },
                },
            })
        }
    },

    // New Action: Move Pane
    movePane: (id: PaneId, direction: 'left' | 'right' | 'top' | 'bottom') => {
        const { layout } = get()
        if (!layout) return

        // 1. Remove from current position
        const layoutWithoutPane = removeNode(layout, id)

        // 2. Add to root at direction
        const newLayout = addNode(layoutWithoutPane, id, direction)

        set({ layout: newLayout })
    },

    // Move Pane to Zone (Swap logic)
    movePaneToZone: (id: PaneId, zone: number) => {
        const { layout } = get()

        // Strategy: 
        // 1. If layout is NOT 6-zone, we force it first? 
        //    Or we just best-effort?
        //    User wants "Snap", implying the grid exists or appears.
        //    Let's try to detect if we have at least 6 panes.
        //    If not, we create empty ones.

        // For this specific features, let's enforce 6-zone grid first if we assume the user wants that mode.
        // But doing it implicitly might be jarring. 
        // Let's check if we have a way to find the "zone" in current layout.

        // Simpler approach: 
        // Just enforce 6-zone grid with current panes, placing `id` in `zone`.

        const allIds = getAllPaneIds(layout)

        // Remove current id from list to re-insert it
        const otherIds = allIds.filter(pid => pid !== id)

        // Ensure we have enough placeholders if < 5 others
        const needed = 5 - otherIds.length
        let placeholders: PaneId[] = []
        if (needed > 0) {
            const { panes } = get()
            const newPanes = { ...panes }
            for (let i = 0; i < needed; i++) {
                const pid = `empty-${Date.now()}-${i}`
                newPanes[pid] = { id: pid, type: 'empty', title: 'Empty Slot' }
                placeholders.push(pid)
            }
            set({ panes: newPanes })
        }

        // Combine to get 6 IDs, correctly ordered
        // We want `id` at `zone`.
        // Others fill the rest.
        const finalIds = new Array(6).fill(null)
        finalIds[zone] = id

        let pool = [...otherIds, ...placeholders]
        for (let i = 0; i < 6; i++) {
            if (finalIds[i] === null) {
                finalIds[i] = pool.shift()
            }
        }

        // Generate new layout
        const newLayout = create6ZoneGrid(finalIds as PaneId[])
        set({ layout: newLayout })
    },

    enforce6ZoneGrid: () => {
        const { layout } = get()
        const allIds = getAllPaneIds(layout)
        // Logic similar to above but just filling sequentially
        // ... implementation ...
        // keeping it shared/dry would be better but inline is fast for now

        const { panes } = get()
        const newPanes = { ...panes }
        const needed = 6 - allIds.length
        const placeholders: PaneId[] = []

        if (needed > 0) {
            for (let i = 0; i < needed; i++) {
                const pid = `empty-${Date.now()}-${i}`
                newPanes[pid] = { id: pid, type: 'empty', title: 'Empty Slot' }
                placeholders.push(pid)
            }
            set({ panes: newPanes })
        }

        const finalIds = [...allIds, ...placeholders].slice(0, 6)
        const newLayout = create6ZoneGrid(finalIds)
        set({ layout: newLayout })
    },

    togglePaneCollapse: (id: PaneId) => {
        const { layout, panes } = get()
        if (!layout) return

        const paneConfig = panes[id]
        if (!paneConfig) return

        const isCollapsing = !paneConfig.collapsed
        let newLayout = layout
        let newPanes = { ...panes }

        // 1. Find the parent node of this pane
        const path = findPathToNode(layout, id)

        if (path && path.length > 0) {
            // We have a parent
            // We need to update the splitPercentage of the parent
            // But we need to update the layout TREE, which is immutable-ish.
            // We need a helper to update a node at a path.

            // Actually, we can just use `updateTree` helper if we write one, or `mosaicActions` if we were in the component.
            // But here we are in the store. We must manipulate the JSON tree.

            // Let's implement `updateNodeAtPath`.

            // Logic:
            // - Get parent path (pop last)
            // - Get direction of self (last item)
            // - Update splitPercentage

            const position = path[path.length - 1] // 'first' or 'second'
            const parentPath = path.slice(0, -1)

            // Get current parent to save split if needed
            const parentNode = getNodeAtPath(layout, parentPath) as MosaicNode<PaneId> & { splitPercentage?: number }

            if (parentNode && typeof parentNode === 'object') {
                if (isCollapsing) {
                    // Save current split
                    newPanes[id] = {
                        ...paneConfig,
                        collapsed: true,
                        prevSplitPercentage: parentNode.splitPercentage
                    }

                    // Set new split
                    // If we are 'first', we want 5% (small). If 'second', we want 95% (large space for first, small for second).
                    const newSplit = position === 'first' ? 5 : 95
                    newLayout = setSplitPercentageAtPath(layout, parentPath, newSplit) as MosaicNode<PaneId>
                } else {
                    // Restore split
                    const savedSplit = paneConfig.prevSplitPercentage ?? 50
                    newPanes[id] = {
                        ...paneConfig,
                        collapsed: false,
                        prevSplitPercentage: undefined
                    }
                    newLayout = setSplitPercentageAtPath(layout, parentPath, savedSplit) as MosaicNode<PaneId>
                }
            } else {
                // Root node or weird state? Just toggle flag
                newPanes[id] = { ...paneConfig, collapsed: isCollapsing }
            }
        } else {
            newPanes[id] = { ...paneConfig, collapsed: isCollapsing }
        }

        set({ layout: newLayout, panes: newPanes })
    },

    openWorkflowFile: (filePath, fileContent) => {
        const { layout, panes } = get()

        // Normalize to save-data format
        let saveData: Record<string, unknown>
        const raw = fileContent as Record<string, unknown>
        if (Array.isArray(raw?.nodes)) {
            // WorkflowDefinition format → convert to save data
            saveData = {
                workflowNodes: raw.nodes,
                workflowEdges: raw.edges ?? [],
                workflowName: raw.name ?? 'Workflow',
                workflowVariables: raw.variables ?? {},
                filePath,
            }
        } else if (Array.isArray(raw?.workflowNodes)) {
            // Already save-data format
            saveData = { ...raw, filePath }
        } else {
            console.warn('openWorkflowFile: unrecognized format', fileContent)
            return
        }

        const fileName = filePath.split('/').pop() ?? filePath
        const title = fileName.replace(/\.json$/i, '')
        const newId = `pane-${Date.now()}`
        const newPane: PaneConfig = { id: newId, type: 'workflow', title, data: saveData }

        const newLayout: MosaicNode<PaneId> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 65 }
            : newId

        set({
            layout: newLayout,
            panes: { ...panes, [newId]: newPane },
        })
    },

    saveLayout: async () => {
        const { spaces, activeSpaceId, layout, panes } = get()

        // Update active space before saving
        const spacesToSave = spaces.map((s) =>
            s.id === activeSpaceId ? { ...s, layout, panes } : s
        )

        if (window.platform?.storage) {
            await window.platform.storage.save('workspace', JSON.stringify({
                spaces: spacesToSave,
                activeSpaceId,
            }))
        }
    },

    loadLayout: async () => {
        if (window.platform?.storage) {
            const saved = await window.platform.storage.load('workspace')
            if (saved) {
                try {
                    const data = JSON.parse(saved)
                    if (data.spaces) {
                        const activeSpace = data.spaces.find((s: Space) => s.id === data.activeSpaceId) || data.spaces[0]
                        set({
                            spaces: data.spaces,
                            activeSpaceId: data.activeSpaceId,
                            layout: activeSpace?.layout || DEFAULT_LAYOUT,
                            panes: activeSpace?.panes || DEFAULT_PANES,
                        })
                    } else {
                        // Legacy format (no spaces)
                        set({ layout: data.layout, panes: data.panes })
                    }
                } catch (e) {
                    console.warn('Failed to parse saved workspace', e)
                }
            }
        }
    },

    // Layout helpers
    splitActivePane: (direction: 'row' | 'column') => {
        const { layout, panes } = get()
        const activePane = useShortcutsStore.getState().activePane
        if (!layout || !activePane) return

        const newId = `pane-${Date.now()}`
        const path = findPathToNode(layout, activePane)
        if (!path) return

        // Wrap the active pane in a split with a new empty pane
        const newNode = {
            direction,
            first: activePane,
            second: newId,
            splitPercentage: 50,
        }

        if (path.length === 0) {
            // Active pane is root
            set({ layout: newNode, panes: { ...panes, [newId]: { id: newId, type: 'empty' as const, title: newId } } })
        } else {
            // Replace at path
            const parentPath = path.slice(0, -1)
            const branch = path[path.length - 1] // 'first' | 'second'

            const updateAtPath = (node: MosaicNode<PaneId>, p: string[], idx: number): MosaicNode<PaneId> => {
                if (typeof node === 'string') return node
                if (idx === p.length) {
                    // Replace the branch
                    return branch === 'first'
                        ? { ...node, first: newNode }
                        : { ...node, second: newNode }
                }
                const dir = p[idx]
                if (dir === 'first') return { ...node, first: updateAtPath(node.first, p, idx + 1) }
                return { ...node, second: updateAtPath(node.second, p, idx + 1) }
            }

            const newLayout = parentPath.length === 0
                ? (branch === 'first'
                    ? { ...(layout as any), first: newNode }
                    : { ...(layout as any), second: newNode })
                : updateAtPath(layout, parentPath, 0)

            set({ layout: newLayout, panes: { ...panes, [newId]: { id: newId, type: 'empty' as const, title: newId } } })
        }
    },

    // Tab Group Implementations
    createTabGroup: (paneIdA, paneIdB) => {
        const { layout, panes, tabGroups } = get()
        if (!layout || !panes[paneIdA] || !panes[paneIdB]) return null

        const groupId = `tabgroup-${Date.now()}`
        const newGroup: TabGroup = { id: groupId, paneIds: [paneIdA, paneIdB], activeId: paneIdA }

        // Remove paneIdB from the mosaic tree, replace paneIdA with the groupId
        const remapLayout = (node: MosaicNode<PaneId>): MosaicNode<PaneId> => {
            if (typeof node === 'string') {
                return node === paneIdA ? groupId : node
            }
            const first = remapLayout(node.first)
            const second = remapLayout(node.second)
            return { ...node, first, second }
        }
        const layoutWithoutB = removeNode(layout, paneIdB)
        if (!layoutWithoutB) return null
        const newLayout = remapLayout(layoutWithoutB)

        set({ layout: newLayout, tabGroups: { ...tabGroups, [groupId]: newGroup } })
        return groupId
    },

    addToTabGroup: (groupId, paneId) => {
        const { layout, tabGroups } = get()
        const group = tabGroups[groupId]
        if (!group || !layout) return
        if (group.paneIds.includes(paneId)) return

        const newLayout = removeNode(layout, paneId)
        const newGroup = { ...group, paneIds: [...group.paneIds, paneId] }
        set({ layout: newLayout, tabGroups: { ...tabGroups, [groupId]: newGroup } })
    },

    removeFromTabGroup: (groupId, paneId) => {
        const { layout, tabGroups } = get()
        const group = tabGroups[groupId]
        if (!group || !layout) return

        const remaining = group.paneIds.filter(id => id !== paneId)

        if (remaining.length <= 1) {
            // Dissolve: replace groupId in tree with the remaining pane (or the removed one if empty)
            const replacementId = remaining[0] || paneId
            const remapLayout = (node: MosaicNode<PaneId>): MosaicNode<PaneId> => {
                if (typeof node === 'string') return node === groupId ? replacementId : node
                return { ...node, first: remapLayout(node.first), second: remapLayout(node.second) }
            }
            const newLayout = remapLayout(layout)
            const newTabGroups = { ...tabGroups }
            delete newTabGroups[groupId]

            // Add the removed pane back as a new split if there was a remaining pane
            if (remaining.length === 1) {
                const finalLayout: MosaicNode<PaneId> = { direction: 'row', first: newLayout, second: paneId, splitPercentage: 70 }
                set({ layout: finalLayout, tabGroups: newTabGroups })
            } else {
                set({ layout: newLayout, tabGroups: newTabGroups })
            }
        } else {
            const newGroup = {
                ...group,
                paneIds: remaining,
                activeId: group.activeId === paneId ? remaining[0] : group.activeId,
            }
            // Put removed pane back in mosaic as a new split
            const newLayout: MosaicNode<PaneId> = { direction: 'row', first: layout, second: paneId, splitPercentage: 70 }
            set({ layout: newLayout, tabGroups: { ...tabGroups, [groupId]: newGroup } })
        }
    },

    setActiveTab: (groupId, paneId) => {
        const { tabGroups } = get()
        const group = tabGroups[groupId]
        if (!group || !group.paneIds.includes(paneId)) return
        set({ tabGroups: { ...tabGroups, [groupId]: { ...group, activeId: paneId } } })
    },

    dissolveTabGroup: (groupId) => {
        const { layout, tabGroups } = get()
        const group = tabGroups[groupId]
        if (!group || !layout) return

        // Replace the groupId in the tree with a split of all contained panes
        const buildSplit = (ids: string[]): MosaicNode<PaneId> => {
            if (ids.length === 1) return ids[0]
            const mid = Math.ceil(ids.length / 2)
            return {
                direction: 'column' as const,
                first: buildSplit(ids.slice(0, mid)),
                second: buildSplit(ids.slice(mid)),
                splitPercentage: 50,
            }
        }
        const replacement = buildSplit(group.paneIds)

        const remapLayout = (node: MosaicNode<PaneId>): MosaicNode<PaneId> => {
            if (typeof node === 'string') return node === groupId ? replacement : node
            return { ...node, first: remapLayout(node.first), second: remapLayout(node.second) }
        }

        const newTabGroups = { ...tabGroups }
        delete newTabGroups[groupId]
        set({ layout: remapLayout(layout), tabGroups: newTabGroups })
    },

    // Preset Implementations
    saveCurrentAsPreset: (name) => {
        const { layout, panes, savedPresets } = get()
        if (!layout) return

        const ids = getAllPaneIds(layout)
        const abstractMap: Record<string, string> = {}
        const paneTypes: Record<string, PaneType> = {}
        const paneSnapshots: Record<string, PresetPaneSnapshot> = {}
        ids.forEach((id, i) => {
            const key = String.fromCharCode(97 + i) // a, b, c, ...
            abstractMap[id] = key
            const sourcePane = panes[id]
            const paneType = sourcePane?.type || 'empty'
            paneTypes[key] = paneType
            paneSnapshots[key] = {
                type: paneType,
                title: sourcePane?.title,
                data: clonePaneData(sourcePane?.data),
            }
        })

        const remapLayout = (node: MosaicNode<string>): MosaicNode<string> => {
            if (typeof node === 'string') return abstractMap[node] || node
            return { ...node, first: remapLayout(node.first), second: remapLayout(node.second) }
        }

        const preset: LayoutPreset = {
            id: `preset-${Date.now()}`,
            name,
            description: buildPresetDescription(paneSnapshots),
            icon: '📐',
            category: 'Custom',
            paneTypes,
            paneSnapshots,
            layout: remapLayout(layout),
        }

        const newPresets = [...savedPresets, preset]
        set({ savedPresets: newPresets })
        window.platform?.storage?.save('presets', JSON.stringify(newPresets))
    },

    loadPreset: (preset) => {
        const idMap: Record<string, string> = {}
        const newPanes: Record<string, PaneConfig> = {}

        for (const [abstractId, paneType] of Object.entries(preset.paneTypes)) {
            const realId = `pane-${Date.now()}-${abstractId}`
            const snapshot = preset.paneSnapshots?.[abstractId]
            idMap[abstractId] = realId
            newPanes[realId] = {
                id: realId,
                type: snapshot?.type || paneType,
                title: snapshot?.title || paneType,
                data: clonePaneData(snapshot?.data),
            }
        }

        const remapLayout = (node: MosaicNode<string>): MosaicNode<string> => {
            if (typeof node === 'string') return idMap[node] || node
            return { ...node, first: remapLayout(node.first), second: remapLayout(node.second) }
        }

        set({ layout: remapLayout(preset.layout), panes: newPanes })
    },

    deletePreset: (id) => {
        const newPresets = get().savedPresets.filter(p => p.id !== id)
        set({ savedPresets: newPresets })
        window.platform?.storage?.save('presets', JSON.stringify(newPresets))
    },

    loadPresetsFromStorage: async () => {
        if (window.platform?.storage) {
            const saved = await window.platform.storage.load('presets')
            if (saved) {
                try {
                    const parsed = JSON.parse(saved) as LayoutPreset[]
                    const normalized = parsed.map((preset) => ({
                        ...preset,
                        paneSnapshots: preset.paneSnapshots || Object.fromEntries(
                            Object.entries(preset.paneTypes || {}).map(([paneId, paneType]) => [
                                paneId,
                                { type: paneType, title: paneType },
                            ])
                        ),
                    }))
                    set({ savedPresets: normalized })
                } catch (e) {
                    console.warn('Failed to parse saved presets', e)
                }
            }
        }
    },

    // Clipboard Implementations
    pasteToEditor: (content) => {
        const { panes } = get()
        const editorId = Object.keys(panes).find(id => panes[id].type === 'editor')

        if (editorId) {
            const pane = panes[editorId]
            const currentContent = (pane.data?.content || '') as string
            const newContent = currentContent ? currentContent + '\n' + content : content

            get().updatePane(editorId, {
                data: { ...pane.data, content: newContent }
            })
        } else {
            get().createPaneWithContent(content, 'code')
        }
    },

    pasteToNotes: (content) => {
        const { panes } = get()
        const notesId = Object.keys(panes).find(id => panes[id].type === 'notes')

        if (notesId) {
            const pane = panes[notesId]
            const currentContent = (pane.data?.content || '') as string
            const newContent = currentContent ? currentContent + '\n\n' + content : content

            get().updatePane(notesId, {
                data: { ...pane.data, content: newContent }
            })
        } else {
            get().createPaneWithContent(content, 'text')
        }
    },

    pasteToChat: (content) => {
        const { panes } = get()
        const chatId = Object.keys(panes).find(id => panes[id].type === 'chat')

        if (chatId) {
            const pane = panes[chatId]
            get().updatePane(chatId, {
                data: { ...pane.data, inputDraft: content }
            })
        } else {
            get().createPaneWithContent(content, 'text')
        }
    },

    createPaneWithContent: (content, type) => {
        const { layout, panes } = get()
        const newId = `pane-${Date.now()}`

        let paneType: PaneType = 'notes'
        if (type === 'code' || type === 'json') paneType = 'editor'
        if (type === 'url') paneType = 'browser'

        // Generate a unique filename for editor content
        const timestamp = Date.now();
        const extension = type === 'json' ? 'json' : 'txt';
        const editorFilePath = paneType === 'editor' ? `/Untitled-${timestamp}.${extension}` : undefined;

        const newPane: PaneConfig = {
            id: newId,
            type: paneType,
            title: paneType === 'browser' ? content : (paneType === 'editor' ? `Untitled-${timestamp}` : 'New Note'),
            data: {
                content,
                url: type === 'url' ? content : undefined,
                editorFilePath, // Pass the unique path
                lastPaste: timestamp // Ensure useEffect triggers
            }
        }

        const newLayout: MosaicNode<PaneId> = layout
            ? { direction: 'row', first: layout, second: newId, splitPercentage: 70 }
            : newId

        set({
            layout: newLayout,
            panes: { ...panes, [newId]: newPane }
        })
    }
}))

// Helper to extract all pane IDs from layout tree
function getAllPaneIds(node: MosaicNode<PaneId> | null): PaneId[] {
    if (!node) return []
    if (typeof node === 'string') return [node]
    return [...getAllPaneIds(node.first), ...getAllPaneIds(node.second)]
}

export { getAllPaneIds }
