/**
 * A thumbnail is an original image (a generation or an import) and every
 * version derived from it through `parentId`. The project strip shows one tile
 * per thumbnail; the history shows the branch of the selected one.
 */

import type { Generation, GenerationAction, GenerationKind, GenerationParams } from './types';

/** What names a version in the history: its tool, or else how it came to exist. */
export type VersionStep = GenerationKind | GenerationAction;

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

/** Each version's next versions, oldest first. */
function nextVersions<T extends Node>(items: T[]): Map<string, T[]> {
  const next = new Map<string, T[]>();
  for (const g of items) {
    if (!g.parentId) continue;
    const list = next.get(g.parentId) ?? [];
    list.push(g);
    next.set(g.parentId, list);
  }
  for (const list of next.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return next;
}

/** From a version to the end of its branch, taking the most recent next version at each fork. */
function lastOfBranch<T extends Node>(next: Map<string, T[]>, from: T): T {
  let current = from;
  for (let list = next.get(current.id); list?.length; list = next.get(current.id)) current = list[list.length - 1];
  return current;
}

/** The original down to a version, itself included. */
function pathTo<T extends Node>(items: T[], id: string): T[] {
  const byId = new Map(items.map((g) => [g.id, g]));
  const path: T[] = [];
  const seen = new Set<string>();
  for (let current = byId.get(id); current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
    seen.add(current.id);
    path.unshift(current);
  }
  return path;
}

/**
 * The branch the history shows: the original through the selected version, on to the end
 * of its branch. It stays on `keptIds`, the branch shown so far, as long as the selected
 * version belongs to it, so that going back to a fork doesn't switch to another branch.
 * Removing its end leaves what remains of it, as a version's ancestors outlive it.
 */
export function displayedBranch<T extends Node>(items: T[], selectedId: string, keptIds: string[] = []): T[] {
  const next = nextVersions(items);
  const byId = new Map(items.map((g) => [g.id, g]));
  const kept = keptIds.filter((id) => byId.has(id));
  const from = kept.includes(selectedId) ? byId.get(kept[kept.length - 1]) : byId.get(selectedId);
  return from ? pathTo(items, lastOfBranch(next, from).id) : [];
}

export interface Branch<T> {
  /** The version it starts with, right after the fork. */
  first: T;
  /** Where choosing it leads: the end of its most recent path. */
  last: T;
  /** Every version from `first` on, its own forks included. */
  count: number;
}

function descendantCount<T extends Node>(next: Map<string, T[]>, id: string): number {
  return (next.get(id) ?? []).reduce((sum, g) => sum + 1 + descendantCount(next, g.id), 0);
}

/** The branches leaving a version, oldest first: none unless it is a fork. */
export function forkBranches<T extends Node>(items: T[], id: string): Array<Branch<T>> {
  const next = nextVersions(items);
  const list = next.get(id) ?? [];
  if (list.length < 2) return [];
  return list.map((first) => ({ first, last: lastOfBranch(next, first), count: 1 + descendantCount(next, first.id) }));
}

/** How many versions the thumbnail of a version holds. */
export function versionCount<T extends Node>(items: T[], id: string): number {
  const root = rootOf(items, id);
  return root ? 1 + descendantCount(nextVersions(items), root.id) : 0;
}

/** A version and everything made from it: what removing it takes away, so that no version loses its origin. */
export function versionsRemovedWith<T extends Node>(items: T[], id: string): T[] {
  const next = nextVersions(items);
  const collect = (g: T): T[] => [g, ...(next.get(g.id) ?? []).flatMap(collect)];
  const version = items.find((g) => g.id === id);
  return version ? collect(version) : [];
}

/** What is selected once `id` is removed: the selection if it survives, else the version it was made from, else what remains. */
export function selectionAfterRemoval<T extends Node>(items: T[], id: string, selectedId: string | null): string | null {
  const removed = new Set(versionsRemovedWith(items, id).map((g) => g.id));
  if (selectedId && !removed.has(selectedId)) return selectedId;
  const parentId = items.find((g) => g.id === id)?.parentId;
  if (parentId && items.some((g) => g.id === parentId)) return parentId;
  return items.find((g) => !removed.has(g.id))?.id ?? null;
}

/** The steps whose text is their content: each one stays on its own line. */
const NEVER_GROUPED: ReadonlySet<VersionStep> = new Set<VersionStep>(['generate', 'import', 'edit', 'region']);

/** A line of the history: one version, or several consecutive steps of the same tool under `group`. */
export interface HistoryRow<T> {
  group?: VersionStep;
  versions: T[];
  /** The selected version is a middle step: the group has to show it. */
  holdsSelection: boolean;
}

/** The branch as lines of the history. A fork stays on its own line, so that its mark always shows. */
export function historyRows<T extends Node & Pick<Generation, 'kind' | 'action'>>(items: T[], branch: T[], selectedId: string): Array<HistoryRow<T>> {
  const next = nextVersions(items);
  const known = new Set(items.map((g) => g.id));
  // A parent that was removed long ago makes the version an original.
  const groupable = (g: T) => !!g.parentId && known.has(g.parentId) && !NEVER_GROUPED.has(versionStep(g)) && (next.get(g.id)?.length ?? 0) < 2;
  const rows: Array<HistoryRow<T>> = [];
  for (let i = 0; i < branch.length; ) {
    let end = i + 1;
    if (groupable(branch[i])) while (end < branch.length && groupable(branch[end]) && versionStep(branch[end]) === versionStep(branch[i])) end++;
    const versions = branch.slice(i, end);
    rows.push(versions.length > 1
      ? { group: versionStep(versions[0]), versions, holdsSelection: versions.slice(0, -1).some((g) => g.id === selectedId) }
      : { versions, holdsSelection: false });
    i = end;
  }
  return rows;
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

export function versionStep(version: Pick<Generation, 'kind' | 'action'>): VersionStep {
  return version.action ?? version.kind;
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
