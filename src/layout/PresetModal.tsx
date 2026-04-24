import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Trash2, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLayoutStore } from './store'
import { BUILT_IN_PRESETS, type LayoutPreset } from './presets'

interface PresetModalProps {
    isOpen: boolean
    onClose: () => void
}

export function PresetModal({ isOpen, onClose }: PresetModalProps) {
    const [saveName, setSaveName] = useState('')
    const [showSaveForm, setShowSaveForm] = useState(false)

    const savedPresets = useLayoutStore(s => s.savedPresets)
    const saveCurrentAsPreset = useLayoutStore(s => s.saveCurrentAsPreset)
    const loadPreset = useLayoutStore(s => s.loadPreset)
    const deletePreset = useLayoutStore(s => s.deletePreset)

    const handleSave = () => {
        if (!saveName.trim()) return
        saveCurrentAsPreset(saveName.trim())
        setSaveName('')
        setShowSaveForm(false)
    }

    const handleLoad = (preset: LayoutPreset) => {
        loadPreset(preset)
        onClose()
    }

    const renderPresetMeta = (preset: LayoutPreset) => {
        const paneCount = Object.keys(preset.paneTypes).length
        const labels = Object.values(preset.paneSnapshots || {})
            .map((snapshot) => snapshot.title || snapshot.type)
            .slice(0, 3)

        return `${paneCount} panes${labels.length ? ` • ${labels.join(' • ')}` : ''}`
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border text-card-foreground rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                        <LayoutTemplate size={18} className="text-primary" />
                        <h3 className="font-semibold">Layout Presets</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {!showSaveForm && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSaveForm(true)}>
                                <Save size={12} className="mr-1" /> Save Current
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {/* Save form */}
                {showSaveForm && (
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
                        <Input
                            className="h-7 text-xs flex-1"
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSave()
                                if (e.key === 'Escape') setShowSaveForm(false)
                            }}
                            placeholder="Preset name..."
                            autoFocus
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!saveName.trim()}>
                            Save
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowSaveForm(false)}>
                            Cancel
                        </Button>
                    </div>
                )}

                {/* Presets list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Built-in */}
                    <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 px-1">Built-in</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {BUILT_IN_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-accent/50 transition-colors text-left group"
                                    onClick={() => handleLoad(preset)}
                                >
                                    <span className="text-xl mt-0.5">{preset.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{preset.name}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</div>
                                        <div className="text-[10px] text-muted-foreground/70 mt-1">{renderPresetMeta(preset)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom */}
                    {savedPresets.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 px-1">Custom</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {savedPresets.map(preset => (
                                    <div
                                        key={preset.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-accent/50 transition-colors group relative"
                                    >
                                        <button className="flex items-start gap-3 flex-1 text-left" onClick={() => handleLoad(preset)}>
                                            <span className="text-xl mt-0.5">{preset.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{preset.name}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</div>
                                                <div className="text-[10px] text-muted-foreground/70 mt-1">{renderPresetMeta(preset)}</div>
                                            </div>
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={e => { e.stopPropagation(); deletePreset(preset.id) }}
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {savedPresets.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground/50 py-4">
                            No custom presets yet. Save your current layout to create one.
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
