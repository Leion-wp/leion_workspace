import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';
import { terminalCommandService } from '../../../services/terminalCommandService';

export interface TerminalExecResult {
    stdout: string;
    exitCode: number;
    dryRun?: boolean;
}

export async function executeTerminalNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<TerminalExecResult | unknown> {
    const {
        terminalPaneId,
        terminalCommand,
        terminalAction = 'run',
        terminalWorkingDir,
        terminalEnvVars,
        terminalStdin,
        terminalSignal = 'SIGINT',
        terminalWaitPattern,
    } = node.data;

    if (!terminalPaneId?.trim()) {
        throw new Error(`Terminal node "${node.id}" has no target pane selected`);
    }

    const terminalId = `terminal-${terminalPaneId}`;

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Terminal [${terminalPaneId}]: action=${terminalAction}`);
        return { stdout: '', exitCode: 0, dryRun: true };
    }

    switch (terminalAction) {
        case 'run': {
            if (!terminalCommand?.trim()) {
                throw new Error(`Terminal node "${node.id}" has no command configured`);
            }

            let resolvedCommand = String(resolveValue(terminalCommand, context));

            // Prepend env vars if configured
            if (terminalEnvVars?.trim()) {
                try {
                    const envObj = JSON.parse(terminalEnvVars) as Record<string, string>;
                    const envStr = Object.entries(envObj)
                        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                        .join(' ');
                    resolvedCommand = `${envStr} ${resolvedCommand}`;
                } catch {
                    context.logs.push(`Terminal [${terminalPaneId}]: warning — invalid terminalEnvVars JSON, skipping env injection`);
                }
            }

            // Prepend working directory change if configured
            if (terminalWorkingDir?.trim()) {
                const resolvedDir = String(resolveValue(terminalWorkingDir, context));
                resolvedCommand = `cd ${JSON.stringify(resolvedDir)} && ${resolvedCommand}`;
            }

            context.logs.push(`Terminal [${terminalPaneId}]: ${resolvedCommand}`);

            const result = await terminalCommandService.execute(terminalId, resolvedCommand);

            context.logs.push(`Terminal exit code: ${result.exitCode}`);
            if (result.stdout) {
                context.logs.push(`stdout: ${result.stdout.slice(0, 200)}${result.stdout.length > 200 ? '…' : ''}`);
            }

            return result;
        }

        case 'new-session': {
            context.logs.push(`Terminal [${terminalPaneId}]: creating new session`);
            // Send a clear/reset sequence to effectively start fresh
            await terminalCommandService.execute(terminalId, 'clear');
            return { stdout: '', exitCode: 0, action: 'new-session', paneId: terminalPaneId };
        }

        case 'send-input': {
            if (!terminalStdin) {
                throw new Error(`Terminal node "${node.id}": send-input requires terminalStdin`);
            }
            const resolvedInput = String(resolveValue(terminalStdin, context));
            context.logs.push(`Terminal [${terminalPaneId}]: sending input (${resolvedInput.length} chars)`);
            // Send the input as a raw command without waiting for a specific output
            const result = await terminalCommandService.execute(terminalId, resolvedInput);
            return { stdout: result.stdout ?? '', exitCode: result.exitCode, action: 'send-input' };
        }

        case 'send-signal': {
            context.logs.push(`Terminal [${terminalPaneId}]: sending signal ${terminalSignal}`);
            // Map signals to their keyboard equivalents / escape sequences
            let signalCommand: string;
            if (terminalSignal === 'SIGINT') {
                // Ctrl+C
                signalCommand = '\x03';
            } else if (terminalSignal === 'SIGTERM') {
                signalCommand = 'kill %1';
            } else if (terminalSignal === 'SIGKILL') {
                signalCommand = 'kill -9 %1';
            } else {
                signalCommand = '\x03';
            }
            await terminalCommandService.execute(terminalId, signalCommand);
            return { stdout: '', exitCode: 0, action: 'send-signal', signal: terminalSignal };
        }

        case 'wait-for-pattern': {
            if (!terminalWaitPattern?.trim()) {
                throw new Error(`Terminal node "${node.id}": wait-for-pattern requires terminalWaitPattern`);
            }
            context.logs.push(`Terminal [${terminalPaneId}]: waiting for pattern "${terminalWaitPattern}"`);
            // Execute a polling command to check for the pattern in terminal output
            const patternRegex = new RegExp(terminalWaitPattern);
            const maxAttempts = 30;
            const pollInterval = 1000;
            let matched = false;
            let lastOutput = '';

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const result = await terminalCommandService.execute(terminalId, '');
                const output = result.stdout ?? '';
                if (patternRegex.test(output)) {
                    matched = true;
                    lastOutput = output;
                    break;
                }
                await new Promise((r) => setTimeout(r, pollInterval));
            }

            context.logs.push(`Terminal [${terminalPaneId}]: pattern ${matched ? 'matched' : 'timed out'}`);
            return { stdout: lastOutput, exitCode: matched ? 0 : 1, action: 'wait-for-pattern', matched, pattern: terminalWaitPattern };
        }

        default:
            throw new Error(`Terminal node "${node.id}": unknown action "${terminalAction}"`);
    }
}
