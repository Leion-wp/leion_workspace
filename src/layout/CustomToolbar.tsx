import { MosaicBranch, MosaicNode, MosaicContext } from 'react-mosaic-component';
import { Maximize2, X, Split, Minus, Radio, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useLayoutStore } from './store';
import { useBroadcastStore } from './broadcastStore';
import { useFusionStore } from '../panes/fusionStore';
import { closePaneWithCleanup } from './paneLifecycle';
import { cn } from '../lib/utils';

interface CustomToolbarProps {
    title: string;
    path: MosaicBranch[];
    paneId?: string;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export function CustomToolbar({ title, path, paneId, collapsed, onToggleCollapse }: Omit<CustomToolbarProps, 'draggable' | 'onDragStart' | 'onDragEnd'>) {
    const pane = useLayoutStore(s => paneId ? s.panes[paneId] : null);
    const isBroadcasting = useBroadcastStore(s => paneId ? s.isBroadcasting(paneId) : false);
    const toggleBroadcast = useBroadcastStore(s => s.toggleBroadcast);
    const isPopoutWindow = new URLSearchParams(window.location.search).has('popout');

    const fusionColor = useFusionStore(s => paneId ? s.getFusionColor(paneId) : null);
    const isBroadcastable = pane?.type === 'chat' || pane?.type === 'terminal';

    return (
        <MosaicContext.Consumer>
            {({ mosaicActions }) => (
                <div
                    className="flex items-center justify-between h-8 bg-card border-b border-border/40 px-2 select-none group"
                >
                    {/* Title / Drag Handle */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors cursor-grab active:cursor-grabbing">
                        {fusionColor && (
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: fusionColor }}
                                title="Linked (Fusion)"
                            />
                        )}
                        <span className="truncate">{title}</span>
                        {isBroadcasting && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" title="Broadcasting" />
                        )}
                    </div>

                    {/* Window Controls */}
                    <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Broadcast Toggle */}
                        {!collapsed && isBroadcastable && paneId && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-5 w-5 rounded-sm",
                                    isBroadcasting
                                        ? "text-primary bg-primary/10 hover:bg-primary/20"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                                onClick={() => toggleBroadcast(paneId, pane!.type as 'chat' | 'terminal')}
                                title={isBroadcasting ? "Stop broadcasting" : "Start broadcasting"}
                            >
                                <Radio size={12} />
                            </Button>
                        )}

                        {/* Split Button */}
                        {!collapsed && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                                onClick={() => mosaicActions.replaceWith(path, {
                                    direction: 'row',
                                    first: getNodeAtPath(mosaicActions.getRoot(), path) as any,
                                    second: `pane-${Date.now()}`,
                                })}
                                title="Split"
                            >
                                <Split size={12} />
                            </Button>
                        )}

                        {/* Pop Out */}
                        {!collapsed && paneId && !isPopoutWindow && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                    const paneConfig = useLayoutStore.getState().panes[paneId];
                                    window.platform?.popout?.open(paneId, paneConfig);
                                }}
                                title="Pop out to window"
                            >
                                <ExternalLink size={12} />
                            </Button>
                        )}

                        {/* Expand/Restore */}
                        {!collapsed && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                                onClick={() => mosaicActions.expand(path)}
                                title="Maximize"
                            >
                                <Maximize2 size={12} />
                            </Button>
                        )}

                        {/* Minimize/Collapse */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                            onClick={onToggleCollapse}
                            title={collapsed ? "Expand" : "Collapse"}
                        >
                            <Minus size={12} />
                        </Button>

                        {/* Remove/Close */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => {
                                if (paneId) {
                                    closePaneWithCleanup(paneId);
                                } else {
                                    mosaicActions.remove(path);
                                }
                            }}
                            title="Close"
                        >
                            <X size={12} />
                        </Button>
                    </div>
                </div>
            )}
        </MosaicContext.Consumer>
    );
}

// Helper to get node at path (simplified)
function getNodeAtPath(root: MosaicNode<any> | null, path: MosaicBranch[]): MosaicNode<any> | null {
    let current = root;
    for (const branch of path) {
        if (!current || typeof current !== 'object') return null;
        current = branch === 'first' ? current.first : current.second;
    }
    return current;
}
