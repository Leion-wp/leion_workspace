import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Clipboard, X, ArrowRight, PlusSquare } from 'lucide-react'
import { useLayoutStore, getAllPaneIds } from './store'
import { PANE_TYPES } from '../panes'
import { Button } from '@/components/ui/button'

type ContentType = 'text' | 'code' | 'json' | 'url'

function analyzeContent(text: string): ContentType {
    const trimmed = text.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'url'
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { JSON.parse(trimmed); return 'json' } catch { /* not json */ }
    }
    if (
        trimmed.includes('function ') ||
        trimmed.includes('const ') ||
        trimmed.includes('import ') ||
        trimmed.includes('class ') ||
        trimmed.includes('=>') ||
        trimmed.includes('return ') ||
        trimmed.startsWith('#!')
    ) return 'code'
    return 'text'
}

function detectLanguage(text: string): string | null {
    const trimmed = text.trim()
    if (trimmed.startsWith('#!/usr/bin/env python') || trimmed.startsWith('#!/usr/bin/python')) return 'python'
    if (trimmed.startsWith('#!/bin/bash') || trimmed.startsWith('#!/bin/sh') || trimmed.startsWith('#!/usr/bin/env bash')) return 'shell'
    if (/^<(!DOCTYPE|html|div|span|head|body)\b/i.test(trimmed)) return 'html'
    if (/^\s*import\s+.*\s+from\s+['"]/.test(trimmed) || /^\s*export\s+(default\s+)?(function|class|const|interface|type)\b/.test(trimmed)) return 'typescript'
    if (/^\s*def\s+\w+\(/.test(trimmed) || (/^\s*class\s+\w+.*:/.test(trimmed) && !trimmed.includes('{'))) return 'python'
    if (/^\s*func\s+\w+\(/.test(trimmed) || trimmed.includes(':=')) return 'go'
    if (/^\s*fn\s+\w+\(/.test(trimmed) || trimmed.includes('let mut ')) return 'rust'
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i.test(trimmed)) return 'sql'
    if (trimmed.includes('function ') || trimmed.includes('const ') || trimmed.includes('=>')) return 'javascript'
    return null
}

export function SmartClipboard() {
    const [isOpen, setIsOpen] = useState(false)
    const [content, setContent] = useState('')
    const [contentType, setContentType] = useState<ContentType>('text')
    const [language, setLanguage] = useState<string | null>(null)

    const panes = useLayoutStore(s => s.panes)
    const layout = useLayoutStore(s => s.layout)
    const createPaneWithContent = useLayoutStore(s => s.createPaneWithContent)
    const updatePane = useLayoutStore(s => s.updatePane)

    const paneIds = getAllPaneIds(layout)

    // Build target list from existing panes
    const targets = useMemo(() => {
        return paneIds
            .map(id => {
                const pane = panes[id]
                if (!pane) return null
                const type = pane.type
                if (type === 'empty' || type === 'workflow' || type === 'codeserver') return null
                const typeInfo = PANE_TYPES[type]
                return { id, type, label: pane.title || typeInfo?.label || id, icon: typeInfo?.icon || '📦' }
            })
            .filter(Boolean) as { id: string; type: string; label: string; icon: string }[]
    }, [paneIds, panes])

    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const active = document.activeElement as HTMLElement | null
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.isContentEditable) return

            let text = ''
            if (e.clipboardData) {
                text = e.clipboardData.getData('text')
            } else {
                try { text = await navigator.clipboard.readText() } catch { return }
            }
            if (!text.trim()) return
            analyzeAndOpen(text)
        }

        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                const active = document.activeElement as HTMLElement | null
                if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.isContentEditable) return
                try {
                    const text = await navigator.clipboard.readText()
                    if (text.trim()) analyzeAndOpen(text)
                } catch { /* ignore */ }
            }
        }

        const analyzeAndOpen = (text: string) => {
            setContent(text)
            setContentType(analyzeContent(text))
            setLanguage(detectLanguage(text))
            setIsOpen(true)
        }

        window.addEventListener('paste', handlePaste)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('paste', handlePaste)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    const handleSelectPane = (paneId: string) => {
        const pane = panes[paneId]
        if (!pane) return

        switch (pane.type) {
            case 'editor': {
                const currentContent = (pane.data?.content || '') as string
                updatePane(paneId, { data: { ...pane.data, content: currentContent ? currentContent + '\n' + content : content } })
                break
            }
            case 'notes': {
                const currentContent = (pane.data?.content || '') as string
                updatePane(paneId, { data: { ...pane.data, content: currentContent ? currentContent + '\n\n' + content : content } })
                break
            }
            case 'chat': {
                updatePane(paneId, { data: { ...pane.data, inputDraft: content, lastPaste: Date.now() } })
                break
            }
            case 'browser': {
                if (contentType === 'url') {
                    updatePane(paneId, { data: { ...pane.data, url: content } })
                }
                break
            }
            case 'database': {
                updatePane(paneId, { data: { ...pane.data, query: content } })
                break
            }
        }
        setIsOpen(false)
    }

    const handleNewPane = () => {
        createPaneWithContent(content, contentType)
        setIsOpen(false)
    }

    if (!isOpen) return null

    const typeBadge = language ? `${contentType} / ${language}` : contentType

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <div
                className="bg-card border text-card-foreground rounded-lg shadow-xl w-96 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Clipboard className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Smart Paste</h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Preview */}
                <div className="p-3 bg-muted/50 rounded-md max-h-32 overflow-hidden text-xs font-mono text-muted-foreground break-all relative">
                    {content}
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
                    <div className="absolute top-2 right-2 text-[10px] uppercase bg-background border px-1.5 py-0.5 rounded opacity-70">
                        {typeBadge}
                    </div>
                </div>

                {/* Pane targets */}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {targets.length > 0 && (
                        <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1 pb-1">
                            Paste to pane
                        </div>
                    )}
                    {targets.map(target => (
                        <button
                            key={target.id}
                            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors text-left"
                            onClick={() => handleSelectPane(target.id)}
                        >
                            <span>{target.icon}</span>
                            <span className="flex-1 truncate">{target.label}</span>
                            <ArrowRight size={12} className="text-muted-foreground" />
                        </button>
                    ))}
                    <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors text-left border-t border-border/40 mt-1 pt-2"
                        onClick={handleNewPane}
                    >
                        <PlusSquare size={14} className="text-primary" />
                        <span className="flex-1">New Pane</span>
                    </button>
                </div>

                <div className="text-[10px] text-center text-muted-foreground w-full">
                    Press <kbd className="border rounded px-1">Esc</kbd> to cancel
                </div>
            </div>
        </div>,
        document.body
    )
}
