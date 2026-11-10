/**
 * The side panels: the brief on the left, the history on the right. Each can be
 * folded by the user, and folds by itself in the views where it does nothing.
 */
export type View = 'image' | 'sketch' | 'feed' | 'channel' | 'compare';
export type SidePanel = 'brief' | 'history';
/** The panels the user folded, remembered per device. */
export type ClosedPanels = Record<SidePanel, boolean>;

export const NO_CLOSED_PANELS: ClosedPanels = { brief: false, history: false };

/** The views a thumbnail is made in: the brief panel and generating work there only. */
export function isMakingView(view: View): boolean {
  return view === 'image' || view === 'sketch';
}

export function panelUsable(panel: SidePanel, view: View): boolean {
  return panel === 'brief' ? isMakingView(view) : view === 'image';
}

export function panelOpen(panel: SidePanel, view: View, closed: ClosedPanels): boolean {
  return panelUsable(panel, view) && !closed[panel];
}

export function parseClosedPanels(value: unknown): ClosedPanels {
  const v = (value ?? {}) as Partial<ClosedPanels>;
  return { brief: v.brief === true, history: v.history === true };
}
