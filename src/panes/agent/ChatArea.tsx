import { useEffect, useRef, useState } from 'react'
import { Send, Bot, User, Sparkles, TerminalSquare, AlertCircle, Trash2, Paperclip, Brain, Square, Slash, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgentStore, AgentMessage } from '@/store/agentStore'

interface ChatAreaProps {
    className?: string
}

export function ChatArea({ className }: ChatAreaProps) {
    const {
        activeThreadId,
        threads,
        input,
        setInput,
        sendMessage,
        clearChat,
        stop,
        mode,
        setMode,
        memoryEnabled,
        toggleMemory,
        updateThreadModel,
        fetchModels,
        availableModels
    } = useAgentStore()

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showSlashCommands, setShowSlashCommands] = useState(false)

    const activeThread = threads.find(t => t.id === activeThreadId)
    const messages = activeThread?.messages || []
    const isThinking = activeThread?.isThinking || false
    const currentModel = activeThread?.model || 'gemini-2.0-flash'

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length, messages[messages.length - 1]?.content])

    useEffect(() => {
        fetchModels()
    }, [fetchModels])

    // Slash Command Logic
    useEffect(() => {
        if (input === '/') {
            setShowSlashCommands(true)
        } else if (showSlashCommands && !input.startsWith('/')) {
            setShowSlashCommands(false)
        }
    }, [input, showSlashCommands])

    const handleSlashCommand = (cmd: string) => {
        if (cmd === '/clear') {
            clearChat()
        } else if (cmd === '/reset') {
            clearChat() // For now same as clear
        }
        setInput('')
        setShowSlashCommands(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
        if (e.key === 'Escape') {
            setShowSlashCommands(false)
        }
    }

    if (!activeThreadId) {
        return (
            <div className={cn("flex items-center justify-center text-muted-foreground", className)}>
                Select a thread to start
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col h-full bg-background", className)}>
            {/* Header / Mode Switcher */}
            <div className="flex items-center justify-between p-3 border-b border-border/40 bg-card/10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
                        <button
                            onClick={() => setMode('agent')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                mode === 'agent'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            <TerminalSquare size={14} />
                            Agent
                        </button>
                        <button
                            onClick={() => setMode('ask')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                mode === 'ask'
                                    ? "bg-purple-600 text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            <Sparkles size={14} />
                            Ask
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Model Selector - Only visible in 'ask' mode */}
                    {mode === 'ask' && (
                        <div className="relative group">
                            <select
                                className="appearance-none bg-transparent hover:bg-muted/50 rounded px-2 py-1 pr-6 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none border border-transparent hover:border-border/30 transition-all max-w-[150px] truncate"
                                value={currentModel}
                                onChange={(e) => updateThreadModel(activeThreadId, e.target.value)}
                            >
                                {availableModels.length > 0 ? (
                                    availableModels.map(m => (
                                        <option key={m.id} value={m.name}>
                                            {m.displayName || m.name}
                                        </option>
                                    ))
                                ) : (
                                    <>
                                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    </>
                                )}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 transition-colors", memoryEnabled ? "text-primary bg-primary/10" : "text-muted-foreground")}
                        title={memoryEnabled ? "Memory On" : "Memory Off"}
                        onClick={toggleMemory}
                    >
                        <Brain size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Clear Chat"
                        onClick={clearChat}
                    >
                        <Trash2 size={16} />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2">
                        <Bot size={48} strokeWidth={1} />
                        <p className="text-sm">How can I help you today?</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <MessageItem key={msg.id} message={msg} />
                ))}

                {isThinking && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs animate-pulse pl-2">
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2 shrink-0 relative">
                {/* Slash Commands Popover */}
                {showSlashCommands && (
                    <div className="absolute bottom-full left-4 mb-2 w-48 bg-popover border border-border rounded-md shadow-md overflow-hidden z-10 animate-in slide-in-from-bottom-2 bg-card">
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border/50">
                            COMMANDS
                        </div>
                        <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                            onClick={() => handleSlashCommand('/clear')}
                        >
                            <Trash2 size={14} /> /clear
                        </button>
                        <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                            onClick={() => handleSlashCommand('/reset')}
                        >
                            <Square size={14} /> /reset
                        </button>
                    </div>
                )}

                <div className="relative flex flex-col gap-2 p-2 rounded-xl border border-border/60 bg-card/30 focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/40 transition-all shadow-sm">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'agent' ? "Describe a task for the agent... (Type / for commands)" : "Ask a question..."}
                        className="flex-1 max-h-48 min-h-[44px] bg-transparent border-none resize-none px-2 py-1 text-sm focus:outline-none scrollbar-hide"
                        style={{ height: 'auto', overflow: 'hidden' }}
                        rows={1}
                    />

                    <div className="flex justify-between items-center px-1">
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Attach File (Coming Soon)">
                                <Paperclip size={16} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-7 w-7", showSlashCommands ? "text-primary" : "text-muted-foreground")}
                                title="Slash Commands"
                                onClick={() => {
                                    setShowSlashCommands(!showSlashCommands)
                                    if (!showSlashCommands) setInput('/')
                                }}
                            >
                                <Slash size={16} />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            {isThinking ? (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 gap-1 px-3"
                                    onClick={stop}
                                >
                                    <Square size={12} fill="currentColor" /> Stop
                                </Button>
                            ) : (
                                <Button
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded-lg shrink-0 transition-all",
                                        mode === 'ask' ? "bg-purple-600 hover:bg-purple-700" : ""
                                    )}
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim()}
                                >
                                    <Send size={14} />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-1.5 flex justify-center">
                    <span className="text-[10px] text-muted-foreground/60">
                        {mode === 'agent' ? 'Agent Mode: Can read/write files & execute code.' : 'Ask Mode: Chat & Analysis only.'}
                    </span>
                </div>
            </div>
        </div>
    )
}

function MessageItem({ message }: { message: AgentMessage }) {
    const isUser = message.role === 'user'
    const isSystem = message.role === 'system'

    if (isSystem) {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-muted/50 px-3 py-1.5 rounded text-xs text-muted-foreground flex items-center gap-2 border border-border/30">
                    <AlertCircle size={12} />
                    {message.content}
                </div>
            </div>
        )
    }

    return (
        <div className={cn(
            "flex w-full gap-3 group px-2",
            isUser ? "justify-end" : "justify-start"
        )}>
            {!isUser && (
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                    message.mode === 'ask' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-primary/10 text-primary"
                )}>
                    {message.mode === 'ask' ? <Sparkles size={14} /> : <Bot size={16} />}
                </div>
            )}

            <div className={cn(
                "flex flex-col max-w-[85%]",
                isUser ? "items-end" : "items-start"
            )}>
                {/* Name & Time */}
                {!isUser && (
                    <div className="flex items-center gap-2 mb-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-medium text-muted-foreground">
                            {message.mode === 'ask' ? 'Gemini' : 'Codex'}
                        </span>
                    </div>
                )}

                <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap leading-relaxed",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border/40 text-card-foreground rounded-bl-sm"
                )}>
                    {message.content}
                </div>
            </div>

            {isUser && (
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                    <User size={16} />
                </div>
            )}
        </div>
    )
}
