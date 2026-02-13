import type { WorkflowTemplate } from './types';

export const deployChecklistTemplate: WorkflowTemplate = {
    id: 'deploy-checklist',
    name: 'Deploy Checklist',
    description: 'Run tests, build, commit staged changes, verify the diff with Claude, and notify when ready to deploy.',
    category: 'development',
    tags: ['deploy', 'git', 'ci', 'ai', 'checklist'],
    definition: {
        name: 'Deploy Checklist',
        nodes: [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 80, y: 200 },
                data: { label: 'Start' },
            },
            {
                id: 'run-test-1',
                type: 'run',
                position: { x: 330, y: 200 },
                data: {
                    label: 'Run Tests',
                    terminalPaneId: '',
                    terminalCommand: 'npm test',
                    continueOnError: true,
                },
            },
            {
                id: 'if-test-pass-1',
                type: 'if',
                position: { x: 580, y: 200 },
                data: {
                    label: 'Tests Pass?',
                    conditionExpression: 'steps["run-test-1"].output.exitCode === 0',
                },
            },
            {
                id: 'run-build-1',
                type: 'run',
                position: { x: 830, y: 100 },
                data: {
                    label: 'Run Build',
                    terminalPaneId: '',
                    terminalCommand: 'npm run build',
                    continueOnError: true,
                },
            },
            {
                id: 'if-build-ok-1',
                type: 'if',
                position: { x: 1080, y: 100 },
                data: {
                    label: 'Build OK?',
                    conditionExpression: 'steps["run-build-1"].output.exitCode === 0',
                },
            },
            {
                id: 'git-commit-1',
                type: 'git-commit',
                position: { x: 1330, y: 50 },
                data: {
                    label: 'Git Commit',
                    gitOperation: 'commit',
                    gitMessage: 'chore: deploy',
                },
            },
            {
                id: 'git-diff-staged-1',
                type: 'git-diff',
                position: { x: 1580, y: 50 },
                data: {
                    label: 'Staged Diff',
                    gitOperation: 'diff',
                    gitStaged: true,
                },
            },
            {
                id: 'ask-verify-1',
                type: 'ask',
                position: { x: 1830, y: 50 },
                data: {
                    label: 'Verify with Claude',
                    chatPaneId: '',
                    chatPrompt: `Verify this diff is safe to deploy. Check for:
- No debug code or console.logs
- No hardcoded secrets or credentials
- No breaking changes
- No obvious bugs

Diff:
{{steps["git-diff-staged-1"].output.diff}}

Respond with: SAFE TO DEPLOY or ISSUES FOUND (with explanation)`,
                },
            },
            {
                id: 'notify-ready-1',
                type: 'notify',
                position: { x: 2080, y: 50 },
                data: {
                    label: 'Notify Ready',
                    notifyTitle: 'Ready to Deploy',
                    notifyBody: 'All checks passed. Claude verified the diff is safe.',
                },
            },
            {
                id: 'notify-fail-tests-1',
                type: 'notify',
                position: { x: 830, y: 300 },
                data: {
                    label: 'Tests Failed',
                    notifyTitle: 'Deploy Blocked',
                    notifyBody: 'Tests failed. Fix before deploying.',
                },
            },
            {
                id: 'notify-fail-build-1',
                type: 'notify',
                position: { x: 1330, y: 200 },
                data: {
                    label: 'Build Failed',
                    notifyTitle: 'Deploy Blocked',
                    notifyBody: 'Build failed. Fix before deploying.',
                },
            },
            {
                id: 'end-1',
                type: 'end',
                position: { x: 2330, y: 200 },
                data: { label: 'End' },
            },
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'run-test-1' },
            { id: 'e2', source: 'run-test-1', target: 'if-test-pass-1' },
            { id: 'e3', source: 'if-test-pass-1', target: 'run-build-1', sourceHandle: 'true', label: 'Pass' },
            { id: 'e4', source: 'if-test-pass-1', target: 'notify-fail-tests-1', sourceHandle: 'false', label: 'Fail' },
            { id: 'e5', source: 'run-build-1', target: 'if-build-ok-1' },
            { id: 'e6', source: 'if-build-ok-1', target: 'git-commit-1', sourceHandle: 'true', label: 'OK' },
            { id: 'e7', source: 'if-build-ok-1', target: 'notify-fail-build-1', sourceHandle: 'false', label: 'Fail' },
            { id: 'e8', source: 'git-commit-1', target: 'git-diff-staged-1' },
            { id: 'e9', source: 'git-diff-staged-1', target: 'ask-verify-1' },
            { id: 'e10', source: 'ask-verify-1', target: 'notify-ready-1' },
            { id: 'e11', source: 'notify-ready-1', target: 'end-1' },
            { id: 'e12', source: 'notify-fail-tests-1', target: 'end-1' },
            { id: 'e13', source: 'notify-fail-build-1', target: 'end-1' },
        ],
        variables: {},
    },
};
