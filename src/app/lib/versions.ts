/**
 * A thumbnail is an original image (a generation or an import) and every
 * version derived from it through `parentId`. The project strip shows one tile
 * per thumbnail; the versions panel shows the tree of the selected one.
 */

interface Node {
  id: string;
  parentId?: string;
  createdAt: number;
}

/** The original image a version comes from (itself when it has no known parent). */
export function rootOf<T extends Node>(items: T[], id: string): T | undefined {
  return rootIn(new Map(items.map((g) => [g.id, g])), id);
}

function rootIn<T extends Node>(byId: Map<string, T>, id: string): T | undefined {
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current;
}

/** Every version of the thumbnail rooted at `rootId`, depth-first (each branch after its parent), oldest first. */
export function versionTree<T extends Node>(items: T[], rootId: string): Array<{ item: T; depth: number }> {
  const children = new Map<string, T[]>();
  for (const g of items) {
    if (!g.parentId) continue;
    const list = children.get(g.parentId) ?? [];
    list.push(g);
    children.set(g.parentId, list);
  }
  const root = items.find((g) => g.id === rootId);
  const out: Array<{ item: T; depth: number }> = [];
  const walk = (node: T, depth: number) => {
    out.push({ item: node, depth });
    for (const child of (children.get(node.id) ?? []).sort((a, b) => a.createdAt - b.createdAt)) walk(child, depth + 1);
  };
  if (root) walk(root, 0);
  return out;
}

export interface Thumbnail<T> {
  root: T;
  /** Most recent version (the one a tile opens). */
  latest: T;
  versions: T[];
}

/** One entry per original image, most recently worked on first. */
export function thumbnails<T extends Node>(items: T[]): Array<Thumbnail<T>> {
  const byId = new Map(items.map((g) => [g.id, g]));
  const groups = new Map<string, T[]>();
  for (const g of items) {
    const root = rootIn(byId, g.id) ?? g;
    const list = groups.get(root.id) ?? [];
    list.push(g);
    groups.set(root.id, list);
  }
  return [...groups.entries()]
    .map(([rootId, versions]) => {
      const latest = versions.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      return { root: byId.get(rootId)!, latest, versions };
    })
    .sort((a, b) => b.latest.createdAt - a.latest.createdAt);
}
