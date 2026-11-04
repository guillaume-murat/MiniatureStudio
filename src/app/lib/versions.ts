/**
 * A thumbnail is an original image and its line of versions, each linked to the
 * one before through `parentId`. The project strip shows one tile per thumbnail;
 * the history shows the versions of the selected one.
 */

import type { Generation, GenerationAction, GenerationKind, GenerationParams } from './types';

/** What names a version in the history: its tool, or else how it came to exist. */
export type VersionStep = GenerationKind | GenerationAction;

interface Node {
  id: string;
  parentId?: string;
  createdAt: number;
}

/** The original image a version comes from. */
export function rootOf<T extends Node>(items: T[], id: string): T | undefined {
  return rootIn(new Map(items.map((g) => [g.id, g])), id);
}

function rootIn<T extends Node>(byId: Map<string, T>, id: string): T | undefined {
  let current = byId.get(id);
  while (current?.parentId) current = byId.get(current.parentId);
  return current;
}

/** The thumbnail of a version, from its original to its latest version. */
export function historyOf<T extends Node>(items: T[], id: string): T[] {
  const root = rootOf(items, id);
  if (!root) return [];
  const next = new Map(items.flatMap((g) => (g.parentId ? [[g.parentId, g] as const] : [])));
  const history = [root];
  for (let g = next.get(root.id); g; g = next.get(g.id)) history.push(g);
  return history;
}

/** A version followed by another: it can be shown, not edited. */
export function isOlderVersion<T extends Node>(items: T[], id: string): boolean {
  return items.some((g) => g.parentId === id);
}

/** What a backup adds: only thumbnails not here yet, as merging into one could fork its line of versions. */
export function thumbnailsToImport<T extends Node>(here: T[], backup: T[]): T[] {
  const known = new Set(here.map((g) => g.id));
  return backup.filter((g) => !known.has(rootOf(backup, g.id)?.id ?? g.id));
}

/** What going back to a version takes away. */
export function versionsAfter<T extends Node>(items: T[], id: string): T[] {
  const history = historyOf(items, id);
  return history.slice(history.findIndex((g) => g.id === id) + 1);
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

/** The history as its lines. */
export function historyRows<T extends Node & Pick<Generation, 'kind' | 'action'>>(history: T[], selectedId: string): Array<HistoryRow<T>> {
  const groupable = (g: T) => !!g.parentId && !NEVER_GROUPED.has(versionStep(g));
  const rows: Array<HistoryRow<T>> = [];
  for (let i = 0; i < history.length; ) {
    let end = i + 1;
    if (groupable(history[i])) while (end < history.length && groupable(history[end]) && versionStep(history[end]) === versionStep(history[i])) end++;
    const versions = history.slice(i, end);
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
    const root = rootIn(byId, g.id);
    if (!root) continue;
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
