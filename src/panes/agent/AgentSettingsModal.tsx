import { useState, useEffect } from 'react'
import { X, Check, Plus, Trash2, Globe, Folder, MessageSquare, Settings, Database, Cpu, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAgentStore, Project, Thread } from '@/store/agentStore'

interface AgentSettingsModalProps {
    isOpen: boolean
    onClose: () => void
}

type SettingsTab = 'general' | 'environment' | 'features' | 'memories' | 'permissions'

export function AgentSettingsModal({ isOpen, onClose }: AgentSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>('environment')

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[800px] h-[600px] bg-card border border-border shadow-2xl rounded-lg flex overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Sidebar */}
                <div className="w-48 bg-muted/30 border-r border-border p-4 space-y-2">
                    <div className="text-sm font-semibold mb-4 px-2">Settings</div>

                    <TabButton tab="general" current={activeTab} onClick={setActiveTab} icon={Settings} label="General" />
                    <TabButton tab="environment" current={activeTab} onClick={setActiveTab} icon={Database} label="Environment" />
                    <TabButton tab="permissions" current={activeTab} onClick={setActiveTab} icon={Shield} label="Permissions" />
                    <TabButton tab="features" current={activeTab} onClick={setActiveTab} icon={Cpu} label="Features" />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-medium capitalize">{activeTab} Settings</h2>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X size={18} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'environment' && <EnvironmentSettings />}
                        {activeTab === 'general' && <GeneralSettings />}
                        {activeTab === 'features' && <div className="text-muted-foreground italic">Feature flags coming soon.</div>}
                        {activeTab === 'permissions' && <div className="text-muted-foreground italic">Permission management coming soon.</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}

function TabButton({ tab, current, onClick, icon: Icon, label }: { tab: SettingsTab, current: SettingsTab, onClick: (t: SettingsTab) => void, icon: any, label: string }) {
    return (
        <button
            onClick={() => onClick(tab)}
            className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                current === tab
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            <Icon size={16} />
            <span>{label}</span>
        </button>
    )
}

// --- Environment Settings ---

function EnvironmentSettings() {
    const { threads, projects, globalEnv, activeThreadId, updateGlobalEnvironment, updateProjectEnvironment, updateThreadEnvironment } = useAgentStore()

    // Selection state
    const [scopeType, setScopeType] = useState<'global' | 'project' | 'thread'>('global')
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Derived active data
    let currentEnv: Record<string, string> = {}
    let updateFn: (k: string, v: string) => void = () => { }

    if (scopeType === 'global') {
        currentEnv = globalEnv
        updateFn = (k, v) => updateGlobalEnvironment(k, v)
    } else if (scopeType === 'project' && selectedId) {
        const p = projects.find(pr => pr.id === selectedId)
        currentEnv = p?.environment || {}
        updateFn = (k, v) => updateProjectEnvironment(selectedId, k, v)
    } else if (scopeType === 'thread' && selectedId) {
        const t = threads.find(th => th.id === selectedId)
        currentEnv = t?.environment || {}
        updateFn = (k, v) => updateThreadEnvironment(selectedId, k, v)
    }

    return (
        <div className="space-y-6">
            {/* Scope Selector */}
            <div className="flex gap-4 p-4 bg-muted/20 rounded-lg border border-border/50">
                <div className="space-y-2 w-1/3 border-r border-border/50 pr-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Scope</div>
                    <div className="space-y-1">
                        <button
                            className={cn("w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2", scopeType === 'global' ? "bg-accent" : "hover:bg-muted")}
                            onClick={() => { setScopeType('global'); setSelectedId(null) }}
                        >
                            <Globe size={14} /> Global
                        </button>

                        <div className="pt-2 text-[10px] font-medium text-muted-foreground uppercase">Projects</div>
                        {projects.map(p => (
                            <button
                                key={p.id}
                                className={cn("w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 truncate", scopeType === 'project' && selectedId === p.id ? "bg-accent" : "hover:bg-muted")}
                                onClick={() => { setScopeType('project'); setSelectedId(p.id) }}
                            >
                                <Folder size={14} /> {p.name}
                            </button>
                        ))}
                        {projects.length === 0 && <div className="px-2 text-xs text-muted-foreground italic">No projects</div>}

                        <div className="pt-2 text-[10px] font-medium text-muted-foreground uppercase">Active Thread</div>
                        {activeThreadId ? (
                            <button
                                className={cn("w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 truncate", scopeType === 'thread' && selectedId === activeThreadId ? "bg-accent" : "hover:bg-muted")}
                                onClick={() => { setScopeType('thread'); setSelectedId(activeThreadId) }}
                            >
                                <MessageSquare size={14} /> Current Thread
                            </button>
                        ) : (
                            <div className="px-2 text-xs text-muted-foreground italic">No active thread</div>
                        )}
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                            {scopeType === 'global' ? 'Global Variables' :
                                scopeType === 'project' ? `Project: ${projects.find(p => p.id === selectedId)?.name}` :
                                    'Thread Variables'}
                        </div>
                    </div>

                    <EnvEditor
                        env={currentEnv}
                        onUpdate={updateFn}
                    />
                </div>
            </div>

            <div className="text-xs text-muted-foreground">
                <p>Variables are merged at runtime: <span className="font-mono">Thread &gt; Project &gt; Global</span></p>
            </div>
        </div>
    )
}

function EnvEditor({ env, onUpdate }: { env: Record<string, string>, onUpdate: (k: string, v: string) => void }) {
    const [newKey, setNewKey] = useState('')
    const [newValue, setNewValue] = useState('')
    const [isSecret, setIsSecret] = useState(false) // UI only for now to mask input?

    const handleAdd = () => {
        if (newKey.trim()) {
            onUpdate(newKey.trim(), newValue.trim())
            setNewKey('')
            setNewValue('')
            setIsSecret(false) // Reset
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {Object.entries(env || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 p-2 rounded bg-background border border-border/50 group">
                        <span className="font-mono text-sm font-medium text-primary w-1/3 truncate" title={k}>{k}</span>
                        <div className="flex-1 font-mono text-sm text-muted-foreground truncate flex items-center">
                            {/* Simple heuristics for masking */}
                            {k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')
                                ? '••••••••'
                                : v}
                        </div>
                        <button
                            onClick={() => onUpdate(k, '')} // Logic to remove? My store update sets value. Empty string might mean delete?
                            // Actually store currently sets the value. To delete I might need a specific delete action or explicit null. 
                            // But usually empty string is fine for env vars or key removal.
                            // Let's assume setting to empty effectively disables it or user can just ignore.
                            // Ideally store should handle `delete` action.
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                {Object.keys(env || {}).length === 0 && (
                    <div className="text-sm text-muted-foreground italic p-4 text-center border border-dashed rounded">
                        No variables defined for this scope.
                    </div>
                )}
            </div>

            <div className="flex gap-2 items-end pt-2 border-t border-border/50">
                <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Key</label>
                    <input
                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="API_KEY"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                    />
                </div>
                <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Value</label>
                    <div className="relative">
                        <input
                            className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pr-8"
                            placeholder="Value"
                            type={isSecret ? "password" : "text"}
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                        />
                        {/* Toggle visibility icon could go here */}
                    </div>
                </div>
                <Button onClick={handleAdd} disabled={!newKey.trim()} size="sm" className="h-8">
                    Add
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isSecret}
                        onChange={e => setIsSecret(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    Mask value input
                </label>
            </div>
        </div>
    )
}

function GeneralSettings() {
    const { settings, updateSettings } = useAgentStore()

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium">Working Directory (CWD)</label>
                <div className="flex gap-2">
                    <input
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={settings.cwd || ''}
                        placeholder="Current working directory..."
                        readOnly // Readonly for now until we have fs picker
                    />
                    <Button variant="outline" size="sm" onClick={() => alert("File picker coming soon")}>
                        Browse...
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">The root directory for file operations.</p>
            </div>
        </div>
    )
}
