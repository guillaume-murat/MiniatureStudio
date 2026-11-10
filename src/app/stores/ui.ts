import { create } from 'zustand';

type DialogId = 'settings' | 'personas' | 'newPersona' | 'styles' | 'assistant' | 'commands' | 'agent' | 'newProject' | null;

interface UIState {
  dialog: DialogId;
  /** Bumped to bring the provider and key fields into view (advanced options, left panel). */
  keySetup: number;
  showKeySetup: () => void;
  open: (dialog: Exclude<DialogId, null>) => void;
  close: () => void;
}

export const useUI = create<UIState>((set) => ({
  dialog: null,
  keySetup: 0,
  showKeySetup: () => set((s) => ({ dialog: null, keySetup: s.keySetup + 1 })),
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));
