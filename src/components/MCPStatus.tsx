import { useState, useEffect } from 'react'
import { mcpClient, type MCPConnectionStatus } from '../services/mcp'
import './MCPStatus.css'

interface MCPStatusProps {
    compact?: boolean
}

export function MCPStatus({ compact = false }: MCPStatusProps) {
    const [status, setStatus] = useState<MCPConnectionStatus>(mcpClient.getStatus())
    const [serverUrl, setServerUrl] = useState('http://127.0.0.1:8000/mcp')
    const [isConnecting, setIsConnecting] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    useEffect(() => {
        const unsubscribe = mcpClient.subscribe(setStatus)
        return () => { unsubscribe() }
    }, [])

    const handleConnect = async () => {
        setIsConnecting(true)
        try {
            await mcpClient.connect(serverUrl)
        } finally {
            setIsConnecting(false)
        }
    }

    const handleDisconnect = () => {
        mcpClient.disconnect()
    }

    if (compact) {
        return (
            <div className={`mcp-status-compact ${status.connected ? 'connected' : ''}`}>
                <span className="mcp-dot" />
                <span>MCP</span>
            </div>
        )
    }

    return (
        <div className="mcp-status">
            <div className="mcp-header" onClick={() => setShowDetails(!showDetails)}>
                <div className="mcp-title">
                    <span className={`mcp-indicator ${status.connected ? 'connected' : ''}`} />
                    <span>MCP Server</span>
                </div>
                <span className="mcp-toggle">{showDetails ? '▼' : '▶'}</span>
            </div>

            {showDetails && (
                <div className="mcp-details">
                    {!status.connected ? (
                        <div className="mcp-connect-form">
                            <input
                                type="url"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="http://127.0.0.1:8000/mcp"
                                disabled={isConnecting}
                            />
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="mcp-btn primary"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mcp-info">
                                <span className="mcp-label">Connected to:</span>
                                <span className="mcp-value">{status.serverUrl}</span>
                            </div>

                            <div className="mcp-section">
                                <span className="mcp-label">Tools ({status.tools.length})</span>
                                <div className="mcp-list">
                                    {status.tools.map(tool => (
                                        <div
                                            key={tool.name}
                                            className="mcp-item"
                                            title={tool.description}
                                            draggable
                                            onDragStart={(e) => {
                                                console.log('MCPStatus Drag Start:', tool.name);
                                                e.dataTransfer.setData('application/json', JSON.stringify({
                                                    type: 'tool',
                                                    data: {
                                                        label: tool.name,
                                                        description: tool.description,
                                                        inputSchema: tool.inputSchema
                                                    }
                                                }));
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            style={{ cursor: 'grab' }}
                                        >
                                            🔧 {tool.name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {status.resources.length > 0 && (
                                <div className="mcp-section">
                                    <span className="mcp-label">Resources ({status.resources.length})</span>
                                    <div className="mcp-list">
                                        {status.resources.map(resource => (
                                            <div key={resource.uri} className="mcp-item" title={resource.uri}>
                                                📁 {resource.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={handleDisconnect} className="mcp-btn">
                                Disconnect
                            </button>
                        </>
                    )}

                    {status.error && (
                        <div className="mcp-error">
                            ⚠️ {status.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
