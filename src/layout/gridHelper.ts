import { MosaicNode } from 'react-mosaic-component';
import { PaneId } from './store';

// Generates a 3x2 grid layout
// Top Row: 3 columns
// Bottom Row: 3 columns
export function create6ZoneGrid(paneIds: PaneId[]): MosaicNode<PaneId> {
    // We need exactly 6 IDs. If fewer, we fill with placeholders (handled by caller?)
    // Actually, let's assume we receive 6 IDs.

    // Top Row
    const topRow: MosaicNode<PaneId> = {
        direction: 'row',
        first: paneIds[0],
        second: {
            direction: 'row',
            first: paneIds[1],
            second: paneIds[2],
            splitPercentage: 50
        },
        splitPercentage: 33.33
    };

    // Bottom Row
    const bottomRow: MosaicNode<PaneId> = {
        direction: 'row',
        first: paneIds[3],
        second: {
            direction: 'row',
            first: paneIds[4],
            second: paneIds[5],
            splitPercentage: 50
        },
        splitPercentage: 33.33
    };

    // Root Column
    return {
        direction: 'column',
        first: topRow,
        second: bottomRow,
        splitPercentage: 50
    };
}

// Helpers for Layout Manipulation

export type MosaicPath = ('first' | 'second')[];

export function findPathToNode(root: MosaicNode<PaneId> | null, id: PaneId, currentPath: MosaicPath = []): MosaicPath | null {
    if (!root) return null;
    if (root === id) return currentPath;

    if (typeof root === 'object') {
        const firstPath = findPathToNode(root.first, id, [...currentPath, 'first']);
        if (firstPath) return firstPath;

        const secondPath = findPathToNode(root.second, id, [...currentPath, 'second']);
        if (secondPath) return secondPath;
    }

    return null;
}

export function getNodeAtPath(root: MosaicNode<PaneId> | null, path: MosaicPath): MosaicNode<PaneId> | null {
    let current = root;
    for (const direction of path) {
        if (!current || typeof current !== 'object') return null;
        current = direction === 'first' ? current.first : current.second;
    }
    return current;
}

export function setSplitPercentageAtPath(root: MosaicNode<PaneId> | null, path: MosaicPath, percentage: number): MosaicNode<PaneId> | null {
    if (!root) return null;
    if (path.length === 0) {
        // We are at target, but target must be an object to have splitPercentage
        if (typeof root === 'object') {
            return { ...root, splitPercentage: percentage };
        }
        return root;
    }

    if (typeof root !== 'object') return root;

    const direction = path[0];
    const remainingPath = path.slice(1);

    if (direction === 'first') {
        return {
            ...root,
            first: setSplitPercentageAtPath(root.first, remainingPath, percentage) as MosaicNode<PaneId>,
        };
    } else {
        return {
            ...root,
            second: setSplitPercentageAtPath(root.second, remainingPath, percentage) as MosaicNode<PaneId>,
        };
    }
}
