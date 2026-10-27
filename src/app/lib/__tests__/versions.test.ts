import { describe, expect, it } from 'vitest';
import { rootOf, thumbnails, versionTree } from '../versions';

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

  it('groups versions per thumbnail, most recently worked on first', () => {
    const list = thumbnails(items);
    expect(list.map((t) => [t.root.id, t.latest.id, t.versions.length])).toEqual([
      ['a', 'd', 4],
      ['x', 'x', 1],
    ]);
  });
});
