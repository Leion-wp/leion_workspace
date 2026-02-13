import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies, WorkflowDefinition } from '../../types';
import { GraphEngine } from '../GraphEngine';

export async function executeSubworkflowNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        subworkflowId,
        subworkflowOutputStep,
        subworkflowTimeout,
    } = node.data;

    if (!subworkflowId?.trim()) {
        throw new Error(`Subworkflow node "${node.id}" has no workflow ID configured`);
    }

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Subworkflow: would run ${subworkflowId}`);
        return { dryRun: true, subworkflowId };
    }

    // Load workflow from platform FS
    context.logs.push(`Subworkflow: loading ${subworkflowId}`);
    let definition: WorkflowDefinition;

    try {
        const json = await window.platform.fs.readFile(subworkflowId);
        definition = JSON.parse(json) as WorkflowDefinition;
    } catch (err) {
        throw new Error(`Subworkflow "${node.id}": failed to load "${subworkflowId}": ${String(err)}`);
    }

    // Inject parent context into sub-workflow variables
    const subVariables: Record<string, unknown> = {
        ...definition.variables,
        parent: context.stepResults,
        ...(node.data.subworkflowInputs ?? {}),
    };
    definition = { ...definition, variables: subVariables };

    context.logs.push(`Subworkflow: executing ${definition.name} (${definition.nodes.length} nodes)`);

    const subEngine = new GraphEngine(
        definition,
        dependencies,
        {
            onLog: (msg) => context.logs.push(`  [sub] ${msg}`),
        },
    );

    // Execute with optional timeout
    let subContext: Awaited<ReturnType<typeof subEngine.execute>>;
    if (subworkflowTimeout && subworkflowTimeout > 0) {
        const timeoutMs = subworkflowTimeout * 1000;
        subContext = await Promise.race([
            subEngine.execute(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Subworkflow "${node.id}" timed out after ${timeoutMs}ms`)),
                    timeoutMs,
                )
            ),
        ]);
    } else {
        subContext = await subEngine.execute();
    }

    context.logs.push(`Subworkflow: completed with status ${subContext.status}`);

    // If subworkflowOutputStep is specified, return only that step's output
    if (subworkflowOutputStep?.trim()) {
        const stepResult = subContext.stepResults[subworkflowOutputStep];
        const stepOutput = stepResult?.output ?? null;
        context.logs.push(`Subworkflow: returning output of step "${subworkflowOutputStep}"`);
        return {
            status: subContext.status,
            output: stepOutput,
            outputStep: subworkflowOutputStep,
        };
    }

    return {
        status: subContext.status,
        stepResults: subContext.stepResults,
        logs: subContext.logs,
    };
}
