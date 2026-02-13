import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { useLayoutStore } from '../../../layout/store';

// Track previous space ID for 'return-previous' operation
let _previousSpaceId: string | null = null;

export async function executeSpaceNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        targetSpaceId,
        spaceOperation = 'switch',
        spaceNewName,
        spaceNewIcon,
        spacePaneType,
        spacePaneTarget,
    } = node.data;

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Space: would perform "${spaceOperation}"`);
        return { dryRun: true, spaceOperation };
    }

    const store = useLayoutStore.getState();

    switch (spaceOperation) {
        case 'switch': {
            if (!targetSpaceId?.trim()) {
                throw new Error(`Space node "${node.id}" has no target space configured`);
            }
            context.logs.push(`Space: switching to ${targetSpaceId}`);
            _previousSpaceId = store.activeSpaceId;
            store.switchSpace(targetSpaceId);
            return { switched: true, spaceId: targetSpaceId };
        }

        case 'create': {
            const name = spaceNewName?.trim() || 'New Space';
            const icon = spaceNewIcon?.trim() || '📁';
            context.logs.push(`Space: creating space "${name}" (${icon})`);
            store.createSpace(name, icon);
            // The newly created space will be the last in the array
            const newSpaces = useLayoutStore.getState().spaces;
            const newSpace = newSpaces[newSpaces.length - 1];
            return { created: true, spaceId: newSpace.id, name, icon };
        }

        case 'add-pane': {
            if (!spacePaneType?.trim()) {
                throw new Error(`Space node "${node.id}": add-pane requires spacePaneType`);
            }
            const currentLayout = store.layout;
            const paneId = spacePaneTarget?.trim() || `pane-${Date.now()}`;
            context.logs.push(`Space: adding pane "${paneId}" of type "${spacePaneType}"`);

            // Add pane to current layout by splitting
            const newLayout = currentLayout
                ? { direction: 'row' as const, first: currentLayout, second: paneId, splitPercentage: 70 }
                : paneId;
            store.setLayout(newLayout);
            store.setPaneType(paneId, spacePaneType as import('../../../panes/types').PaneType);
            return { addedPane: true, paneId, paneType: spacePaneType };
        }

        case 'close-pane': {
            if (!spacePaneTarget?.trim()) {
                throw new Error(`Space node "${node.id}": close-pane requires spacePaneTarget`);
            }
            context.logs.push(`Space: closing pane "${spacePaneTarget}"`);
            // Remove the pane from the layout by rebuilding without it
            const cleanLayout = removePaneFromLayout(store.layout, spacePaneTarget);
            store.setLayout(cleanLayout);
            return { closedPane: spacePaneTarget };
        }

        case 'return-previous': {
            if (!_previousSpaceId) {
                context.logs.push(`Space: no previous space to return to`);
                return { returnedToPrevious: false };
            }
            context.logs.push(`Space: returning to previous space ${_previousSpaceId}`);
            const prevId = _previousSpaceId;
            _previousSpaceId = store.activeSpaceId;
            store.switchSpace(prevId);
            return { returnedToPrevious: true, spaceId: prevId };
        }

        default:
            throw new Error(`Space node "${node.id}": unknown operation "${spaceOperation}"`);
    }
}

// Helper: recursively remove a pane from a mosaic layout tree
function removePaneFromLayout(
    layout: import('react-mosaic-component').MosaicNode<string> | null,
    paneId: string
): import('react-mosaic-component').MosaicNode<string> | null {
    if (!layout) return null;
    if (typeof layout === 'string') {
        return layout === paneId ? null : layout;
    }
    const newFirst = removePaneFromLayout(layout.first, paneId);
    const newSecond = removePaneFromLayout(layout.second, paneId);
    if (newFirst === null) return newSecond;
    if (newSecond === null) return newFirst;
    return { ...layout, first: newFirst, second: newSecond };
}
