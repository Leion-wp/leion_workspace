import { useState, useEffect, useRef } from 'react'
import './CodeServerPane.css'

interface CodeServerPaneProps {
    data?: { workspacePath?: string; port?: number }
    onUpdate?: (data: { workspacePath?: string; port?: number }) => void
}

export function CodeServerPane({ data }: CodeServerPaneProps) {
    const [status, setStatus] = useState<'checking' | 'starting' | 'running' | 'error'>('checking')
    const [port] = useState(data?.port || 8080)
    const [errorMessage, setErrorMessage] = useState('')
    const webviewRef = useRef<HTMLWebViewElement>(null)

    const codeServerUrl = `http://127.0.0.1:${port}/?folder=${encodeURIComponent(data?.workspacePath || 'd:/leion_workspace')}`

    useEffect(() => {
        checkCodeServer()
    }, [port])

    const checkCodeServer = async () => {
        setStatus('checking')
        try {
            // Try to connect to code-server
            await fetch(`http://127.0.0.1:${port}`, {
                mode: 'no-cors',
                signal: AbortSignal.timeout(2000)
            })
            // If we get here, code-server is likely running
            setStatus('running')
        } catch (err) {
            // code-server not running, try to start it
            startCodeServer()
        }
    }

    const startCodeServer = async () => {
        setStatus('starting')
        try {
            // Request main process to start code-server
            if (window.platform?.codeServer?.start) {
                const result = await window.platform.codeServer.start(port, data?.workspacePath)
                if (result.success) {
                    // Wait a bit for code-server to start
                    setTimeout(() => {
                        setStatus('running')
                    }, 3000)
                } else {
                    setErrorMessage(result.error || 'Failed to start code-server')
                    setStatus('error')
                }
            } else {
                setErrorMessage('code-server integration not available. Install with: npm i -g code-server')
                setStatus('error')
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to start code-server')
            setStatus('error')
        }
    }

    const handleRetry = () => {
        setErrorMessage('')
        checkCodeServer()
    }

    if (status === 'checking') {
        return (
            <div className="codeserver-pane codeserver-loading">
                <div className="codeserver-spinner" />
                <p>Checking for code-server...</p>
            </div>
        )
    }

    if (status === 'starting') {
        return (
            <div className="codeserver-pane codeserver-loading">
                <div className="codeserver-spinner" />
                <p>Starting code-server...</p>
                <span className="codeserver-hint">This may take a few seconds</span>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="codeserver-pane codeserver-error">
                <span className="codeserver-error-icon">⚠️</span>
                <h3>Could not start VS Code</h3>
                <p>{errorMessage}</p>
                <div className="codeserver-actions">
                    <button onClick={handleRetry} className="codeserver-btn primary">
                        Retry
                    </button>
                    <a
                        href="https://coder.com/docs/code-server/latest/install"
                        target="_blank"
                        className="codeserver-btn"
                    >
                        Install code-server
                    </a>
                </div>
                <div className="codeserver-install-hint">
                    <code>npm install -g code-server</code>
                </div>
            </div>
        )
    }

    return (
        <div className="codeserver-pane">
            <webview
                ref={webviewRef}
                src={codeServerUrl}
                className="codeserver-webview"
                // @ts-ignore - Electron webview attributes
                allowpopups={true}
                nodeintegration={false}
            />
        </div>
    )
}
