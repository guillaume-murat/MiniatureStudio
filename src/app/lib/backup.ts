import { strFromU8, strToU8, unzip, zip, type Unzipped, type Zippable } from 'fflate';
import { getDB, listGenerations, listLibrary, listPersonas, listProjects, listStyles } from './db';
import { extensionFor } from './images';
import { thumbnailsToImport } from './versions';
import { t } from '../i18n';
import type { CustomStyle, Generation, LibraryImage, Persona, Project } from './types';

/**
 * Full local backup as a zip: `backup.json` holds all records with each Blob
 * replaced by a path inside the archive. Also used for the "Test & Compare" export.
 */

const FORMAT = 'nanothumbnail-backup';
/** 2: a thumbnail has one line of versions. Older backups may hold branches. */
const VERSION = 2;

type BlobRef = { $blob: string; type: string };
/** A generation in a backup: its Blob replaced, its links as they were. */
type BackupGeneration = { id: string; parentId?: string; createdAt: number };

interface Manifest {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  projects: Project[];
  generations: BackupGeneration[];
  personas: unknown[];
  styles: CustomStyle[];
  library: unknown[];
}

/** Why a backup can't be imported, if it can't: read before anything is written. */
export function backupProblem(manifest: unknown): 'unknown' | 'old' | null {
  if (!manifest || typeof manifest !== 'object' || (manifest as Manifest).format !== FORMAT) return 'unknown';
  return (manifest as Manifest).version === VERSION ? null : 'old';
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data))));
}
function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => unzip(data, (err, files) => (err ? reject(err) : resolve(files))));
}

/** Deep-replace Blobs with references, collecting the files. */
async function dehydrate(value: unknown, files: Zippable, prefix: string): Promise<unknown> {
  if (value instanceof Blob) {
    const path = `files/${prefix}.${extensionFor(value)}`;
    files[path] = await bytes(value);
    return { $blob: path, type: value.type } satisfies BlobRef;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v, i) => dehydrate(v, files, `${prefix}_${i}`)));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await dehydrate(v, files, `${prefix}_${k}`);
    return out;
  }
  return value;
}

function hydrate(value: unknown, files: Unzipped): unknown {
  if (value && typeof value === 'object' && '$blob' in value) {
    const ref = value as BlobRef;
    const data = files[ref.$blob];
    return data ? new Blob([data as BlobPart], { type: ref.type }) : new Blob([], { type: ref.type });
  }
  if (Array.isArray(value)) return value.map((v) => hydrate(v, files));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hydrate(v, files)]));
  }
  return value;
}

export async function exportBackup(): Promise<Blob> {
  const files: Zippable = {};
  const [projects, generations, personas, styles, library] = await Promise.all([
    listProjects(),
    listGenerations(),
    listPersonas(),
    listStyles(),
    listLibrary(),
  ]);
  const manifest: Manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    // Projects hold Blobs too (references, logo, banner).
    projects: await Promise.all(projects.map((p) => dehydrate(p, files, p.id))) as Project[],
    generations: await Promise.all(generations.map((g) => dehydrate(g, files, g.id))) as BackupGeneration[],
    personas: await Promise.all(personas.map((p) => dehydrate(p, files, p.id))),
    styles,
    library: await Promise.all(library.map((l) => dehydrate(l, files, l.id))),
  };
  files['backup.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return new Blob([(await zipAsync(files)) as BlobPart], { type: 'application/zip' });
}

/** Merges a backup into the current data: records with the same id are overwritten, except thumbnails already here, left as they are. */
export async function importBackup(file: Blob): Promise<number> {
  const files = await unzipAsync(await bytes(file));
  const raw = files['backup.json'];
  if (!raw) throw new Error(t('settings.backupUnknown'));
  const manifest = JSON.parse(strFromU8(raw)) as Manifest;
  const problem = backupProblem(manifest);
  if (problem) throw new Error(t(problem === 'old' ? 'settings.backupOld' : 'settings.backupUnknown'));

  const here = await listGenerations();
  const db = await getDB();
  const tx = db.transaction(['projects', 'generations', 'personas', 'styles', 'library'], 'readwrite');
  let count = 0;
  for (const p of manifest.projects) {
    await tx.objectStore('projects').put(hydrate(p, files) as Project);
    count++;
  }
  for (const g of thumbnailsToImport(here, manifest.generations)) {
    await tx.objectStore('generations').put(hydrate(g, files) as Generation);
    count++;
  }
  for (const p of manifest.personas) {
    await tx.objectStore('personas').put(hydrate(p, files) as Persona);
    count++;
  }
  for (const s of manifest.styles) {
    await tx.objectStore('styles').put(s);
    count++;
  }
  for (const l of manifest.library) {
    await tx.objectStore('library').put(hydrate(l, files) as LibraryImage);
    count++;
  }
  await tx.done;
  return count;
}

/** Zip of ready-to-upload thumbnails (already exported to YouTube spec). */
export async function zipFiles(entries: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const files: Zippable = {};
  for (const e of entries) files[e.name] = await bytes(e.blob);
  return new Blob([(await zipAsync(files)) as BlobPart], { type: 'application/zip' });
}
