/**
 * MCP (Model Context Protocol) Client
 * Connects to fastMCP server over HTTP
 */

export interface MCPTool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
}

export interface MCPResource {
    uri: string
    name: string
    description?: string
    mimeType?: string
}

export interface MCPConnectionStatus {
    connected: boolean
    serverUrl: string
    tools: MCPTool[]
    resources: MCPResource[]
    error?: string
}

class MCPClient {
    private serverUrl: string = ''
    private connected: boolean = false
    private tools: MCPTool[] = []
    private resources: MCPResource[] = []
    private listeners: Set<(status: MCPConnectionStatus) => void> = new Set()

    getStatus(): MCPConnectionStatus {
        return {
            connected: this.connected,
            serverUrl: this.serverUrl,
            tools: this.tools,
            resources: this.resources,
        }
    }

    subscribe(callback: (status: MCPConnectionStatus) => void) {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    private notify() {
        const status = this.getStatus()
        this.listeners.forEach(cb => cb(status))
    }

    private sessionId: string | null = null

    async connect(serverUrl: string): Promise<MCPConnectionStatus> {
        this.serverUrl = serverUrl
        this.sessionId = null

        try {
            // Step 1: Initialize handshake (required by MCP protocol)
            await this.request('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'leion-workspace',
                    version: '1.0.0',
                },
            })

            // Try to extract session ID from URI if present in debug logs (it might be a query param on a redirect we missed, 
            // or we might need to look at headers if returned)

            // Step 2: Send initialized notification
            await this.request('notifications/initialized', {}, true)

            // Step 3: List tools
            const toolsResponse = await this.request('tools/list', {})
            this.tools = toolsResponse.tools || []

            // Step 4: Try to list resources
            try {
                const resourcesResponse = await this.request('resources/list', {})
                this.resources = resourcesResponse.resources || []
            } catch {
                this.resources = []
            }

            this.connected = true
            this.notify()
            return this.getStatus()
        } catch (err: any) {
            this.connected = false
            const status = {
                ...this.getStatus(),
                error: err.message || 'Failed to connect',
            }
            this.notify()
            return status
        }
    }

    disconnect() {
        this.connected = false
        this.tools = []
        this.resources = []
        this.serverUrl = ''
        this.sessionId = null
        this.notify()
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<any> {
        if (!this.connected) {
            throw new Error('Not connected to MCP server')
        }

        const response = await this.request('tools/call', {
            name,
            arguments: args,
        })

        return response
    }

    async readResource(uri: string): Promise<any> {
        if (!this.connected) {
            throw new Error('Not connected to MCP server')
        }

        const response = await this.request('resources/read', { uri })
        return response
    }

    private async request(method: string, params: Record<string, unknown>, isNotification = false): Promise<any> {
        // Append session ID to URL if we have one (some implementations use query param)
        let requestUrl = this.serverUrl
        if (this.sessionId) {
            const separator = requestUrl.includes('?') ? '&' : '?'
            requestUrl = `${requestUrl}${separator}session_id=${this.sessionId}`
        }

        const body: any = {
            jsonrpc: '2.0',
            method,
        }

        if (params && Object.keys(params).length > 0) {
            body.params = params
        }

        if (!isNotification) {
            body.id = Date.now()
        }

        // Use Electron IPC to bypass CORS
        const platform = (window as any).platform
        if (platform?.mcp?.request) {
            const headers: Record<string, string> = {}
            if (this.sessionId) {
                headers['mcp-session-id'] = this.sessionId
            }

            // Call with (url, body, headers) signature
            // We pass the full body object instead of method/params
            const response = await platform.mcp.request(requestUrl, body, headers)

            // Extract session ID from headers (returned by our Electron proxy)
            if (response.headers && !this.sessionId) {
                // Headers from Node http are lowercase
                // Check for mcp-session-id or x-session-id
                const responseHeaders = response.headers
                const sessionId = responseHeaders['mcp-session-id'] || responseHeaders['x-session-id']

                if (sessionId) {
                    this.sessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId
                }
            }

            if (!response.success && !response.result) {
                throw new Error(response.error || 'MCP request failed')
            }

            // If the server returned an error about missing session ID, but we just got one, we might need to retry? 
            // No, catching it early is better.

            // NOTE: FastMCP might return session ID in the query string of a redirect, but we are handling HTTP 200 OK.
            // Let's assume for now it might be in a header or we need to parse the response URL if it changed (Electron net.request might follow redirects)

            return response.result || response // Handle case where result is at root or inside result
        }

        // Fallback to direct fetch (for non-Electron environments)
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now(),
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Extract session ID from URL if redirected
        const url = new URL(response.url)
        const sessionId = url.searchParams.get('session_id')
        if (sessionId && !this.sessionId) {
            this.sessionId = sessionId
            console.log('[MCP Client] Captured session ID from URL:', this.sessionId)
        }

        const data = await response.json()

        if (data.error) {
            throw new Error(data.error.message || 'MCP error')
        }

        return data.result
    }
}

// Singleton instance
export const mcpClient = new MCPClient()
