import { create } from 'zustand';
import { newArrowBlock, newTextBlock, type ArrowBlock, type LayerBlock, type TextBlock } from '../lib/textBlocks';

type Patch = Partial<Omit<TextBlock, 'id' | 'kind'>> | Partial<Omit<ArrowBlock, 'id' | 'kind'>>;

/** Text blocks and arrows being placed over the selected image, before they are applied. */
interface TextState {
  blocks: LayerBlock[];
  selectedId: string | null;
  add: (font: string, partial?: Partial<TextBlock>) => void;
  addArrow: (partial?: Partial<ArrowBlock>) => void;
  update: (id: string, patch: Patch) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  clear: () => void;
  /** Reopens the blocks saved on a text version. */
  load: (blocks: LayerBlock[]) => void;
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
  addArrow: (partial) => {
    const offset = (get().blocks.length % 5) * 0.06;
    const block = newArrowBlock({ ...partial });
    const moved = { ...block, x1: block.x1 + offset, x2: block.x2 + offset, y1: block.y1 + offset, y2: block.y2 + offset };
    set({ blocks: [...get().blocks, moved], selectedId: moved.id });
  },
  update: (id, patch) => set({ blocks: get().blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as LayerBlock) : b)) }),
  remove: (id) => set({ blocks: get().blocks.filter((b) => b.id !== id), selectedId: get().selectedId === id ? null : get().selectedId }),
  select: (id) => set({ selectedId: id }),
  clear: () => set({ blocks: [], selectedId: null }),
  load: (blocks) => set({ blocks: blocks.map((b) => ({ ...b })), selectedId: blocks[0]?.id ?? null }),
}));
