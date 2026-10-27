import { create } from 'zustand';
import { NO_REFRAME, type Reframe } from '../lib/reframe';

/** The framing being edited in reframe mode, shared by the view and its toolbar. */
interface ReframeState {
  value: Reframe;
  set: (value: Reframe | ((v: Reframe) => Reframe)) => void;
  reset: () => void;
}

export const useReframe = create<ReframeState>((set, get) => ({
  value: NO_REFRAME,
  set: (value) => set({ value: typeof value === 'function' ? value(get().value) : value }),
  reset: () => set({ value: NO_REFRAME }),
}));
