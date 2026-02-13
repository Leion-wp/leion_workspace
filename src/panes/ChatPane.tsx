import { useState, useRef, useEffect } from 'react'
import { chatCommandService } from '../services/chatCommandService'
import { usePaneStateStore } from './paneStateStore'
import { usePaneControlBus } from './paneControlBus'
import './ChatPane.css'

type AIProvider = 'chatgpt' | 'gemini' | 'claude' | 'custom'

const AI_PROVIDERS: Record<AIProvider, { name: string; url: string; icon: string }> = {
    chatgpt: { name: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com', icon: '🔮' },
    claude: { name: 'Claude', url: 'https://claude.ai', icon: '🧠' },
    custom: { name: 'Custom', url: '', icon: '🌐' },
}

interface ChatPaneProps {
    id: string
    data?: {
        provider: AIProvider;
        customUrl?: string;
        inputDraft?: string;
        lastPaste?: number;
    }
    onUpdate?: (data: { provider: AIProvider; customUrl?: string }) => void
}

export function ChatPane({ id, data, onUpdate }: ChatPaneProps) {
    const [provider, setProvider] = useState<AIProvider>(data?.provider || 'chatgpt')
    const [customUrl, setCustomUrl] = useState(data?.customUrl || '')
    const [showPicker, setShowPicker] = useState(false)
    const webviewRef = useRef<HTMLElement>(null)

    const currentUrl = provider === 'custom' ? customUrl : AI_PROVIDERS[provider].url
    const currentProvider = AI_PROVIDERS[provider]

    // Register with chatCommandService so ChatNode can inject prompts
    useEffect(() => {
        const webview = webviewRef.current as (HTMLElement & { executeJavaScript: (s: string) => Promise<unknown> }) | null
        if (!webview) return

        const executor = (script: string) => webview.executeJavaScript(script)

        const onDomReady = () => chatCommandService.registerPane(id, executor)
        webview.addEventListener('dom-ready', onDomReady)

        return () => {
            webview.removeEventListener('dom-ready', onDomReady)
            chatCommandService.unregisterPane(id)
        }
    }, [id, currentUrl])

    // Initialize ambient pane state on mount, clean up on unmount
    useEffect(() => {
        usePaneStateStore.getState().setPaneState(id, {
            type: 'chat',
            lastResponse: '',
            isThinking: false,
        })
        return () => {
            usePaneStateStore.getState().removePaneState(id)
        }
    }, [id])

    // Register paneControlBus handler for broadcast inject
    useEffect(() => {
        const unregister = usePaneControlBus.getState().register(id, async (cmd) => {
            if (cmd.type === 'chat:inject' && chatCommandService.isRegistered(id)) {
                const text = cmd.payload.text as string
                // Use the same injection pattern as chatExecutor
                const script = `
                    (function() {
                        const el = document.querySelector('div.ProseMirror[contenteditable]')
                            || document.querySelector('#prompt-textarea')
                            || document.querySelector('textarea');
                        if (el) {
                            el.focus();
                            document.execCommand('insertText', false, ${JSON.stringify(text)});
                        }
                        return 'INJECTED';
                    })()
                `
                return chatCommandService.execute(id, script)
            }
            return { handled: false }
        })
        return unregister
    }, [id])

    // Track isThinking based on webview page load events
    useEffect(() => {
        const webview = webviewRef.current
        if (!webview) return

        const handleLoadStart = () => {
            usePaneStateStore.getState().updatePaneState(id, { isThinking: true })
        }
        const handleLoadStop = () => {
            usePaneStateStore.getState().updatePaneState(id, { isThinking: false })
        }

        webview.addEventListener('did-start-loading', handleLoadStart)
        webview.addEventListener('did-stop-loading', handleLoadStop)

        return () => {
            webview.removeEventListener('did-start-loading', handleLoadStart)
            webview.removeEventListener('did-stop-loading', handleLoadStop)
        }
    }, [id, currentUrl])

    const handleProviderChange = (newProvider: AIProvider) => {
        setProvider(newProvider)
        setShowPicker(false)
        onUpdate?.({ provider: newProvider, customUrl })
    }

    const handleCustomUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onUpdate?.({ provider: 'custom', customUrl })
    }

    // Handle clipboard "Paste to Chat"
    useEffect(() => {
        if (data?.inputDraft && webviewRef.current) {
            const webview = webviewRef.current as HTMLElement
            webview.focus()
            // Note: Content is already in clipboard (user passed Ctrl+V -> Interceptor -> Store -> Here)
            // We just focus so next Ctrl+V or just explicit focus helps.
            // Actually, the user did Ctrl+V on BODY.
            // So the clipboard has the content.
            // Focusing the webview might allow them to Ctrl+V again immediately into the input?
            // Or we could try to emulate a paste, but that's hard in webview.
            // At least focus brings them here.
        }
    }, [data?.lastPaste])


    return (
        <div className="chat-pane">
            <div className="chat-toolbar">
                <button
                    className="chat-provider-btn"
                    onClick={() => setShowPicker(!showPicker)}
                >
                    <span className="chat-provider-icon">{currentProvider.icon}</span>
                    <span>{currentProvider.name}</span>
                    <span className="chat-provider-arrow">▼</span>
                </button>

                {showPicker && (
                    <div className="chat-provider-picker">
                        {Object.entries(AI_PROVIDERS).map(([key, info]) => (
                            <button
                                key={key}
                                className={`chat-provider-option ${provider === key ? 'active' : ''}`}
                                onClick={() => handleProviderChange(key as AIProvider)}
                            >
                                <span>{info.icon}</span>
                                <span>{info.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {provider === 'custom' && (
                    <form className="chat-custom-url" onSubmit={handleCustomUrlSubmit}>
                        <input
                            type="url"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder="https://your-ai-url.com"
                        />
                        <button type="submit">Go</button>
                    </form>
                )}
            </div>

            {currentUrl && (
                <webview
                    ref={webviewRef as React.RefObject<HTMLElement>}
                    src={currentUrl}
                    className="chat-webview"
                    // @ts-ignore - Electron webview attributes
                    allowpopups={true}
                />
            )}

            {!currentUrl && provider === 'custom' && (
                <div className="chat-empty">
                    <span>🌐</span>
                    <p>Enter a custom AI URL above</p>
                </div>
            )}
        </div>
    )
}
