const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const nodeExecutable = process.execPath;
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const waitOnCli = path.join(rootDir, 'node_modules', 'wait-on', 'bin', 'wait-on');
const electronCli = path.join(rootDir, 'node_modules', 'electron', 'cli.js');

let shuttingDown = false;
const childProcesses = [];

function startNodeProcess(scriptPath, args, name) {
  const childProcess = spawn(nodeExecutable, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  childProcess.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      console.error(`${name} exited with code ${code ?? 'unknown'}${signal ? ` (signal: ${signal})` : ''}`);
      shutdown(code ?? 1);
    }
  });

  childProcess.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`Failed to start ${name}:`, error);
    shutdown(1);
  });

  childProcesses.push(childProcess);
  return childProcess;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const childProcess of childProcesses) {
    if (!childProcess.killed) {
      childProcess.kill();
    }
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  startNodeProcess(viteCli, [], 'vite');

  const waitOnProcess = startNodeProcess(waitOnCli, ['http://localhost:5173'], 'wait-on');

  waitOnProcess.on('exit', (code) => {
    if (shuttingDown || code !== 0) {
      return;
    }

    startNodeProcess(electronCli, ['.'], 'electron');
  });
}

main().catch((error) => {
  console.error('Failed to launch dev environment:', error);
  shutdown(1);
});
