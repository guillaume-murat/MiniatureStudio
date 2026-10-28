import { describe, expect, it } from 'vitest';
import { newGeneration, rootOf, thumbnails, treeLines, versionTree } from '../versions';
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

  it('lists the whole tree, branches after their parent', () => {
    expect(versionTree(items, 'a').map(({ item, depth }) => `${item.id}${depth}`)).toEqual(['a0', 'b1', 'd2', 'c1']);
  });

  it('draws the tree lines', () => {
    // a
    // ├ b        a's line carries on past b and d, down to c
    // │ └ d
    // └ c
    expect(treeLines(versionTree(items, 'a'))).toEqual([
      { through: [], hasChildren: true },
      { through: [true], hasChildren: true },
      { through: [true, false], hasChildren: false },
      { through: [false], hasChildren: false },
    ]);
  });

  it('groups versions per thumbnail, most recently worked on first', () => {
    const list = thumbnails(items);
    expect(list.map((t) => [t.root.id, t.latest.id, t.versions.length])).toEqual([
      ['a', 'd', 4],
      ['x', 'x', 1],
    ]);
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

  it('keeps the text layer', () => {
    const textLayer = { base: blob, blocks: [] };
    expect(newGeneration({ parent, kind: 'text', prompt: 't', blob, width: 1, height: 1, textLayer }, 'g', 9).textLayer).toBe(textLayer);
  });
});
