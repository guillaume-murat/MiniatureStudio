import { create } from 'zustand';
import { newTextBlock, type TextBlock } from '../lib/textBlocks';

/** Text blocks being placed over the selected image, before they are applied. */
interface TextState {
  blocks: TextBlock[];
  selectedId: string | null;
  add: (font: string, partial?: Partial<TextBlock>) => void;
  update: (id: string, patch: Partial<TextBlock>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  clear: () => void;
  /** Reopens the blocks saved on a text version. */
  load: (blocks: TextBlock[]) => void;
}

export const useText = create<TextState>((set, get) => ({
  blocks: [],
  selectedId: null,
  add: (font, partial) => {
    // Stagger new blocks so they don't stack exactly on top of each other.
    const offset = (get().blocks.length % 5) * 0.06;
    const block = newTextBlock(font, { y: 0.5 + offset, ...partial });
    set({ blocks: [...get().blocks, block], selectedId: block.id });
  },
  update: (id, patch) => set({ blocks: get().blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
  remove: (id) => set({ blocks: get().blocks.filter((b) => b.id !== id), selectedId: get().selectedId === id ? null : get().selectedId }),
  select: (id) => set({ selectedId: id }),
  clear: () => set({ blocks: [], selectedId: null }),
  load: (blocks) => set({ blocks: blocks.map((b) => ({ ...b })), selectedId: blocks[0]?.id ?? null }),
}));
