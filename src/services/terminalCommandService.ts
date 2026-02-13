// Singleton service — manages terminal command execution independently of React lifecycle.
// TerminalPane registers terminals here on mount. Workflows dispatch here directly,
// so cross-space execution works even when the target space is not the active one.

const SENTINEL = '__LEION_DONE__'

// eslint-disable-next-line no-control-regex
function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '')
}

interface CaptureState {
    buffer: string
    resolve: (r: { stdout: string; exitCode: number }) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
}

class TerminalCommandService {
    private initialized = new Set<string>()
    private captures = new Map<string, CaptureState>()

    /** Called once per terminal after the PTY process is created. Safe to call multiple times. */
    initTerminal(terminalId: string): void {
        if (this.initialized.has(terminalId)) return
        this.initialized.add(terminalId)

        // Persistent capture listener — survives space switches
        window.platform.terminal.onData(terminalId, (data: string) => {
            const cap = this.captures.get(terminalId)
            if (!cap) return

            cap.buffer += data
            const clean = stripAnsi(cap.buffer)
            const match = clean.match(new RegExp(`${SENTINEL}:(\\d*)`))
            if (match) {
                clearTimeout(cap.timer)
                this.captures.delete(terminalId)
                const exitCode = parseInt(match[1], 10)
                const stdout = clean
                    .substring(0, clean.indexOf(SENTINEL))
                    .replace(/^\s+|\s+$/g, '')
                cap.resolve({ stdout, exitCode: isNaN(exitCode) ? 0 : exitCode })
            }
        })
    }

    isInitialized(terminalId: string): boolean {
        return this.initialized.has(terminalId)
    }

    execute(terminalId: string, command: string): Promise<{ stdout: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            if (!window.platform?.terminal) {
                reject(new Error('Terminal not available (run in Electron)'))
                return
            }
            if (!this.initialized.has(terminalId)) {
                reject(new Error(
                    `Terminal "${terminalId}" is not initialized. ` +
                    `Open the target space and its terminal pane at least once before running.`
                ))
                return
            }
            if (this.captures.has(terminalId)) {
                reject(new Error(`Terminal "${terminalId}" is already executing a command`))
                return
            }

            const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win')
            const wrappedCmd = isWindows
                ? `${command}; Write-Host "${SENTINEL}:$LASTEXITCODE"\r\n`
                : `${command}; echo "${SENTINEL}:$?"\n`

            const timer = setTimeout(() => {
                if (this.captures.has(terminalId)) {
                    this.captures.delete(terminalId)
                    reject(new Error(`Terminal command timed out after 60s: ${command}`))
                }
            }, 60_000)

            this.captures.set(terminalId, { buffer: '', resolve, reject, timer })
            window.platform.terminal.send(terminalId, wrappedCmd)
        })
    }
}

export const terminalCommandService = new TerminalCommandService()
