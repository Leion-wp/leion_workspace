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
        setState({ x, y, items, visible: true })
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
