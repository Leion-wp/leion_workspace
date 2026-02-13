import { useEffect, useRef, useState, createContext, useContext, ReactNode } from 'react'
import './ContextMenu.css'

export interface MenuItem {
    label: string
    icon?: string
    action: () => void
    separator?: boolean
    disabled?: boolean
}

interface ContextMenuState {
    x: number
    y: number
    items: MenuItem[]
    visible: boolean
}

interface ContextMenuContextType {
    show: (x: number, y: number, items: MenuItem[]) => void
    hide: () => void
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null)

export function useContextMenu() {
    const context = useContext(ContextMenuContext)
    if (!context) throw new Error('useContextMenu must be used within ContextMenuProvider')
    return context
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ContextMenuState>({
        x: 0,
        y: 0,
        items: [],
        visible: false,
    })
    const menuRef = useRef<HTMLDivElement>(null)

    const show = (x: number, y: number, items: MenuItem[]) => {
        setState({ x, y, items: withClipboardItems(items), visible: true })
    }

    const hide = () => {
        setState((prev) => ({ ...prev, visible: false }))
    }

    // Close on click outside or escape
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                hide()
            }
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') hide()
        }

        if (state.visible) {
            document.addEventListener('mousedown', handleClick)
            document.addEventListener('keydown', handleEscape)
        }
        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [state.visible])

    // Adjust position to stay in viewport
    useEffect(() => {
        if (state.visible && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect()
            const { innerWidth, innerHeight } = window
            let { x, y } = state

            if (x + rect.width > innerWidth) x = innerWidth - rect.width - 8
            if (y + rect.height > innerHeight) y = innerHeight - rect.height - 8

            if (x !== state.x || y !== state.y) {
                setState((prev) => ({ ...prev, x, y }))
            }
        }
    }, [state.visible, state.x, state.y])

    return (
        <ContextMenuContext.Provider value={{ show, hide }}>
            {children}
            {state.visible && (
                <div
                    ref={menuRef}
                    className="context-menu"
                    style={{ left: state.x, top: state.y }}
                >
                    {state.items.map((item, i) =>
                        item.separator ? (
                            <div key={i} className="context-menu-separator" />
                        ) : (
                            <button
                                key={i}
                                className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
                                onClick={() => {
                                    if (!item.disabled) {
                                        item.action()
                                        hide()
                                    }
                                }}
                                disabled={item.disabled}
                            >
                                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                                <span>{item.label}</span>
                            </button>
                        )
                    )}
                </div>
            )}
        </ContextMenuContext.Provider>
    )
}

function withClipboardItems(items: MenuItem[]): MenuItem[] {
    const existingLabels = new Set(items.map(i => i.label.toLowerCase().trim()))
    const clipboardItems: MenuItem[] = []
    const target = document.activeElement as HTMLElement | null
    const selectedText = getCurrentSelectionText(target)
    const canCopy = selectedText.length > 0
    const canCut = canCopy && isEditableTarget(target)

    if (!existingLabels.has('copy')) {
        clipboardItems.push({
            label: 'Copy',
            icon: '📋',
            disabled: !canCopy,
            action: async () => {
                if (!canCopy) return
                try {
                    await navigator.clipboard.writeText(selectedText)
                } catch {
                    document.execCommand('copy')
                }
            },
        })
    }

    if (!existingLabels.has('cut')) {
        clipboardItems.push({
            label: 'Cut',
            icon: '✂️',
            disabled: !canCut,
            action: async () => {
                if (!canCut || !target) return
                const text = getCurrentSelectionText(target)
                if (!text) return
                try {
                    await navigator.clipboard.writeText(text)
                    deleteCurrentSelection(target)
                } catch {
                    document.execCommand('cut')
                }
            },
        })
    }

    if (!existingLabels.has('paste')) {
        clipboardItems.push({
            label: 'Paste',
            icon: '📥',
            action: async () => {
                if (!target || !isEditableTarget(target)) return
                try {
                    const text = await navigator.clipboard.readText()
                    insertTextAtCursor(target, text)
                } catch {
                    document.execCommand('paste')
                }
            },
        })
    }

    if (!existingLabels.has('select all')) {
        clipboardItems.push({
            label: 'Select All',
            icon: '🔠',
            action: () => {
                if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                    target.select()
                    return
                }
                document.execCommand('selectAll')
            },
        })
    }

    if (clipboardItems.length === 0) return items
    if (items.length === 0) return clipboardItems
    return [...items, { label: '', separator: true, action: () => { } }, ...clipboardItems]
}

function isEditableTarget(target: HTMLElement | null): boolean {
    if (!target) return false
    if (target instanceof HTMLInputElement) return !target.readOnly && !target.disabled
    if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled
    return target.isContentEditable
}

function getCurrentSelectionText(target: HTMLElement | null): string {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0
        const end = target.selectionEnd ?? 0
        return target.value.slice(start, end)
    }
    const selection = window.getSelection()
    return selection?.toString() ?? ''
}

function deleteCurrentSelection(target: HTMLElement): void {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0
        const end = target.selectionEnd ?? 0
        target.setRangeText('', start, end, 'start')
        target.dispatchEvent(new Event('input', { bubbles: true }))
        return
    }
    if (target.isContentEditable) {
        document.execCommand('delete')
    }
}

function insertTextAtCursor(target: HTMLElement, text: string): void {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? target.value.length
        const end = target.selectionEnd ?? start
        target.setRangeText(text, start, end, 'end')
        target.dispatchEvent(new Event('input', { bubbles: true }))
        return
    }
    if (target.isContentEditable) {
        document.execCommand('insertText', false, text)
    }
}
