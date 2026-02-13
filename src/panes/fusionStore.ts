import { create } from 'zustand'

export interface PaneFusion {
    id: string
    name: string
    color: string
    paneIds: Set<string>
    sharedContext: {
        cwd?: string
        envVars?: Record<string, string>
    }
}

const FUSION_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

interface FusionState {
    fusions: Record<string, PaneFusion>
    paneToFusion: Record<string, string> // paneId -> fusionId

    createFusion: (name: string, paneIds: string[]) => string
    addToFusion: (fusionId: string, paneId: string) => void
    removeFromFusion: (paneId: string) => void
    deleteFusion: (fusionId: string) => void
    updateSharedContext: (fusionId: string, ctx: Partial<PaneFusion['sharedContext']>) => void
    getFusionForPane: (paneId: string) => PaneFusion | null
    getFusionColor: (paneId: string) => string | null

    // Quick-link: add pane to existing fusion or create new one with another pane
    linkPanes: (paneIdA: string, paneIdB: string) => void
    unlinkPane: (paneId: string) => void

    saveFusions: () => void
    loadFusions: () => void
}

export const useFusionStore = create<FusionState>((set, get) => ({
    fusions: {},
    paneToFusion: {},

    createFusion: (name, paneIds) => {
        const id = `fusion-${Date.now()}`
        const colorIdx = Object.keys(get().fusions).length % FUSION_COLORS.length
        const fusion: PaneFusion = {
            id,
            name,
            color: FUSION_COLORS[colorIdx],
            paneIds: new Set(paneIds),
            sharedContext: {},
        }
        const newPaneToFusion = { ...get().paneToFusion }
        for (const pid of paneIds) {
            newPaneToFusion[pid] = id
        }
        set({ fusions: { ...get().fusions, [id]: fusion }, paneToFusion: newPaneToFusion })
        get().saveFusions()
        return id
    },

    addToFusion: (fusionId, paneId) => {
        const fusion = get().fusions[fusionId]
        if (!fusion) return
        const updated = { ...fusion, paneIds: new Set([...fusion.paneIds, paneId]) }
        set({
            fusions: { ...get().fusions, [fusionId]: updated },
            paneToFusion: { ...get().paneToFusion, [paneId]: fusionId },
        })
        get().saveFusions()
    },

    removeFromFusion: (paneId) => {
        const fusionId = get().paneToFusion[paneId]
        if (!fusionId) return
        const fusion = get().fusions[fusionId]
        if (!fusion) return
        const newPaneIds = new Set(fusion.paneIds)
        newPaneIds.delete(paneId)
        const newPaneToFusion = { ...get().paneToFusion }
        delete newPaneToFusion[paneId]
        if (newPaneIds.size < 2) {
            // Dissolve fusion if only 1 or 0 panes left
            const newFusions = { ...get().fusions }
            delete newFusions[fusionId]
            // Also remove remaining pane from mapping
            for (const pid of newPaneIds) {
                delete newPaneToFusion[pid]
            }
            set({ fusions: newFusions, paneToFusion: newPaneToFusion })
        } else {
            set({
                fusions: { ...get().fusions, [fusionId]: { ...fusion, paneIds: newPaneIds } },
                paneToFusion: newPaneToFusion,
            })
        }
        get().saveFusions()
    },

    deleteFusion: (fusionId) => {
        const fusion = get().fusions[fusionId]
        if (!fusion) return
        const newFusions = { ...get().fusions }
        delete newFusions[fusionId]
        const newPaneToFusion = { ...get().paneToFusion }
        for (const pid of fusion.paneIds) {
            delete newPaneToFusion[pid]
        }
        set({ fusions: newFusions, paneToFusion: newPaneToFusion })
        get().saveFusions()
    },

    updateSharedContext: (fusionId, ctx) => {
        const fusion = get().fusions[fusionId]
        if (!fusion) return
        set({
            fusions: {
                ...get().fusions,
                [fusionId]: {
                    ...fusion,
                    sharedContext: { ...fusion.sharedContext, ...ctx },
                },
            },
        })
    },

    getFusionForPane: (paneId) => {
        const fusionId = get().paneToFusion[paneId]
        if (!fusionId) return null
        return get().fusions[fusionId] || null
    },

    getFusionColor: (paneId) => {
        const fusion = get().getFusionForPane(paneId)
        return fusion?.color || null
    },

    linkPanes: (paneIdA, paneIdB) => {
        const existingA = get().paneToFusion[paneIdA]
        const existingB = get().paneToFusion[paneIdB]
        if (existingA) {
            get().addToFusion(existingA, paneIdB)
        } else if (existingB) {
            get().addToFusion(existingB, paneIdA)
        } else {
            get().createFusion('Fusion', [paneIdA, paneIdB])
        }
    },

    unlinkPane: (paneId) => {
        get().removeFromFusion(paneId)
    },

    saveFusions: () => {
        const { fusions } = get()
        // Serialize Sets to arrays for JSON
        const serializable: Record<string, any> = {}
        for (const [id, f] of Object.entries(fusions)) {
            serializable[id] = { ...f, paneIds: [...f.paneIds] }
        }
        window.platform?.storage.save('fusions', JSON.stringify(serializable)).catch(() => {})
    },

    loadFusions: () => {
        window.platform?.storage.load('fusions').then(raw => {
            if (!raw) return
            try {
                const parsed = JSON.parse(raw)
                const fusions: Record<string, PaneFusion> = {}
                const paneToFusion: Record<string, string> = {}
                for (const [id, f] of Object.entries(parsed as Record<string, any>)) {
                    const paneIds = new Set<string>(f.paneIds || [])
                    fusions[id] = { ...f, paneIds }
                    for (const pid of paneIds) {
                        paneToFusion[pid] = id
                    }
                }
                set({ fusions, paneToFusion })
            } catch {}
        }).catch(() => {})
    },
}))
