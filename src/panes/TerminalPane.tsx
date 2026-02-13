import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalCommandService } from '../services/terminalCommandService';
import { usePaneStateStore } from './paneStateStore';
import { usePaneControlBus } from './paneControlBus';

interface TerminalPaneProps {
    id: string;
    type?: 'terminal' | 'gemini';
}

export function TerminalPane({ id, type = 'terminal' }: TerminalPaneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const initRef = useRef(false);

    const setPaneState = usePaneStateStore((s) => s.setPaneState);
    const removePaneState = usePaneStateStore((s) => s.removePaneState);

    // Initialize ambient state on mount, clean up on unmount
    useEffect(() => {
        setPaneState(id, { type: 'terminal', lastOutput: '', cwd: '', isRunning: false });
        return () => removePaneState(id);
    }, [id, setPaneState, removePaneState]);

    // Register paneControlBus handler for broadcast input + fusion CWD sync
    useEffect(() => {
        const terminalId = `terminal-${id}`;
        const unregister = usePaneControlBus.getState().register(id, async (cmd) => {
            if (cmd.type === 'terminal:input' && window.platform?.terminal) {
                const data = cmd.payload.data as string;
                window.platform.terminal.send(terminalId, data);
                return { sent: true };
            }
            if (cmd.type === 'fusion:cwd' && window.platform?.terminal) {
                const cwd = cmd.payload.cwd as string;
                window.platform.terminal.send(terminalId, `cd "${cwd}"\r`);
                return { sent: true };
            }
            return { handled: false };
        });
        return unregister;
    }, [id]);

    useEffect(() => {
        if (!containerRef.current || initRef.current) return;
        initRef.current = true;

        const terminal = new Terminal({
            theme: {
                background: '#1e1e1e', // Matches VS Code dark
                foreground: '#cccccc',
                cursor: '#ffffff',
                cursorAccent: '#1e1e1e',
                selectionBackground: '#264f78',
                black: '#000000',
                red: '#cd3131',
                green: '#0dbc79',
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#e5e5e5',
            },
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
            fontSize: 13,
            cursorBlink: true,
            cursorStyle: 'block',
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);

        // Slight delay to ensure container has dimensions
        setTimeout(() => fitAddon.fit(), 50);

        const terminalId = `terminal-${id}`;

        if (!window.platform?.terminal) {
            terminal.writeln('\x1b[33mTerminal not available (run in Electron)\x1b[0m');
            return;
        }

        // Cleanup refs for display listeners
        let unsubData: (() => void) | null = null;
        let unsubExit: (() => void) | null = null;
        let resizeObserver: ResizeObserver | null = null;

        let outputBuffer = '';

        const setupDisplay = () => {
            // Write incoming PTY data to xterm
            unsubData = window.platform.terminal.onData(terminalId, (data: string) => {
                terminal.write(data);
                outputBuffer = (outputBuffer + data).slice(-4096);
                usePaneStateStore.getState().updatePaneState(id, { lastOutput: outputBuffer, isRunning: true });
            });

            // Handle process exit
            unsubExit = window.platform.terminal.onExit(terminalId, (code: number) => {
                terminal.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`);
                usePaneStateStore.getState().updatePaneState(id, { isRunning: false, exitCode: code });
            });

            // Forward input
            terminal.onData((data: string) => {
                window.platform.terminal.send(terminalId, data);
            });

            // Resize observer
            resizeObserver = new ResizeObserver(() => {
                try {
                    fitAddon.fit();
                    const dims = fitAddon.proposeDimensions();
                    if (dims && dims.cols > 0 && dims.rows > 0) {
                        window.platform.terminal.resize(terminalId, dims.cols, dims.rows);
                    }
                } catch (e) {
                    // Ignore resize errors
                }
            });
            resizeObserver.observe(containerRef.current!);
        };

        if (terminalCommandService.isInitialized(terminalId)) {
            setupDisplay();
        } else {
            // Invoke creation with options object based on prop
            window.platform.terminal.create(terminalId, { type } as any).then((success: boolean) => {
                if (!success) {
                    terminal.writeln('Failed to create terminal process');
                    return;
                }
                terminalCommandService.initTerminal(terminalId);
                setupDisplay();
            }).catch((err: any) => {
                terminal.writeln(`Error: ${err.message || err}`);
            });
        }

        return () => {
            unsubData?.();
            unsubExit?.();
            resizeObserver?.disconnect();
            terminal.dispose();
        };
    }, [id]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
            {/* Optional Header (like VS Code terminal tabs if needed, for now just the term) */}
            <div
                ref={containerRef}
                className="flex-1 overflow-hidden p-2 pl-4"
            />
        </div>
    );
}
