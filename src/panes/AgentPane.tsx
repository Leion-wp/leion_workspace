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

type CodexEvent = {
    event?: string
    method?: string
    text?: string
    params?: Record<string, any>
    [key: string]: any
}

const BRAIN_OPTIONS: Record<AgentBrain, { label: string; icon: string; description: string }> = {
    claude: { label: 'Claude', icon: '🧠', description: 'Webview (Pro plan)' },
    gemini: { label: 'Gemini', icon: '🔮', description: 'SDK (API key)' },
    codex: { label: 'Codex', icon: '🤖', description: 'App Server (CLI)' },
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
const MAX_PERSISTED_MESSAGES = 120

function coerceBrain(value: unknown): AgentBrain {
    if (value === 'claude' || value === 'gemini' || value === 'codex') return value
    return 'claude'
}

function sanitizeMessages(value: unknown): AgentMessage[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((m) => m && typeof m === 'object')
        .map((m: any, index) => ({
            id: typeof m.id === 'string' ? m.id : `msg-restored-${Date.now()}-${index}`,
            role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
            content: typeof m.content === 'string' ? m.content : '',
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            isStreaming: Boolean(m.isStreaming),
            brain: m.brain === 'claude' || m.brain === 'gemini' || m.brain === 'codex' ? m.brain : undefined,
        }))
        .slice(-MAX_PERSISTED_MESSAGES)
}

function getCodexMethod(event: CodexEvent): string {
    return String(event?.event || event?.method || '').toLowerCase()
}

function getCodexSessionId(event: CodexEvent): string | null {
    const candidates = [
        event?.sessionId,
        event?.session_id,
        event?.params?.sessionId,
        event?.params?.session_id,
        event?.params?.session?.id,
        event?.params?.turn?.sessionId,
        event?.params?.turn?.session_id,
        event?.result?.sessionId,
        event?.result?.session_id,
    ]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
    return null
}

function getCodexText(event: CodexEvent): string {
    const candidates = [
        event?.text,
        event?.params?.text,
        event?.params?.delta,
        event?.params?.output_text,
        event?.params?.message?.text,
        event?.params?.content,
        event?.params?.chunk?.text,
        event?.params?.output?.text,
    ]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.length > 0) return candidate
    }
    return ''
}

function getToolApprovalFromEvent(event: CodexEvent): ToolApproval | null {
    const toolCallId = event?.toolCallId
        || event?.tool_call_id
        || event?.params?.toolCallId
        || event?.params?.tool_call_id
        || event?.params?.id
    if (!toolCallId || typeof toolCallId !== 'string') return null

    const toolName = event?.toolName
        || event?.tool_name
        || event?.params?.toolName
        || event?.params?.tool_name
        || event?.params?.name
        || 'unknown'

    const input = event?.input
        ?? event?.params?.input
        ?? event?.params?.arguments
        ?? event?.params?.args

    return { id: toolCallId, tool: String(toolName), input }
}

interface AgentPaneProps {
    id: string
    data?: Record<string, unknown>
    onUpdate?: (data: Record<string, unknown>) => void
}

export function AgentPane({ id, data, onUpdate }: AgentPaneProps) {
    const [brain, setBrain] = useState<AgentBrain>(() => coerceBrain(data?.brain))
    const [messages, setMessages] = useState<AgentMessage[]>(() => sanitizeMessages(data?.messages))
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showBrainPicker, setShowBrainPicker] = useState(false)
    const [pendingApprovals, setPendingApprovals] = useState<ToolApproval[]>([])
    const [codexSessionId, setCodexSessionId] = useState<string | null>(
        typeof data?.codexSessionId === 'string' ? data.codexSessionId : null
    )
    const [geminiModel, setGeminiModel] = useState<string>(
        typeof data?.geminiModel === 'string' && data.geminiModel.trim()
            ? data.geminiModel
            : DEFAULT_GEMINI_MODEL
    )
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const codexSessionIdRef = useRef<string | null>(codexSessionId)
    const codexAssistantMessageIdRef = useRef<string | null>(null)

    useEffect(() => {
        codexSessionIdRef.current = codexSessionId
    }, [codexSessionId])

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

    // Persist pane data (debounced to avoid excessive storage writes during streams)
    useEffect(() => {
        const timeout = window.setTimeout(() => {
            onUpdate?.({
                brain,
                geminiModel,
                codexSessionId,
                messages: messages.slice(-MAX_PERSISTED_MESSAGES),
            })
        }, 180)

        return () => window.clearTimeout(timeout)
    }, [brain, geminiModel, codexSessionId, messages, onUpdate])

    // Reset transient state when brain changes
    useEffect(() => {
        setIsLoading(false)
        if (brain !== 'codex') {
            setPendingApprovals([])
            codexAssistantMessageIdRef.current = null
        }
    }, [brain])

    const appendCodexText = useCallback((text: string) => {
        if (!text) return
        setMessages((prev) => {
            const targetId = codexAssistantMessageIdRef.current
            if (targetId) {
                const idx = prev.findIndex((m) => m.id === targetId)
                if (idx >= 0) {
                    return prev.map((m, i) => i === idx ? { ...m, content: m.content + text } : m)
                }
            }

            const last = prev[prev.length - 1]
            if (last?.isStreaming && last.role === 'assistant') {
                codexAssistantMessageIdRef.current = last.id
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + text } : m)
            }

            const nextId = `msg-${Date.now()}`
            codexAssistantMessageIdRef.current = nextId
            return [...prev, {
                id: nextId,
                role: 'assistant',
                content: text,
                timestamp: Date.now(),
                isStreaming: true,
                brain: 'codex',
            }]
        })
    }, [])

    // Subscribe to codex events
    useEffect(() => {
        if (brain !== 'codex' || !window.platform?.codex) return

        const cleanupEvent = window.platform.codex.onEvent((rawEvent: CodexEvent) => {
            const event = rawEvent || {}
            const method = getCodexMethod(event)
            const eventSessionId = getCodexSessionId(event)
            const currentSessionId = codexSessionIdRef.current
            if (currentSessionId && eventSessionId && eventSessionId !== currentSessionId) {
                return
            }

            const text = getCodexText(event)
            if (text && (method.includes('message') || method.includes('delta') || method.includes('output_text') || method.includes('text'))) {
                appendCodexText(text)
            }

            if (method.includes('tool') && (method.includes('call') || method.includes('request'))) {
                const approval = getToolApprovalFromEvent(event)
                if (approval) {
                    setPendingApprovals((prev) => prev.some((a) => a.id === approval.id) ? prev : [...prev, approval])
                }
            }

            if (method.includes('tool') && (method.includes('result') || method.includes('approved') || method.includes('denied'))) {
                const toolId = event.toolCallId || event.tool_call_id || event.params?.toolCallId || event.params?.tool_call_id
                if (typeof toolId === 'string' && toolId) {
                    setPendingApprovals((prev) => prev.filter((a) => a.id !== toolId))
                }
            }

            if (
                method === 'turn-complete'
                || method.includes('turn.complete')
                || method.includes('turn.completed')
                || method.includes('response.completed')
                || method.includes('turn.done')
            ) {
                setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m))
                codexAssistantMessageIdRef.current = null
                setPendingApprovals([])
                setIsLoading(false)
            }

            if (method.includes('error')) {
                const errorText = event?.error?.message || event?.params?.error?.message || 'Unknown Codex error'
                setMessages((prev) => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'system',
                    content: `Codex error: ${errorText}`,
                    timestamp: Date.now(),
                }])
                setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m))
                codexAssistantMessageIdRef.current = null
                setIsLoading(false)
            }
        })

        const cleanupExit = window.platform.codex.onExit((code) => {
            setMessages((prev) => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Codex app-server exited (code ${code}).`,
                timestamp: Date.now(),
            }])
            setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m))
            codexAssistantMessageIdRef.current = null
            setPendingApprovals([])
            setIsLoading(false)
        })

        return () => {
            cleanupEvent()
            cleanupExit()
        }
    }, [brain, appendCodexText])

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
    }, [input, isLoading, brain, messages, geminiModel, codexSessionId])

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
                model: geminiModel || DEFAULT_GEMINI_MODEL,
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
            const assistantId = `msg-${Date.now()}`
            codexAssistantMessageIdRef.current = assistantId
            setMessages((prev) => [...prev, {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                isStreaming: true,
                brain: 'codex',
            }])

            // Initialize session if needed
            let sessionId = codexSessionId
            if (!sessionId) {
                const result = await window.platform.codex.initialize({
                    clientInfo: { name: 'Leion', version: '1.0' },
                })
                sessionId = result.sessionId
                setCodexSessionId(sessionId)
                codexSessionIdRef.current = sessionId
            }

            // Create turn
            await window.platform.codex.turn({ sessionId, message: text })
            // Response comes via codex events subscribed in useEffect
        } catch (err: any) {
            setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m))
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Codex error: ${err.message || err}`,
                timestamp: Date.now(),
            }])
            codexAssistantMessageIdRef.current = null
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
                {brain === 'gemini' && (
                    <input
                        className="ml-auto h-6 w-44 rounded border border-border/50 bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary/50"
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        placeholder="Gemini model"
                        title="Gemini model"
                    />
                )}
                {brain === 'codex' && codexSessionId && (
                    <span className="ml-auto text-[10px] text-muted-foreground/80" title={codexSessionId}>
                        Session: {codexSessionId.slice(0, 12)}...
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                        setMessages([])
                        setPendingApprovals([])
                        setIsLoading(false)
                        codexAssistantMessageIdRef.current = null
                    }}
                    title="Clear conversation"
                >
                    Clear
                </Button>
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
