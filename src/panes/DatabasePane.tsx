import { useState, useCallback } from 'react'

interface DatabasePaneProps {
    id: string
    data?: Record<string, unknown>
    onUpdate?: (data: unknown) => void
}

interface QueryResult {
    columns: string[]
    rows: unknown[][]
}

export function DatabasePane({ data, onUpdate }: DatabasePaneProps) {
    const [dbPath, setDbPath] = useState((data?.dbPath as string) ?? ':memory:')
    const [isConnected, setIsConnected] = useState(false)
    const [currentQuery, setCurrentQuery] = useState((data?.currentQuery as string) ?? 'SELECT * FROM sqlite_master;')
    const [results, setResults] = useState<QueryResult | null>(null)
    const [tables, setTables] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [executionTime, setExecutionTime] = useState<number | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isExecuting, setIsExecuting] = useState(false)

    const callTool = useCallback((channel: string, args: Record<string, unknown>) => {
        return (window as unknown as { platform: { workflowTools: { call: (ch: string, a: Record<string, unknown>) => Promise<unknown> } } }).platform.workflowTools.call(channel, args)
    }, [])

    const handleConnect = useCallback(async () => {
        setIsConnecting(true)
        setError(null)
        try {
            const result = await callTool('db:connect', { path: dbPath }) as { success: boolean; error?: string }
            if (!result.success) {
                setError(result.error ?? 'Connection failed')
                setIsConnected(false)
            } else {
                setIsConnected(true)
                onUpdate?.({ dbPath })
                // Load tables
                const tablesResult = await callTool('db:tables', { path: dbPath }) as { success: boolean; tables?: string[]; error?: string }
                if (tablesResult.success && tablesResult.tables) {
                    setTables(tablesResult.tables)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setIsConnected(false)
        } finally {
            setIsConnecting(false)
        }
    }, [dbPath, callTool, onUpdate])

    const handleDisconnect = useCallback(async () => {
        try {
            await callTool('db:disconnect', { path: dbPath })
        } catch { /* ignore */ }
        setIsConnected(false)
        setTables([])
        setResults(null)
        setError(null)
        setExecutionTime(null)
    }, [dbPath, callTool])

    const handleExecute = useCallback(async () => {
        if (!isConnected) {
            setError('Not connected. Click Connect first.')
            return
        }
        if (!currentQuery.trim()) {
            setError('Query is empty.')
            return
        }
        setIsExecuting(true)
        setError(null)
        try {
            const result = await callTool('db:query', { path: dbPath, sql: currentQuery }) as {
                success: boolean
                rows?: Record<string, unknown>[]
                columns?: string[]
                affected?: number
                lastInsertRowid?: number
                executionTime?: number
                error?: string
            }
            if (!result.success) {
                setError(result.error ?? 'Query failed')
                setResults(null)
            } else {
                setExecutionTime(result.executionTime ?? null)
                if (result.columns !== undefined) {
                    // SELECT result: rows come as array of objects, convert to array of arrays
                    const cols = result.columns
                    const rowArrays = (result.rows ?? []).map((row) =>
                        cols.map((col) => (row as Record<string, unknown>)[col])
                    )
                    setResults({ columns: cols, rows: rowArrays })
                } else {
                    // DML result
                    setResults({
                        columns: ['affected', 'lastInsertRowid'],
                        rows: [[result.affected ?? 0, result.lastInsertRowid ?? null]],
                    })
                }
                // Refresh tables after potential schema change
                const tablesResult = await callTool('db:tables', { path: dbPath }) as { success: boolean; tables?: string[] }
                if (tablesResult.success && tablesResult.tables) {
                    setTables(tablesResult.tables)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setResults(null)
        } finally {
            setIsExecuting(false)
        }
    }, [isConnected, currentQuery, dbPath, callTool])

    const handleTableClick = useCallback((tableName: string) => {
        setCurrentQuery(`SELECT * FROM "${tableName}" LIMIT 100;`)
    }, [])

    const rowCount = results?.rows.length ?? null

    return (
        <div className="h-full flex flex-col bg-background text-foreground text-[13px] overflow-hidden">
            {/* Connection bar */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-card/50 flex-shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">DB Path:</span>
                <input
                    type="text"
                    value={dbPath}
                    onChange={(e) => setDbPath(e.target.value)}
                    disabled={isConnected}
                    placeholder=":memory: or /path/to/database.db"
                    className="flex-1 bg-background text-foreground border border-border rounded px-2 py-1 text-xs disabled:opacity-70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {!isConnected ? (
                    <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded cursor-pointer text-xs whitespace-nowrap disabled:opacity-70 hover:bg-primary/90 transition-colors"
                    >
                        {isConnecting ? 'Connecting…' : 'Connect'}
                    </button>
                ) : (
                    <button
                        onClick={handleDisconnect}
                        className="px-3 py-1 bg-secondary text-secondary-foreground border border-border rounded cursor-pointer text-xs whitespace-nowrap hover:bg-secondary/80 transition-colors"
                    >
                        Disconnect
                    </button>
                )}
                <div
                    title={isConnected ? 'Connected' : 'Disconnected'}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                />
            </div>

            {/* Main area: sidebar + editor + results */}
            <div className="flex-1 flex overflow-hidden">
                {/* Table sidebar */}
                <div className="w-40 flex-shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/30">
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border uppercase tracking-wider flex-shrink-0">
                        Tables
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {tables.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground italic">
                                {isConnected ? 'No tables' : 'Not connected'}
                            </div>
                        ) : (
                            tables.map((table) => (
                                <div
                                    key={table}
                                    onClick={() => handleTableClick(table)}
                                    title={`SELECT * FROM "${table}" LIMIT 100`}
                                    className="px-2 py-1.5 cursor-pointer text-xs border-b border-border/50 overflow-hidden text-ellipsis whitespace-nowrap hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                    🗄️ {table}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Editor + results */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* SQL editor */}
                    <div className="flex flex-col border-b border-border flex-shrink-0">
                        <textarea
                            value={currentQuery}
                            onChange={(e) => setCurrentQuery(e.target.value)}
                            placeholder="Enter SQL query…"
                            rows={5}
                            onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleExecute()
                                }
                            }}
                            className="bg-background text-foreground border-none border-b border-border p-2 text-xs font-mono leading-relaxed outline-none resize-none placeholder:text-muted-foreground/50"
                        />
                        <div className="flex items-center justify-end px-2 py-1 gap-2 bg-card/50">
                            <span className="text-[11px] text-muted-foreground">Ctrl+Enter to run</span>
                            <button
                                onClick={handleExecute}
                                disabled={isExecuting || !isConnected}
                                className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${isConnected
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                                    } ${isExecuting ? 'opacity-70' : ''}`}
                            >
                                {isExecuting ? 'Executing…' : 'Execute'}
                            </button>
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="px-2.5 py-1.5 bg-red-500/10 text-red-500 text-xs border-b border-red-500/20 flex-shrink-0">
                            {error}
                        </div>
                    )}

                    {/* Results table */}
                    <div className="flex-1 overflow-auto bg-background">
                        {results ? (
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                                    <tr>
                                        <th className="px-2 py-1 border border-border text-right font-semibold text-[11px] text-muted-foreground w-9 min-w-[36px]">#</th>
                                        {results.columns.map((col) => (
                                            <th key={col} className="px-2 py-1 border border-border font-semibold text-[11px] text-foreground whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.rows.map((row, rowIdx) => (
                                        <tr
                                            key={rowIdx}
                                            className="even:bg-muted/30 hover:bg-accent/30 transition-colors"
                                        >
                                            <td className="px-2 py-0.5 border border-border text-muted-foreground text-[11px] text-right">
                                                {rowIdx + 1}
                                            </td>
                                            {row.map((cell, colIdx) => (
                                                <td key={colIdx} className={`px-2 py-0.5 border border-border font-mono max-w-xs overflow-hidden text-ellipsis whitespace-nowrap ${cell === null ? 'text-muted-foreground italic' : ''}`}>
                                                    {cell === null ? 'NULL' : cell === undefined ? '' : String(cell)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            !error && (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-[13px] italic">
                                    {isConnected ? 'No results yet. Execute a query.' : 'Connect to a database to begin.'}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 px-2.5 py-1 border-t border-border bg-card/80 text-[11px] text-muted-foreground flex-shrink-0">
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isConnected ? `Connected: ${dbPath}` : 'Disconnected'}
                </span>
                {rowCount !== null && (
                    <span>• {rowCount} row{rowCount !== 1 ? 's' : ''}</span>
                )}
                {executionTime !== null && (
                    <span>• {executionTime}ms</span>
                )}
                {tables.length > 0 && (
                    <span>• {tables.length} table{tables.length !== 1 ? 's' : ''}</span>
                )}
            </div>
        </div>
    )
}
