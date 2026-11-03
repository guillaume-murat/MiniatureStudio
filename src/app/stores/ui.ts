import { create } from 'zustand';

type DialogId = 'settings' | 'personas' | 'newPersona' | 'styles' | 'assistant' | 'commands' | 'agent' | 'prompt' | 'newProject' | null;

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
