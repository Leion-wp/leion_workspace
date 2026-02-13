import type { ExecutionContext } from '../types';
import { GraphEngine } from './GraphEngine';
import type { WorkflowDefinition, ExecutorDependencies, WorkflowEngineCallbacks } from '../types';

// --- Test Runner Types ---

export interface WorkflowTestCase {
    name: string;
    description?: string;
    /** Initial variables for the workflow */
    variables?: Record<string, unknown>;
    /** Mock tool responses: toolName -> response */
    mockTools?: Record<string, unknown>;
    /** Mock env vars */
    mockEnv?: Record<string, string>;
    /** Assertions to check after execution */
    assertions: WorkflowAssertion[];
}

export interface WorkflowAssertion {
    type: 'node-status' | 'node-output' | 'variable-equals' | 'log-contains' | 'execution-status';
    /** For node-status: check a node completed with expected status */
    nodeId?: string;
    expectedStatus?: 'success' | 'error' | 'skipped';
    /** For node-output: check a node's output matches */
    expectedOutput?: unknown;
    /** Dot-path into the output object (e.g. "result.count") */
    outputPath?: string;
    /** For variable-equals: check a workflow variable value */
    variableName?: string;
    expectedValue?: unknown;
    /** For log-contains: check that logs contain a string */
    logPattern?: string;
    /** For execution-status: check final execution status */
    expectedExecutionStatus?: 'success' | 'error' | 'aborted';
}

export interface AssertionResult {
    assertion: WorkflowAssertion;
    passed: boolean;
    message: string;
}

export interface WorkflowTestResult {
    testName: string;
    passed: boolean;
    assertions: AssertionResult[];
    executionContext: ExecutionContext;
    durationMs: number;
}

// --- Helpers ---

/**
 * Resolve a dot-path into a nested object.
 * e.g. getByPath({ a: { b: 3 } }, "a.b") => 3
 */
function getByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return current;
}

/**
 * Deep equality check for assertion comparison.
 */
function deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, i) => deepEquals(item, b[i]));
    }

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
        deepEquals(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
        ),
    );
}

function formatValue(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

// --- Test Runner ---

export class WorkflowTestRunner {
    private definition: WorkflowDefinition;

    constructor(definition: WorkflowDefinition) {
        this.definition = definition;
    }

    /**
     * Run a single test case against the workflow definition.
     */
    async runTest(testCase: WorkflowTestCase): Promise<WorkflowTestResult> {
        const startTime = Date.now();

        // Build definition with overridden variables
        const testDefinition: WorkflowDefinition = {
            ...this.definition,
            variables: {
                ...this.definition.variables,
                ...(testCase.variables ?? {}),
            },
        };

        // Collect logs during execution
        const logs: string[] = [];

        const callbacks: Partial<WorkflowEngineCallbacks> = {
            onLog: (message) => {
                logs.push(message);
            },
        };

        // Build mocked dependencies
        const dependencies: ExecutorDependencies = {
            callTool: async (name: string) => {
                if (testCase.mockTools && name in testCase.mockTools) {
                    return testCase.mockTools[name];
                }
                return { mocked: true, tool: name, message: `No mock defined for tool "${name}"` };
            },
            dryRun: true,
            envVars: testCase.mockEnv ?? {},
            paneStates: {},
            dispatchPaneCommand: async () => {
                return { mocked: true, message: 'Pane command mocked in test mode' };
            },
        };

        const engine = new GraphEngine(testDefinition, dependencies, callbacks);

        let context: ExecutionContext;
        try {
            context = await engine.execute();
        } catch (err: unknown) {
            // If execution itself throws (e.g. validation failure), create a minimal context
            const errorMessage = err instanceof Error ? err.message : String(err);
            context = {
                workflowId: testDefinition.id,
                executionId: `test-${Date.now()}`,
                status: 'error',
                stepResults: {},
                variables: testDefinition.variables,
                logs: [...logs, `Execution error: ${errorMessage}`],
            };
        }

        // Merge collected logs into context (engine populates its own logs too)
        const allLogs = [...new Set([...context.logs, ...logs])];
        context.logs = allLogs;

        // Evaluate assertions
        const assertionResults = testCase.assertions.map((assertion) =>
            this.evaluateAssertion(assertion, context),
        );

        const passed = assertionResults.every((r) => r.passed);

        return {
            testName: testCase.name,
            passed,
            assertions: assertionResults,
            executionContext: context,
            durationMs: Date.now() - startTime,
        };
    }

    /**
     * Run all test cases sequentially.
     */
    async runAll(testCases: WorkflowTestCase[]): Promise<WorkflowTestResult[]> {
        const results: WorkflowTestResult[] = [];
        for (const testCase of testCases) {
            const result = await this.runTest(testCase);
            results.push(result);
        }
        return results;
    }

    /**
     * Evaluate a single assertion against the execution context.
     */
    private evaluateAssertion(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        switch (assertion.type) {
            case 'node-status':
                return this.evaluateNodeStatus(assertion, context);
            case 'node-output':
                return this.evaluateNodeOutput(assertion, context);
            case 'variable-equals':
                return this.evaluateVariableEquals(assertion, context);
            case 'log-contains':
                return this.evaluateLogContains(assertion, context);
            case 'execution-status':
                return this.evaluateExecutionStatus(assertion, context);
            default:
                return {
                    assertion,
                    passed: false,
                    message: `Unknown assertion type: ${(assertion as WorkflowAssertion).type}`,
                };
        }
    }

    private evaluateNodeStatus(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        const { nodeId, expectedStatus } = assertion;
        if (!nodeId || !expectedStatus) {
            return { assertion, passed: false, message: 'node-status assertion requires nodeId and expectedStatus' };
        }

        const stepResult = context.stepResults[nodeId];
        if (!stepResult) {
            return { assertion, passed: false, message: `Node "${nodeId}" was not executed` };
        }

        const passed = stepResult.status === expectedStatus;
        return {
            assertion,
            passed,
            message: passed
                ? `Node "${nodeId}" status is "${expectedStatus}" as expected`
                : `Node "${nodeId}" status is "${stepResult.status}", expected "${expectedStatus}"`,
        };
    }

    private evaluateNodeOutput(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        const { nodeId, expectedOutput, outputPath } = assertion;
        if (!nodeId) {
            return { assertion, passed: false, message: 'node-output assertion requires nodeId' };
        }

        const stepResult = context.stepResults[nodeId];
        if (!stepResult) {
            return { assertion, passed: false, message: `Node "${nodeId}" was not executed` };
        }

        const actualValue = outputPath
            ? getByPath(stepResult.output, outputPath)
            : stepResult.output;

        const passed = deepEquals(actualValue, expectedOutput);
        const pathLabel = outputPath ? ` at path "${outputPath}"` : '';
        return {
            assertion,
            passed,
            message: passed
                ? `Node "${nodeId}" output${pathLabel} matches expected value`
                : `Node "${nodeId}" output${pathLabel}: got ${formatValue(actualValue)}, expected ${formatValue(expectedOutput)}`,
        };
    }

    private evaluateVariableEquals(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        const { variableName, expectedValue } = assertion;
        if (!variableName) {
            return { assertion, passed: false, message: 'variable-equals assertion requires variableName' };
        }

        const actualValue = context.variables[variableName];
        const passed = deepEquals(actualValue, expectedValue);
        return {
            assertion,
            passed,
            message: passed
                ? `Variable "${variableName}" equals ${formatValue(expectedValue)}`
                : `Variable "${variableName}": got ${formatValue(actualValue)}, expected ${formatValue(expectedValue)}`,
        };
    }

    private evaluateLogContains(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        const { logPattern } = assertion;
        if (!logPattern) {
            return { assertion, passed: false, message: 'log-contains assertion requires logPattern' };
        }

        const found = context.logs.some((log) => log.includes(logPattern));
        return {
            assertion,
            passed: found,
            message: found
                ? `Logs contain "${logPattern}"`
                : `Logs do not contain "${logPattern}"`,
        };
    }

    private evaluateExecutionStatus(assertion: WorkflowAssertion, context: ExecutionContext): AssertionResult {
        const { expectedExecutionStatus } = assertion;
        if (!expectedExecutionStatus) {
            return { assertion, passed: false, message: 'execution-status assertion requires expectedExecutionStatus' };
        }

        const passed = context.status === expectedExecutionStatus;
        return {
            assertion,
            passed,
            message: passed
                ? `Execution status is "${expectedExecutionStatus}" as expected`
                : `Execution status is "${context.status}", expected "${expectedExecutionStatus}"`,
        };
    }
}
