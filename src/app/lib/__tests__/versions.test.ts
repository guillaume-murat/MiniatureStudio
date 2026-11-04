import { describe, expect, it } from 'vitest';
import { displayedBranch, forkBranches, historyRows, newGeneration, rootOf, selectionAfterRemoval, thumbnails, versionCount, versionsRemovedWith } from '../versions';
import type { Generation } from '../types';

// a ─ b ─ d        x (another thumbnail)
//   └ c
const items = [
  { id: 'a', createdAt: 1 },
  { id: 'b', parentId: 'a', createdAt: 2 },
  { id: 'c', parentId: 'a', createdAt: 3 },
  { id: 'x', createdAt: 4 },
  { id: 'd', parentId: 'b', createdAt: 5 },
];

describe('versions', () => {
  it('finds the original of any version', () => {
    expect(rootOf(items, 'd')?.id).toBe('a');
    expect(rootOf(items, 'a')?.id).toBe('a');
    // A parent that was deleted makes the version an original.
    expect(rootOf([{ id: 'y', parentId: 'gone', createdAt: 1 }], 'y')?.id).toBe('y');
  });

  it('groups versions per thumbnail, most recently worked on first', () => {
    const list = thumbnails(items);
    expect(list.map((t) => [t.root.id, t.latest.id, t.versions.length])).toEqual([
      ['a', 'd', 4],
      ['x', 'x', 1],
    ]);
  });
});

describe('displayedBranch', () => {
  const ids = (selected: string, kept?: string[]) => displayedBranch(items, selected, kept).map((g) => g.id);

  it('runs from the original through the selected version, to the end of its branch', () => {
    expect(ids('d')).toEqual(['a', 'b', 'd']);
    expect(ids('b')).toEqual(['a', 'b', 'd']);
    expect(ids('c')).toEqual(['a', 'c']);
    expect(ids('x')).toEqual(['x']);
  });

  it('follows the most recent next version at each fork after the selected one', () => {
    // b came before c, whatever the order of the list.
    expect(ids('a')).toEqual(['a', 'c']);
    expect(displayedBranch([...items].reverse(), 'a').map((g) => g.id)).toEqual(['a', 'c']);
  });

  it('stays on the kept branch while the selected version belongs to it', () => {
    expect(ids('a', ['a', 'b', 'd'])).toEqual(['a', 'b', 'd']);
    expect(ids('b', ['a', 'b', 'd'])).toEqual(['a', 'b', 'd']);
  });

  it('leaves the kept branch when the selected version is out of it', () => {
    expect(ids('c', ['a', 'b', 'd'])).toEqual(['a', 'c']);
    expect(ids('x', ['a', 'b', 'd'])).toEqual(['x']);
  });

  it('stays on what remains of the kept branch when its end was removed', () => {
    // b's branch lost its last version: a is still on it, so c's branch doesn't take over.
    expect(ids('a', ['a', 'b', 'gone'])).toEqual(['a', 'b', 'd']);
    expect(ids('b', ['a', 'b', 'd', 'gone'])).toEqual(['a', 'b', 'd']);
  });

  it('ignores a kept branch entirely gone, and an unknown selection', () => {
    expect(ids('a', ['gone'])).toEqual(['a', 'c']);
    expect(ids('gone')).toEqual([]);
  });

  it('shows a new branch made from an old version', () => {
    const more = [...items, { id: 'e', parentId: 'b', createdAt: 6 }];
    expect(displayedBranch(more, 'e', ['a', 'b', 'd']).map((g) => g.id)).toEqual(['a', 'b', 'e']);
  });
});

describe('forkBranches', () => {
  // a ─ b ─ d ─ f
  //   │   └ e
  //   └ c
  const tree = [...items, { id: 'e', parentId: 'b', createdAt: 6 }, { id: 'f', parentId: 'd', createdAt: 7 }];
  const summary = (id: string) => forkBranches(tree, id).map((b) => [b.first.id, b.last.id, b.count]);

  it('gives a fork one entry per next version, oldest first', () => {
    expect(summary('b')).toEqual([
      ['d', 'f', 2],
      ['e', 'e', 1],
    ]);
  });

  it('counts every version of a branch and ends it on its most recent path', () => {
    expect(summary('a')).toEqual([
      ['b', 'e', 4],
      ['c', 'c', 1],
    ]);
  });

  it('gives nothing for a version that is not a fork', () => {
    expect(summary('d')).toEqual([]);
    expect(summary('f')).toEqual([]);
    expect(summary('gone')).toEqual([]);
  });
});

describe('versionCount', () => {
  it('counts a thumbnail’s versions from any of them', () => {
    expect(versionCount(items, 'd')).toBe(4);
    expect(versionCount(items, 'a')).toBe(4);
    expect(versionCount(items, 'x')).toBe(1);
    expect(versionCount(items, 'gone')).toBe(0);
  });
});

describe('removing a version', () => {
  it('takes every version made from it, and no other', () => {
    expect(versionsRemovedWith(items, 'b').map((g) => g.id).sort()).toEqual(['b', 'd']);
    expect(versionsRemovedWith(items, 'd').map((g) => g.id)).toEqual(['d']);
    expect(versionsRemovedWith(items, 'gone')).toEqual([]);
  });

  it('takes the whole thumbnail with its original', () => {
    expect(versionsRemovedWith(items, 'a').map((g) => g.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the selection when it survives', () => {
    expect(selectionAfterRemoval(items, 'b', 'c')).toBe('c');
    expect(selectionAfterRemoval(items, 'b', 'x')).toBe('x');
  });

  it('moves to the version the removed one was made from', () => {
    expect(selectionAfterRemoval(items, 'b', 'd')).toBe('a');
    expect(selectionAfterRemoval(items, 'b', 'b')).toBe('a');
    expect(selectionAfterRemoval(items, 'd', 'd')).toBe('b');
  });

  it('moves to what remains when the whole thumbnail goes', () => {
    expect(selectionAfterRemoval(items, 'a', 'd')).toBe('x');
    expect(selectionAfterRemoval(items, 'x', 'x')).toBe('a');
    expect(selectionAfterRemoval([{ id: 'x', createdAt: 1 }], 'x', 'x')).toBeNull();
  });
});

describe('historyRows', () => {
  type Step = { kind?: Generation['kind']; action?: Generation['action'] };
  /** A straight branch from steps. */
  const line = (...steps: Step[]) =>
    steps.map((step, i) => ({ id: `v${i}`, createdAt: i, kind: 'text' as const, ...step, ...(i ? { parentId: `v${i - 1}` } : {}) }));
  const arrow = { action: 'arrow' } as const;
  const text = { kind: 'text' } as const;
  const edit = { kind: 'edit' } as const;
  const shape = (rows: ReturnType<typeof historyRows<ReturnType<typeof line>[number]>>) =>
    rows.map((r) => (r.group ? `[${r.versions.map((v) => v.id).join(' ')}]` : r.versions[0].id)).join(' ');
  const rows = (list: ReturnType<typeof line>, selected = 'none') => historyRows(list, list, selected);

  it('joins two or more consecutive steps of the same tool', () => {
    expect(shape(rows(line({ kind: 'generate' }, arrow, arrow, arrow, text)))).toBe('v0 [v1 v2 v3] v4');
    expect(shape(rows(line({ kind: 'generate' }, text, arrow, text)))).toBe('v0 v1 v2 v3');
  });

  it('names a group after its tool and shows its last step', () => {
    const [, group] = rows(line({ kind: 'generate' }, arrow, arrow));
    expect(group.group).toBe('arrow');
    expect(group.versions.at(-1)?.id).toBe('v2');
  });

  it('never joins the original or the edits described by an instruction', () => {
    expect(shape(rows(line({ kind: 'generate' }, edit, edit, { kind: 'region' }, { kind: 'region' })))).toBe('v0 v1 v2 v3 v4');
    // An original imported, then text: the first step stays alone even with the same kind.
    expect(shape(rows(line(text, text, text)))).toBe('v0 [v1 v2]');
  });

  it('treats a version whose parent is gone as an original', () => {
    const orphans = [
      { id: 'o', parentId: 'gone', createdAt: 1, kind: 'text' as const, action: 'arrow' as const },
      { id: 'p', parentId: 'o', createdAt: 2, kind: 'text' as const, action: 'arrow' as const },
      { id: 'q', parentId: 'p', createdAt: 3, kind: 'text' as const, action: 'arrow' as const },
    ];
    expect(shape(historyRows(orphans, orphans, 'none'))).toBe('o [p q]');
  });

  it('keeps a fork on its own line, ending the group before it', () => {
    const list = line({ kind: 'generate' }, arrow, arrow, arrow, arrow);
    const all = [...list, { id: 'other', parentId: 'v3', createdAt: 9, kind: 'text' as const }];
    expect(shape(historyRows(all, list, 'none'))).toBe('v0 [v1 v2] v3 v4');
  });

  it('holds a group open when the selected version is one of its middle steps', () => {
    const list = line({ kind: 'generate' }, arrow, arrow, arrow);
    expect(rows(list, 'v1')[1].holdsSelection).toBe(true);
    expect(rows(list, 'v2')[1].holdsSelection).toBe(true);
    expect(rows(list, 'v3')[1].holdsSelection).toBe(false);
    expect(rows(list, 'v0')[1].holdsSelection).toBe(false);
  });
});

describe('newGeneration', () => {
  const blob = new Blob(['x']);
  const params = {
    provider: 'gemini',
    model: 'nano-banana-pro',
    aspectRatio: '16:9',
    resolution: '1K',
    format: 'png',
    safety: 'default',
  } as unknown as Generation['params'];
  const parent: Generation = {
    id: 'p',
    projectId: 'pr',
    kind: 'generate',
    prompt: 'brief',
    fullPrompt: 'full',
    videoTitle: 'Title',
    params,
    blob,
    width: 1,
    height: 1,
    createdAt: 1,
    favorite: true,
  };

  it('inherits the project, video title and params of its parent', () => {
    const g = newGeneration({ parent, kind: 'region', action: 'smooth', prompt: 'smoothed', blob, width: 2, height: 3 }, 'g', 9);
    expect(g).toEqual({
      id: 'g',
      projectId: 'pr',
      parentId: 'p',
      kind: 'region',
      action: 'smooth',
      prompt: 'smoothed',
      fullPrompt: '',
      videoTitle: 'Title',
      params,
      blob,
      width: 2,
      height: 3,
      createdAt: 9,
    });
  });

  it('lets given fields win over the parent', () => {
    const other = { ...params, resolution: '2K' } as Generation['params'];
    const g = newGeneration({ parent, kind: 'upscale', prompt: 'up', params: other, videoTitle: 'New', blob, width: 1, height: 1 }, 'g', 9);
    expect(g.params).toBe(other);
    expect(g.videoTitle).toBe('New');
    expect(g).not.toHaveProperty('favorite');
  });

  it('makes an original without a parent link', () => {
    const g = newGeneration({ projectId: 'pr', kind: 'import', prompt: 'blank', params, blob, width: 1, height: 1 }, 'g', 9);
    expect(g).not.toHaveProperty('parentId');
    expect(g).not.toHaveProperty('videoTitle');
    expect(() => newGeneration({ kind: 'import', prompt: 'x', blob, width: 1, height: 1 }, 'g', 9)).toThrow();
  });
});
