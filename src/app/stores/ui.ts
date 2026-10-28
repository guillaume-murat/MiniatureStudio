import { create } from 'zustand';

type DialogId = 'settings' | 'personas' | 'newPersona' | 'assistant' | 'commands' | 'agent' | 'prompt' | 'reframeText' | null;

interface UIState {
  dialog: DialogId;
  open: (dialog: Exclude<DialogId, null>) => void;
  close: () => void;
}

export const useUI = create<UIState>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));
