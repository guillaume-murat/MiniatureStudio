/**
 * A thumbnail is an original image (a generation or an import) and every
 * version derived from it through `parentId`. The project strip shows one tile
 * per thumbnail; the versions panel shows the tree of the selected one.
 */

import type { Generation, GenerationAction, GenerationKind, GenerationParams } from './types';

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

/**
 * The connecting lines of a `versionTree` row, to draw it as a tree: `through[k]`
 * says whether the line of the ancestor at depth k carries on past this row (a
 * later child of it is still to come); `hasChildren`, whether one starts under it.
 * The last entry of `through` is the row's own link to its parent.
 */
export function treeLines(tree: Array<{ depth: number }>): Array<{ through: boolean[]; hasChildren: boolean }> {
  return tree.map(({ depth }, i) => {
    const through = Array.from({ length: depth }, (_, k) => {
      for (let j = i + 1; j < tree.length; j++) {
        if (tree[j].depth <= k) return false;
        if (tree[j].depth === k + 1) return true;
      }
      return false;
    });
    return { through, hasChildren: (tree[i + 1]?.depth ?? 0) > depth };
  });
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

/** What a new version is made of; the rest comes from its parent. */
export interface VersionInput {
  /** The version it derives from: gives its parent link, project, video title and params unless they are set. */
  parent?: Generation;
  projectId?: string;
  kind: GenerationKind;
  action?: GenerationAction;
  prompt: string;
  fullPrompt?: string;
  params?: GenerationParams;
  videoTitle?: string;
  blob: Blob;
  width: number;
  height: number;
}

/** A new version (or an original, without a parent). */
export function newGeneration(input: VersionInput, id: string, createdAt: number): Generation {
  const { parent } = input;
  const projectId = input.projectId ?? parent?.projectId;
  const params = input.params ?? parent?.params;
  if (!projectId || !params) throw new Error('A version needs a project and params, given or from its parent');
  const videoTitle = input.videoTitle ?? parent?.videoTitle;
  return {
    id,
    projectId,
    ...(parent ? { parentId: parent.id } : {}),
    kind: input.kind,
    ...(input.action ? { action: input.action } : {}),
    prompt: input.prompt,
    fullPrompt: input.fullPrompt ?? '',
    ...(videoTitle ? { videoTitle } : {}),
    params,
    blob: input.blob,
    width: input.width,
    height: input.height,
    createdAt,
  };
}
