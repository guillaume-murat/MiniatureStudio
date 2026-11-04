import { describe, expect, it } from 'vitest';
import { historyOf, historyRows, isOlderVersion, newGeneration, rootOf, thumbnails, thumbnailsToImport, versionsAfter } from '../versions';
import type { Generation } from '../types';

// a ─ b ─ c ─ d        x (another thumbnail)
const items = [
  { id: 'a', createdAt: 1 },
  { id: 'b', parentId: 'a', createdAt: 2 },
  { id: 'c', parentId: 'b', createdAt: 3 },
  { id: 'x', createdAt: 4 },
  { id: 'd', parentId: 'c', createdAt: 5 },
];

describe('versions', () => {
  it('finds the original of any version', () => {
    expect(rootOf(items, 'd')?.id).toBe('a');
    expect(rootOf(items, 'a')?.id).toBe('a');
  });

  it('groups versions per thumbnail, most recently worked on first', () => {
    const list = thumbnails(items);
    expect(list.map((t) => [t.root.id, t.latest.id, t.versions.length])).toEqual([
      ['a', 'd', 4],
      ['x', 'x', 1],
    ]);
  });
});

describe('a thumbnail’s history', () => {
  // a ─ b ─ c ─ d        x (another thumbnail)
  const line = [
    { id: 'a', createdAt: 1 },
    { id: 'b', parentId: 'a', createdAt: 2 },
    { id: 'x', createdAt: 3 },
    { id: 'c', parentId: 'b', createdAt: 4 },
    { id: 'd', parentId: 'c', createdAt: 5 },
  ];

  it('runs from the original to the latest version, from any of them', () => {
    for (const id of ['a', 'c', 'd']) expect(historyOf(line, id).map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(historyOf(line, 'x').map((g) => g.id)).toEqual(['x']);
    expect(historyOf(line, 'gone')).toEqual([]);
  });

  it('tells an older version from the latest one', () => {
    expect(isOlderVersion(line, 'a')).toBe(true);
    expect(isOlderVersion(line, 'c')).toBe(true);
    expect(isOlderVersion(line, 'd')).toBe(false);
    expect(isOlderVersion(line, 'x')).toBe(false);
  });

  it('finds the versions a revert takes away', () => {
    expect(versionsAfter(line, 'b').map((g) => g.id)).toEqual(['c', 'd']);
    expect(versionsAfter(line, 'a').map((g) => g.id)).toEqual(['b', 'c', 'd']);
    expect(versionsAfter(line, 'd')).toEqual([]);
    expect(versionsAfter(line, 'x')).toEqual([]);
  });
});

describe('thumbnailsToImport', () => {
  const backup = [
    { id: 'a', createdAt: 1 },
    { id: 'b', parentId: 'a', createdAt: 2 },
    { id: 'y', createdAt: 3 },
    { id: 'z', parentId: 'y', createdAt: 4 },
  ];

  it('takes every thumbnail the device doesn’t hold', () => {
    expect(thumbnailsToImport([], backup).map((g) => g.id)).toEqual(['a', 'b', 'y', 'z']);
  });

  it('leaves a thumbnail already here as it is, or its line of versions would fork', () => {
    // Reverted to a, then edited to c: bringing b back would give a two next versions.
    const here = [{ id: 'a', createdAt: 1 }, { id: 'c', parentId: 'a', createdAt: 5 }];
    expect(thumbnailsToImport(here, backup).map((g) => g.id)).toEqual(['y', 'z']);
  });
});

describe('historyRows', () => {
  type Step = { kind?: Generation['kind']; action?: Generation['action'] };
  /** A straight history from steps. */
  const line = (...steps: Step[]) =>
    steps.map((step, i) => ({ id: `v${i}`, createdAt: i, kind: 'text' as const, ...step, ...(i ? { parentId: `v${i - 1}` } : {}) }));
  const arrow = { action: 'arrow' } as const;
  const text = { kind: 'text' } as const;
  const edit = { kind: 'edit' } as const;
  const shape = (rows: ReturnType<typeof historyRows<ReturnType<typeof line>[number]>>) =>
    rows.map((r) => (r.group ? `[${r.versions.map((v) => v.id).join(' ')}]` : r.versions[0].id)).join(' ');
  const rows = (list: ReturnType<typeof line>, selected = 'none') => historyRows(list, selected);

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
