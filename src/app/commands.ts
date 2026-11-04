/**
 * The studio's single-letter commands: the keyboard shortcuts (App.tsx), the
 * command palette and the edit bar's tools all come from this list, so a
 * letter, a label or a condition can't differ between them.
 */
import { ArrowUpRight, Crop, Paintbrush, PanelsTopLeft, ScanLine, Tv, Type, type LucideIcon } from 'lucide-react';
import { useWorkspace, viewingOlder, type Tool } from './stores/workspace';
import type { TKey } from './i18n';

type Workspace = ReturnType<typeof useWorkspace.getState>;

export interface Command {
  id: string;
  /** Its letter, lowercase (shown uppercase). One letter per command. */
  key: string;
  icon: LucideIcon;
  /** Views and overlays, or the image tools (also listed in the edit bar). */
  group: 'view' | 'tool';
  label: (ws: Workspace) => TKey;
  /** An image tool's name in the edit bar. */
  shortLabel?: TKey;
  /** Works on the selected image: unavailable without one. */
  needsImage: boolean;
  /** Shown as pressed while on. */
  active?: (ws: Workspace) => boolean;
  run: (ws: Workspace) => void;
}

const toggleView = (ws: Workspace, view: 'feed' | 'channel') => ws.setView(ws.view === view ? 'image' : view);
const toggleTool = (ws: Workspace, tool: Tool) => ws.setTool(ws.tool === tool ? null : tool);

export const COMMANDS: Command[] = [
  { id: 'feed', key: 'p', icon: Tv, group: 'view', label: () => 'commands.feed', needsImage: true, run: (ws) => toggleView(ws, 'feed') },
  { id: 'channel', key: 'c', icon: PanelsTopLeft, group: 'view', label: () => 'canvas.viewChannel', needsImage: false, run: (ws) => toggleView(ws, 'channel') },
  {
    id: 'safeZones',
    key: 'z',
    icon: ScanLine,
    group: 'view',
    label: () => 'commands.safeZones',
    needsImage: false,
    active: (ws) => ws.safeZones,
    run: (ws) => ws.setSafeZones(!ws.safeZones),
  },
  {
    id: 'text',
    key: 't',
    icon: Type,
    group: 'tool',
    label: () => 'canvas.textTool',
    shortLabel: 'tools.text',
    needsImage: true,
    active: (ws) => ws.tool === 'text',
    run: (ws) => toggleTool(ws, 'text'),
  },
  {
    id: 'arrow',
    key: 'a',
    icon: ArrowUpRight,
    group: 'tool',
    label: () => 'arrow.addTool',
    shortLabel: 'tools.arrow',
    needsImage: true,
    active: (ws) => ws.tool === 'arrow',
    run: (ws) => toggleTool(ws, 'arrow'),
  },
  {
    id: 'mask',
    key: 'm',
    icon: Paintbrush,
    group: 'tool',
    label: () => 'canvas.maskTool',
    shortLabel: 'tools.mask',
    needsImage: true,
    active: (ws) => ws.tool === 'mask',
    run: (ws) => toggleTool(ws, 'mask'),
  },
  {
    id: 'reframe',
    key: 'r',
    icon: Crop,
    group: 'tool',
    label: () => 'canvas.reframeTool',
    shortLabel: 'tools.reframe',
    needsImage: true,
    active: (ws) => ws.tool === 'reframe',
    run: (ws) => toggleTool(ws, 'reframe'),
  },
];

export function isAvailable(command: Command, ws: Workspace): boolean {
  // Image tools make versions: not from an older one.
  if (command.group === 'tool' && viewingOlder(ws)) return false;
  return !command.needsImage || !!ws.selectedId;
}

/** Runs the command bound to `key` (a letter, any case); false when there is none or it is unavailable. */
export function runShortcut(key: string): boolean {
  const ws = useWorkspace.getState();
  const command = COMMANDS.find((c) => c.key === key.toLowerCase());
  if (!command || !isAvailable(command, ws)) return false;
  command.run(ws);
  return true;
}
