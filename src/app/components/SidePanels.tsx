import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { usePanelRef } from 'react-resizable-panels';
import { Button } from './ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useWorkspace } from '../stores/workspace';
import { useSettings } from '../stores/settings';
import { isMakingView, panelOpen, panelUsable, type SidePanel } from '../lib/panels';
import { useUI } from '../stores/ui';
import { useT, type TKey } from '../i18n';
import { cn } from '../lib/utils';

/** Width of a folded panel: a rail with the button that opens it again. */
const RAIL = 44;
/** How long a fold or unfold slides. */
const SLIDE_MS = 300;

const LABELS: Record<SidePanel, { open: TKey; close: TKey; unused: TKey }> = {
  brief: { open: 'panels.openBrief', close: 'panels.closeBrief', unused: 'brief.otherView' },
  history: { open: 'panels.openHistory', close: 'panels.closeHistory', unused: 'iterate.otherView' },
};

/**
 * The studio's three columns: the brief on the left, the canvas, the history on
 * the right. Each side panel folds to a rail, by the user or by itself in the
 * views where it does nothing (lib/panels.ts), sliding either way.
 */
export function SidePanels({ brief, center, history }: { brief: ReactNode; center: ReactNode; history: ReactNode }) {
  const view = useWorkspace((s) => s.view);
  const closed = useSettings((s) => s.closedPanels);
  const set = useSettings((s) => s.set);
  const refs = { brief: usePanelRef(), history: usePanelRef() };
  const open = { brief: panelOpen('brief', view, closed), history: panelOpen('history', view, closed) };
  // Only while folding or unfolding: a drag of the handle follows the pointer.
  const [sliding, setSliding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Its width before folding, to unfold to it (the library's own memory came back at the minimum).
  const widths = useRef<Record<SidePanel, number>>({ brief: 340, history: 340 });

  useEffect(() => {
    let moved = false;
    for (const side of ['brief', 'history'] as const) {
      const panel = refs[side].current;
      if (!panel || panel.isCollapsed() === !open[side]) continue;
      moved = true;
      if (open[side]) {
        panel.expand();
        // Then back to its width before folding, in the same slide.
        const width = widths.current[side];
        requestAnimationFrame(() => refs[side].current?.resize(width));
      }
      else {
        widths.current[side] = Math.max(290, panel.getSize().inPixels);
        panel.collapse();
      }
    }
    if (!moved) return;
    setSliding(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSliding(false), SLIDE_MS + 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open.brief, open.history]);

  // Asked for the provider and key fields: the brief panel opens, in a view where it is used.
  const keySetup = useUI((s) => s.keySetup);
  useEffect(() => {
    if (!keySetup) return;
    if (!isMakingView(useWorkspace.getState().view)) useWorkspace.getState().setView('image');
    if (useSettings.getState().closedPanels.brief) set({ closedPanels: { ...useSettings.getState().closedPanels, brief: false } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySetup]);

  const toggle = (side: SidePanel) => set({ closedPanels: { ...closed, [side]: open[side] } });

  // Dragged shut or open by its handle, where it can be used: remembered as the user's choice.
  const onResize = (side: SidePanel) => () => {
    const panel = refs[side].current;
    if (sliding || !panel || !panelUsable(side, useWorkspace.getState().view)) return;
    const folded = panel.isCollapsed();
    const current = useSettings.getState().closedPanels;
    if (folded !== current[side]) set({ closedPanels: { ...current, [side]: folded } });
  };

  const panel = (side: SidePanel, content: ReactNode) => (
    <ResizablePanel
      panelRef={refs[side]}
      collapsible
      collapsedSize={RAIL}
      defaultSize={open[side] ? 340 : RAIL}
      minSize={290}
      maxSize={500}
      onResize={onResize(side)}
      className="relative bg-sidebar"
    >
      {open[side] ? (
        <>
          {content}
          <FoldButton side={side} onClick={() => toggle(side)} />
        </>
      ) : (
        <Rail side={side} usable={panelUsable(side, view)} onClick={() => toggle(side)} />
      )}
    </ResizablePanel>
  );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className={cn('min-h-0 flex-1', sliding && '[&>[data-panel]]:transition-[flex-grow] [&>[data-panel]]:duration-300 [&>[data-panel]]:ease-out motion-reduce:[&>[data-panel]]:transition-none')}
    >
      {panel('brief', brief)}
      <ResizableHandle />
      <ResizablePanel minSize={420}>{center}</ResizablePanel>
      <ResizableHandle />
      {panel('history', history)}
    </ResizablePanelGroup>
  );
}

/** In the panel's top corner on the canvas side. */
function FoldButton({ side, onClick }: { side: SidePanel; onClick: () => void }) {
  const t = useT();
  const Icon = side === 'brief' ? PanelLeftClose : PanelRightClose;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10" onClick={onClick} aria-label={t(LABELS[side].close)}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t(LABELS[side].close)}</TooltipContent>
    </Tooltip>
  );
}

/** A folded panel. Where it does nothing, its button is off and says why. */
function Rail({ side, usable, onClick }: { side: SidePanel; usable: boolean; onClick: () => void }) {
  const t = useT();
  const Icon = side === 'brief' ? PanelLeftOpen : PanelRightOpen;
  const label = t(usable ? LABELS[side].open : LABELS[side].unused);
  return (
    <div className="flex h-full justify-center pt-3">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A span keeps the tooltip on a disabled button. */}
          <span tabIndex={usable ? -1 : 0}>
            <Button variant="ghost" size="icon-sm" disabled={!usable} onClick={onClick} aria-label={label}>
              <Icon />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side={side === 'brief' ? 'right' : 'left'}>{label}</TooltipContent>
      </Tooltip>
    </div>
  );
}
