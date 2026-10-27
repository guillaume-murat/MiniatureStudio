import { create } from 'zustand';
import { NO_REFRAME, type Point, type Reframe } from '../lib/reframe';

/** What reframe mode moves: the whole image, or a freehand zone drawn on it. */
export type ReframeTarget = 'image' | 'zone';

/** The framing being edited in reframe mode, shared by the view and its toolbar. */
interface ReframeState {
  value: Reframe;
  target: ReframeTarget;
  /** The freehand zone, in fractions of the image (null until drawn). */
  zone: Point[] | null;
  set: (value: Reframe | ((v: Reframe) => Reframe)) => void;
  setTarget: (target: ReframeTarget) => void;
  setZone: (zone: Point[] | null) => void;
  reset: () => void;
}

export const useReframe = create<ReframeState>((set, get) => ({
  value: NO_REFRAME,
  target: 'image',
  zone: null,
  set: (value) => set({ value: typeof value === 'function' ? value(get().value) : value }),
  setTarget: (target) => set({ target, zone: null, value: NO_REFRAME }),
  // A new zone starts from where it was drawn.
  setZone: (zone) => set({ zone, value: NO_REFRAME }),
  reset: () => set({ value: NO_REFRAME, target: 'image', zone: null }),
}));
