import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Loader2, ChevronDown, AlertTriangle, Check, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatPane } from './ChatPane'
import { usePaneStateStore } from './paneStateStore'
import { cn } from '../lib/utils'

export type AgentBrain = 'claude' | 'gemini' | 'codex'

export interface AgentMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
    isStreaming?: boolean
    brain?: AgentBrain
}

export interface ToolApproval {
    id: string
    tool: string
    input: unknown
}

const BRAIN_OPTIONS: Record<AgentBrain, { label: string; icon: string; description: string }> = {
    claude: { label: 'Claude', icon: '🧠', description: 'Webview (Pro plan)' },
    gemini: { label: 'Gemini', icon: '🔮', description: 'SDK (API key)' },
    codex: { label: 'Codex', icon: '🤖', description: 'App Server (CLI)' },
}

interface AgentPaneProps {
    id: string
    data?: Record<string, unknown>
    onUpdate?: (data: Record<string, unknown>) => void
}

export function AgentPane({ id, data, onUpdate }: AgentPaneProps) {
    const [brain, setBrain] = useState<AgentBrain>((data?.brain as AgentBrain) || 'claude')
    const [messages, setMessages] = useState<AgentMessage[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showBrainPicker, setShowBrainPicker] = useState(false)
    const [pendingApprovals, setPendingApprovals] = useState<ToolApproval[]>([])
    const [codexSessionId, setCodexSessionId] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Publish ambient state
    useEffect(() => {
        usePaneStateStore.getState().setPaneState(id, {
            type: 'agent',
            brain,
            lastResponse: messages.filter(m => m.role === 'assistant').pop()?.content || '',
            isThinking: isLoading,
            messageCount: messages.length,
        })
        return () => usePaneStateStore.getState().removePaneState(id)
    }, [id, brain, isLoading, messages])

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Save brain selection
    useEffect(() => {
        onUpdate?.({ brain })
    }, [brain])

    // Subscribe to codex events
    useEffect(() => {
        if (brain !== 'codex' || !window.platform?.codex) return

        const cleanup = window.platform.codex.onEvent((event: any) => {
            if (event.event === 'message' || event.method === 'message') {
                const text = event.text || event.params?.text || ''
                setMessages(prev => {
                    const last = prev[prev.length - 1]
                    if (last?.isStreaming && last.role === 'assistant') {
                        return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + text } : m)
                    }
                    return [...prev, { id: `msg-${Date.now()}`, role: 'assistant', content: text, timestamp: Date.now(), isStreaming: true, brain: 'codex' }]
                })
            }
            if (event.event === 'tool-call' || event.method === 'tool-call') {
                setPendingApprovals(prev => [...prev, {
                    id: event.toolCallId || event.params?.toolCallId || `tool-${Date.now()}`,
                    tool: event.toolName || event.params?.toolName || 'unknown',
                    input: event.input || event.params?.input,
                }])
            }
            if (event.event === 'tool-result' || event.method === 'tool-result') {
                const toolId = event.toolCallId || event.params?.toolCallId
                setPendingApprovals(prev => prev.filter(a => a.id !== toolId))
            }
            if (event.event === 'turn-complete' || event.method === 'turn-complete') {
                setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m))
                setIsLoading(false)
            }
        })

        return cleanup
    }, [brain])

    const handleSend = useCallback(async () => {
        const text = input.trim()
        if (!text || isLoading) return

        const userMsg: AgentMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        if (brain === 'gemini') {
            await sendGemini(text, [...messages, userMsg])
        } else if (brain === 'codex') {
            await sendCodex(text)
        }
    }, [input, isLoading, brain, messages])

    const sendGemini = async (_text: string, allMessages: AgentMessage[]) => {
        if (!window.platform?.gemini) {
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`, role: 'system', content: 'Gemini SDK not available. Make sure GEMINI_API_KEY is set in .env.',
                timestamp: Date.now()
            }])
            setIsLoading(false)
            return
        }

        const assistantMsg: AgentMessage = {
            id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, brain: 'gemini'
        }
        setMessages(prev => [...prev, assistantMsg])

        try {
            const history = allMessages.filter(m => m.role !== 'system').map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                content: m.content,
            }))

            const { streamId } = await window.platform.gemini.stream({
                messages: history,
                model: 'gemini-2.0-flash',
            })

            const cleanup = window.platform.gemini.onChunk(streamId, (chunk: { text: string; done: boolean; error?: string }) => {
                if (chunk.error) {
                    setMessages(prev => prev.map(m => m.id === assistantMsg.id
                        ? { ...m, content: m.content + `\n\nError: ${chunk.error}`, isStreaming: false }
                        : m
                    ))
                    setIsLoading(false)
                    cleanup()
                    return
                }
                if (chunk.done) {
                    setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m))
                    setIsLoading(false)
                    cleanup()
                } else {
                    setMessages(prev => prev.map(m => m.id === assistantMsg.id
                        ? { ...m, content: m.content + chunk.text }
                        : m
                    ))
                }
            })
        } catch (err: any) {
            setMessages(prev => prev.map(m => m.id === assistantMsg.id
                ? { ...m, content: `Error: ${err.message || err}`, isStreaming: false }
                : m
            ))
            setIsLoading(false)
        }
    }

    const sendCodex = async (text: string) => {
        if (!window.platform?.codex) {
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`, role: 'system',
                content: 'Codex app-server not available. Make sure @openai/codex is installed globally.',
                timestamp: Date.now()
            }])
            setIsLoading(false)
            return
        }

        try {
            // Initialize session if needed
            let sessionId = codexSessionId
            if (!sessionId) {
                const result = await window.platform.codex.initialize({
                    clientInfo: { name: 'Leion', version: '1.0' },
                })
                sessionId = result.sessionId
                setCodexSessionId(sessionId)
            }

            // Create turn
            await window.platform.codex.turn({ sessionId, message: text })
            // Response comes via codex events subscribed in useEffect
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`, role: 'system',
                content: `Codex error: ${err.message || err}`,
                timestamp: Date.now()
            }])
            setIsLoading(false)
        }
    }

    const handleApprove = async (toolCallId: string, decision: 'allow' | 'deny' | 'allow-always') => {
        if (!window.platform?.codex || !codexSessionId) return
        await window.platform.codex.approve(codexSessionId, toolCallId, decision)
        setPendingApprovals(prev => prev.filter(a => a.id !== toolCallId))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSend()
        }
    }

    // For Claude brain, delegate to the existing ChatPane webview
    if (brain === 'claude') {
        return (
            <div className="flex flex-col h-full">
                {/* Brain selector header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card/50 border-b border-border/40 shrink-0">
                    <BrainSelector brain={brain} setBrain={setBrain} showPicker={showBrainPicker} setShowPicker={setShowBrainPicker} />
                </div>
                <div className="flex-1">
                    <ChatPane id={id} data={{ provider: 'claude' as const }} onUpdate={onUpdate as any} />
                </div>
            </div>
        )
    }

    // Custom chat UI for Gemini and Codex
    return (
        <div className="flex flex-col h-full bg-background">
            {/* Brain selector header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card/50 border-b border-border/40 shrink-0">
                <BrainSelector brain={brain} setBrain={setBrain} showPicker={showBrainPicker} setShowPicker={setShowBrainPicker} />
                <span className="text-[10px] text-muted-foreground">{BRAIN_OPTIONS[brain].description}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <Bot size={32} className="opacity-30" />
                        <span className="text-sm">Start a conversation with {BRAIN_OPTIONS[brain].label}</span>
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : '')}>
                        {msg.role !== 'user' && (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                {msg.role === 'system' ? <AlertTriangle size={14} className="text-amber-500" /> : <Bot size={14} className="text-primary" />}
                            </div>
                        )}
                        <div className={cn(
                            'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                            msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : msg.role === 'system'
                                    ? 'bg-amber-500/10 text-amber-200 border border-amber-500/20'
                                    : 'bg-card border border-border/40'
                        )}>
                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                            {msg.isStreaming && (
                                <Loader2 size={12} className="animate-spin mt-1 text-muted-foreground" />
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                                <User size={14} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Tool approval cards */}
                {pendingApprovals.map(approval => (
                    <div key={approval.id} className="border border-amber-500/30 rounded-lg p-3 bg-amber-900/10 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                            <AlertTriangle size={14} />
                            Tool: {approval.tool}
                        </div>
                        <pre className="text-[10px] font-mono overflow-auto max-h-24 bg-background/50 rounded p-2 text-muted-foreground">
                            {JSON.stringify(approval.input, null, 2)}
                        </pre>
                        <div className="flex gap-2">
                            <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => handleApprove(approval.id, 'deny')}>
                                <XCircle size={10} className="mr-1" /> Deny
                            </Button>
                            <Button size="sm" className="h-6 text-[10px]" onClick={() => handleApprove(approval.id, 'allow')}>
                                <Check size={10} className="mr-1" /> Allow
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleApprove(approval.id, 'allow-always')}>
                                Always
                            </Button>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/40 p-3 bg-card/30">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={textareaRef}
                        className="flex-1 bg-background border border-border/40 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-primary/50 transition-colors min-h-[40px] max-h-[120px]"
                        placeholder={`Message ${BRAIN_OPTIONS[brain].label}...`}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </Button>
                </div>
                <div className="text-[10px] text-muted-foreground/40 mt-1 text-right">
                    Ctrl+Enter to send
                </div>
            </div>
        </div>
    )
}

// Brain selector dropdown
function BrainSelector({ brain, setBrain, showPicker, setShowPicker }: {
    brain: AgentBrain
    setBrain: (b: AgentBrain) => void
    showPicker: boolean
    setShowPicker: (v: boolean) => void
}) {
    const info = BRAIN_OPTIONS[brain]
    return (
        <div className="relative">
            <button
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium hover:bg-accent/50 transition-colors"
                onClick={() => setShowPicker(!showPicker)}
            >
                <span>{info.icon}</span>
                <span>{info.label}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showPicker && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border/60 rounded-lg shadow-xl z-50 py-1 min-w-40">
                    {(Object.entries(BRAIN_OPTIONS) as [AgentBrain, typeof info][]).map(([key, opt]) => (
                        <button
                            key={key}
                            className={cn(
                                'flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors',
                                key === brain && 'bg-accent/30'
                            )}
                            onClick={() => { setBrain(key); setShowPicker(false) }}
                        >
                            <span>{opt.icon}</span>
                            <div className="flex-1 text-left">
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
