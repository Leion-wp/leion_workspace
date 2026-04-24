import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Copy, Settings2, X } from 'lucide-react'
import { useLayoutStore } from '../layout/store'
import { closePaneWithCleanup } from '../layout/paneLifecycle'
import { PANE_TYPES, type BrowserTab, type PaneType } from '../panes/types'
import { Button } from './ui/button'
import { Input } from './ui/input'

type PaneSettingsEvent = CustomEvent<{ paneId: string }>

function getActiveBrowserTab(tabs: BrowserTab[] | undefined, activeTabId: string | undefined) {
    if (!tabs || tabs.length === 0) return null
    return tabs.find((tab) => tab.id === activeTabId) || tabs[0]
}

function normalizePaneData(type: PaneType, draft: Record<string, unknown>) {
    if (type === 'browser') {
        const tabs = Array.isArray(draft.tabs) ? (draft.tabs as BrowserTab[]) : []
        const activeTabId = typeof draft.activeTabId === 'string' ? draft.activeTabId : tabs[0]?.id
        const url = typeof draft.browserUrlDraft === 'string' ? draft.browserUrlDraft.trim() : ''
        const { browserUrlDraft, ...rest } = draft
        if (url) {
            const nextTabs = tabs.length > 0 ? tabs.map((tab) => tab.id === activeTabId ? { ...tab, url, isSecure: url.startsWith('https') } : tab) : [{
                id: `tab-${Date.now()}`,
                url,
                title: url,
                favicon: '',
                isLoading: false,
                isSecure: url.startsWith('https'),
            }]
            return {
                ...rest,
                tabs: nextTabs,
                activeTabId: activeTabId || nextTabs[0]?.id,
            }
        }
        return rest
    }

    return draft
}

export function PaneSettingsModal() {
    const [paneId, setPaneId] = useState<string | null>(null)
    const pane = useLayoutStore((state) => (paneId ? state.panes[paneId] : null))
    const updatePane = useLayoutStore((state) => state.updatePane)
    const setPaneType = useLayoutStore((state) => state.setPaneType)
    const layout = useLayoutStore((state) => state.layout)
    const panes = useLayoutStore((state) => state.panes)

    const [title, setTitle] = useState('')
    const [type, setType] = useState<PaneType>('empty')
    const [draftData, setDraftData] = useState<Record<string, unknown>>({})

    useEffect(() => {
        const open = (event: Event) => {
            const customEvent = event as PaneSettingsEvent
            if (customEvent.detail?.paneId) {
                setPaneId(customEvent.detail.paneId)
            }
        }
        window.addEventListener('leion:open-pane-settings', open as EventListener)
        return () => window.removeEventListener('leion:open-pane-settings', open as EventListener)
    }, [])

    useEffect(() => {
        if (!paneId || !pane) return
        setTitle(pane.title || '')
        setType(pane.type)
        setDraftData({ ...(pane.data || {}) })
    }, [paneId, pane])

    const canDuplicate = useMemo(() => Boolean(paneId && pane && layout), [paneId, pane, layout])

    if (!paneId || !pane) return null

    const browserTabs = Array.isArray(draftData.tabs) ? draftData.tabs as BrowserTab[] : []
    const browserActiveTabId = typeof draftData.activeTabId === 'string' ? draftData.activeTabId : undefined
    const activeBrowserTab = getActiveBrowserTab(browserTabs, browserActiveTabId)

    const applyChanges = () => {
        if (type !== pane.type) {
            setPaneType(paneId, type)
        }

        const normalizedData = normalizePaneData(type, draftData)
        updatePane(paneId, {
            title: title.trim() || PANE_TYPES[type].label,
            data: normalizedData,
        })
        setPaneId(null)
    }

    const duplicatePane = () => {
        if (!paneId || !canDuplicate) return
        const newId = `pane-${Date.now()}`
        useLayoutStore.getState().setLayout(layout ? {
            direction: 'row',
            first: layout,
            second: newId,
            splitPercentage: 70,
        } : newId)
        useLayoutStore.getState().setPaneType(newId, type)
        useLayoutStore.getState().updatePane(newId, {
            title: title.trim() ? `${title.trim()} copy` : `${PANE_TYPES[type].label} copy`,
            data: normalizePaneData(type, draftData),
        })
        setPaneId(null)
    }

    const openPopout = async () => {
        await window.platform?.popout?.open?.(paneId, panes[paneId])
    }

    return (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setPaneId(null)}>
            <div className="w-[720px] max-w-[92vw] max-h-[88vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Settings2 size={18} />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-foreground">Pane settings</div>
                            <div className="text-xs text-muted-foreground">{paneId}</div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPaneId(null)}>
                        <X size={16} />
                    </Button>
                </div>

                <div className="space-y-6 overflow-y-auto px-5 py-5">
                    <section className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Title</label>
                            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={PANE_TYPES[type].label} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Pane type</label>
                            <select
                                value={type}
                                onChange={(event) => setType(event.target.value as PaneType)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {Object.entries(PANE_TYPES).map(([value, info]) => (
                                    <option key={value} value={value}>{info.icon} {info.label}</option>
                                ))}
                            </select>
                        </div>
                    </section>

                    {(type === 'terminal' || type === 'gemini') && (
                        <section className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
                            <div>
                                <div className="text-sm font-medium text-foreground">Terminal options</div>
                                <div className="text-xs text-muted-foreground">Override the shared terminal profile for this pane only.</div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Working directory</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={typeof draftData.cwd === 'string' ? draftData.cwd : ''}
                                        onChange={(event) => setDraftData((current) => ({ ...current, cwd: event.target.value }))}
                                        placeholder="D:\\project"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            const selected = await window.platform?.fs?.openFolderDialog?.()
                                            if (selected) {
                                                setDraftData((current) => ({ ...current, cwd: selected }))
                                            }
                                        }}
                                    >
                                        Browse
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Startup commands</label>
                                <textarea
                                    value={typeof draftData.initCommands === 'string' ? draftData.initCommands : ''}
                                    onChange={(event) => setDraftData((current) => ({ ...current, initCommands: event.target.value }))}
                                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    placeholder={'chcp 65001\nnpm run dev'}
                                />
                            </div>
                        </section>
                    )}

                    {type === 'browser' && (
                        <section className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
                            <div>
                                <div className="text-sm font-medium text-foreground">Browser options</div>
                                <div className="text-xs text-muted-foreground">Apply a URL directly to the active tab in this pane.</div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Active tab URL</label>
                                <Input
                                    value={typeof draftData.browserUrlDraft === 'string' ? draftData.browserUrlDraft : (activeBrowserTab?.url || '')}
                                    onChange={(event) => setDraftData((current) => ({ ...current, browserUrlDraft: event.target.value }))}
                                    placeholder="https://example.com"
                                />
                            </div>
                        </section>
                    )}

                    {type === 'editor' && (
                        <section className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
                            <div>
                                <div className="text-sm font-medium text-foreground">Editor options</div>
                                <div className="text-xs text-muted-foreground">Persist the workspace root and explorer visibility for this pane.</div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Workspace root</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={typeof draftData.editorRootPath === 'string' ? draftData.editorRootPath : ''}
                                        onChange={(event) => setDraftData((current) => ({ ...current, editorRootPath: event.target.value }))}
                                        placeholder="D:\\leion_workspace"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            const selected = await window.platform?.fs?.openFolderDialog?.()
                                            if (selected) {
                                                setDraftData((current) => ({ ...current, editorRootPath: selected }))
                                            }
                                        }}
                                    >
                                        Browse
                                    </Button>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                    type="checkbox"
                                    checked={Boolean(draftData.editorShowSidebar)}
                                    onChange={(event) => setDraftData((current) => ({ ...current, editorShowSidebar: event.target.checked }))}
                                />
                                Keep explorer opened in this pane
                            </label>
                        </section>
                    )}

                    {type === 'codeserver' && (
                        <section className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
                            <div>
                                <div className="text-sm font-medium text-foreground">VS Code pane options</div>
                                <div className="text-xs text-muted-foreground">Tune the embedded code-server target.</div>
                            </div>
                            <div className="grid grid-cols-[1fr_120px] gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Workspace path</label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={typeof draftData.workspacePath === 'string' ? draftData.workspacePath : ''}
                                            onChange={(event) => setDraftData((current) => ({ ...current, workspacePath: event.target.value }))}
                                            placeholder="D:\\leion_workspace"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={async () => {
                                                const selected = await window.platform?.fs?.openFolderDialog?.()
                                                if (selected) {
                                                    setDraftData((current) => ({ ...current, workspacePath: selected }))
                                                }
                                            }}
                                        >
                                            Browse
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Port</label>
                                    <Input
                                        type="number"
                                        min={1024}
                                        max={65535}
                                        value={typeof draftData.port === 'number' ? draftData.port : Number(draftData.port || 8080)}
                                        onChange={(event) => setDraftData((current) => ({ ...current, port: Number(event.target.value || 8080) }))}
                                    />
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={duplicatePane} disabled={!canDuplicate}>
                            <Copy size={14} className="mr-2" />
                            Duplicate
                        </Button>
                        <Button variant="outline" onClick={openPopout}>
                            <ExternalLink size={14} className="mr-2" />
                            Pop out
                        </Button>
                        <Button variant="destructive" onClick={() => {
                            closePaneWithCleanup(paneId)
                            setPaneId(null)
                        }}>
                            Close pane
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setPaneId(null)}>Cancel</Button>
                        <Button onClick={applyChanges}>Save changes</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
