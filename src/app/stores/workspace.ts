import { create } from 'zustand';
import { toast } from 'sonner';
import * as db from '../lib/db';
import { generateImage, isAbort } from '../lib/providers';
import {
  buildEditPrompt,
  buildGenerationPrompt,
  buildOutpaintPrompt,
  buildRegionEditPrompt,
  buildHealPrompt,
  buildUpscalePrompt,
  type ImageRole,
} from '../lib/prompt';
import { composeReframe, composeZoneReframe, isIdentity, isZone, type Point, type Reframe } from '../lib/reframe';
import { useReframe } from './reframe';
import { dimensions, highlightRegion, mergeWithMask, normaliseUpload, prepareReference } from '../lib/images';
import { explainError } from '../lib/errors';
import { smoothRegion } from '../lib/smooth';
import { randomSeed } from '../lib/channel';
import { newGeneration, type VersionInput } from '../lib/versions';
import { findStyle } from '../lib/styles';
import { rankThumbnails, type Ranking } from '../lib/ai';
import type { AspectRatio, BrandKit, ChannelPage, Generation, GenerationAction, GenerationKind, GenerationParams, LibraryImage, ModelId, Persona, Project, RefImage, RefSource } from '../lib/types';
import { useSettings } from './settings';
import { t, translate } from '../i18n';
import { isArrow, isVisible, type LayerBlock } from '../lib/textBlocks';
import { renderText, textSummary } from '../lib/textLayer';
import { useText } from './text';

export const MAX_IMAGES = 14;
export const MAX_PERSONAS = 5;

export type ViewMode = 'image' | 'feed' | 'channel' | 'compare';

export interface Job {
  id: string;
  kind: GenerationKind;
  status: 'running' | 'failed' | 'canceled';
  startedAt: number;
  elapsed: number;
  parentId?: string;
  error?: string;
  controller: AbortController;
  /** The studio is locked while it runs (reframing: the image being worked on is about to be replaced). */
  blocking?: boolean;
}

export interface Brief {
  videoTitle: string;
  brief: string;
  styleId: string;
}

/** What an action produced, for callers that need it (the agent bridge); the UI ignores it. */
export interface Outcome<T> {
  value?: T;
  error?: string;
}

interface ErrorReport {
  message: string;
  status?: number;
  details?: unknown;
}

interface WorkspaceState {
  ready: boolean;
  projects: Project[];
  projectId: string;
  generations: Generation[];
  selectedId: string | null;
  /** Filmstrip multi-selection, used by Compare and Test & Compare export. */
  pickedIds: string[];
  jobs: Job[];

  brief: Brief;
  refs: RefImage[];
  personaIds: string[];
  personas: Persona[];
  library: LibraryImage[];
  brand: BrandKit;

  view: ViewMode;
  safeZones: boolean;
  /** The image tool in use, one at a time (see `setTool`). */
  tool: Tool | null;
  /** Something is painted with the area tool. */
  hasMask: boolean;
  ranking: { ids: string[]; result: Ranking } | null;
  ranking_busy: boolean;
  lastError: ErrorReport | null;

  init: () => Promise<void>;
  // projects
  newProject: (name?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (name: string) => Promise<void>;
  /** The open project's channel page preview (slots, theme, statistics). */
  updateChannelPage: (patch: Partial<ChannelPage>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  // brief
  setBrief: (patch: Partial<Brief>) => void;
  addFiles: (files: Iterable<File | Blob>, source?: RefSource) => Promise<void>;
  addRef: (blob: Blob, source: RefSource, label?: string) => boolean;
  removeRef: (id: string) => void;
  clearRefs: () => void;
  togglePersona: (id: string) => void;
  // generation
  generate: () => Promise<Outcome<Generation>[]>;
  /** The prompt `generate` would send for the current brief, without sending anything. */
  previewPrompt: () => string;
  /** `mask` overrides the painted mask (the agent describes regions as rectangles). */
  edit: (instruction: string, opts?: { mask?: HTMLCanvasElement }) => Promise<Outcome<Generation>[]>;
  /** Healing brush: the painted area is repainted to erase seams and hard edges. */
  heal: () => Promise<Outcome<Generation> | null>;
  /** A plain white image in the output format, as a new thumbnail of the project. */
  addBlankImage: () => Promise<Generation | null>;
  /** The selected version copied as a new, independent thumbnail (its text layer included). */
  duplicateSelected: () => Promise<Generation | null>;
  /** « Lisser »: the painted area is refilled from its surroundings, locally, without AI. */
  smooth: () => Promise<Generation | null>;
  /**
   * AI upscale: a 2K version of the image with finer detail, saved as a new
   * version. Editable text is kept as text and redrawn on the upscaled image.
   */
  upscale: (id: string) => Promise<Outcome<Generation> | null>;
  cancelJob: (id: string) => void;
  dismissJob: (id: string) => void;
  cancelAll: () => void;
  // gallery
  select: (id: string | null) => void;
  togglePick: (id: string) => void;
  clearPicks: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  removeGeneration: (id: string) => Promise<void>;
  reuse: (gen: Generation) => void;
  rankPicked: () => Promise<Outcome<Ranking>>;
  // assets
  reloadPersonas: () => Promise<void>;
  reloadLibrary: () => Promise<void>;
  saveBrand: (kit: BrandKit) => Promise<void>;
  saveToLibrary: (blob: Blob) => Promise<void>;
  // ui
  setView: (view: ViewMode) => void;
  setSafeZones: (on: boolean) => void;
  /**
   * Opens an image tool (null leaves it): the text tool loads the image's
   * editable layer, leaving it drops the unapplied blocks, the reframe tool
   * starts from the image as it is, and the painted area goes with the area tool.
   */
  setTool: (tool: Tool | null) => void;
  /** Adds a text block (the brand's first colour behind it) or an arrow to the layer being edited. */
  addBlock: (kind: 'text' | 'arrow') => void;
  /** Text and arrows on the selected image that aren't part of its pixels: being edited, or its editable layer. */
  pendingBlocks: () => LayerBlock[];
  /**
   * New version with the image moved / scaled in its frame. Done locally when it
   * still covers the frame; otherwise the model fills the empty areas. Moves
   * the whole image, or only `zone` (fractions of the image) when given.
   */
  reframe: (frame: Reframe, zone?: Point[] | null) => Promise<Outcome<Generation> | null>;
  /**
   * Draws the text blocks on the selected image. A text version is updated in
   * place (its blocks stay editable, or final with `merge`); any other image
   * gets a new text version.
   */
  applyText: (blocks: LayerBlock[], opts?: { merge?: boolean }) => Promise<Generation | null>;
  /** Before reframing: draws the chosen kinds of blocks into the image (they move with it); the others stay editable. */
  bakeText: (blocks: LayerBlock[], merge: { text: boolean; arrows: boolean }) => Promise<Generation | null>;
  /** Makes a text version's text final: keeps the image, forgets the editable blocks. */
  mergeText: (id: string) => Promise<void>;
  setHasMask: (on: boolean) => void;
  showError: (report: ErrorReport | null) => void;
}

// ─── Object URLs ─────────────────────────────────────────
// Blobs live in IndexedDB; the UI needs URLs. Cache them and revoke on removal.

const urlCache = new Map<Blob, string>();
export function blobUrl(blob: Blob): string {
  let url = urlCache.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    urlCache.set(blob, url);
  }
  return url;
}
function revoke(blob: Blob | undefined) {
  if (!blob) return;
  const url = urlCache.get(blob);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(blob);
}

// ─── Mask canvas (owned by the canvas component) ─────────

let maskCanvas: HTMLCanvasElement | null = null;
export function registerMaskCanvas(canvas: HTMLCanvasElement | null) {
  maskCanvas = canvas;
}

/** A copy of the painted mask: the user may keep painting while the edit runs. */
function snapshotMask(painted: HTMLCanvasElement): HTMLCanvasElement {
  const mask = document.createElement('canvas');
  mask.width = painted.width;
  mask.height = painted.height;
  mask.getContext('2d')?.drawImage(painted, 0, 0);
  return mask;
}

const EMPTY_BRAND: BrandKit = { id: 'default', channelName: '', colors: [], updatedAt: 0 };

/** Brand kits saved before the merge into the brief panel also had a font, a style profile… and a separate feed picture. */
function migrateBrand(saved: (BrandKit & { avatar?: Blob }) | undefined): BrandKit {
  if (!saved) return EMPTY_BRAND;
  const { channelName = '', colors = [], banner, handle, subscribers, videoCount, description, verified, updatedAt = 0 } = saved;
  return { id: 'default', channelName, colors, logo: saved.avatar ?? saved.logo, banner, handle, subscribers, videoCount, description, verified, updatedAt };
}

/** Size of a blank image per output format (the edits keep it). */
const BLANK_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '4:3': { width: 1440, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '21:9': { width: 2520, height: 1080 },
};

/** The name a new project gets, in either language: a project still named so was never renamed. */
const DEFAULT_PROJECT_NAMES = new Set([translate('fr', 'topbar.untitled'), translate('en', 'topbar.untitled')]);

const BRIEF_KEY = 'nt_brief';
const EMPTY_BRIEF: Brief = { videoTitle: '', brief: '', styleId: '' };
function loadBrief(): Brief {
  try {
    const saved = JSON.parse(localStorage.getItem(BRIEF_KEY) || '{}');
    return { videoTitle: saved.videoTitle ?? '', brief: saved.brief ?? '', styleId: saved.styleId ?? '' };
  } catch {
    return EMPTY_BRIEF;
  }
}

function reportError(error: unknown, set: (s: Partial<WorkspaceState>) => void): string {
  const info = explainError(error);
  if (isAbort(error)) return info.message;
  const report = { message: info.message, status: info.status, details: info.details };
  toast.error(t(info.key), {
    description: info.message,
    action: info.details ? { label: t('errors.details'), onClick: () => set({ lastError: report }) } : undefined,
  });
  return t(info.key);
}

export const useWorkspace = create<WorkspaceState>((set, get) => {
  /** Personas selected for this brief → their photos, in a stable order. */
  function personaImages(ids = get().personaIds): Array<{ blob: Blob; role: ImageRole }> {
    const { personas } = get();
    return ids.flatMap((id) => {
      const p = personas.find((x) => x.id === id);
      if (!p) return [];
      const order = { front: 0, left: 1, right: 2, expression: 3 };
      return [...p.photos]
        .sort((a, b) => order[a.slot] - order[b.slot])
        .map((ph) => ({
          blob: ph.blob,
          role: { kind: 'persona', name: p.name, description: p.description, expression: ph.expression } as ImageRole,
        }));
    });
  }

  /**
   * Every new image goes through here: a version of `parent`, or an original.
   * `blob` is the image itself, or the base under `blocks` when they are given
   * (an editable text layer). Saved, then shown when its project is still open,
   * unless `show` is false (the later results of a batch).
   */
  async function saveVersion(input: Omit<VersionInput, 'width' | 'height' | 'textLayer'> & { blocks?: LayerBlock[]; show?: boolean }): Promise<Generation> {
    const { blocks, show = true, ...rest } = input;
    const textLayer = blocks ? { base: input.blob, blocks } : undefined;
    const blob = textLayer ? await renderText(textLayer.base, textLayer.blocks) : input.blob;
    const { width, height } = await dimensions(blob);
    const generation = newGeneration({ projectId: get().projectId, ...rest, blob, width, height, textLayer }, db.uid('g_'), Date.now());
    await db.putGeneration(generation);
    if (generation.projectId !== get().projectId) return generation;
    set({ generations: [generation, ...get().generations] });
    if (show) {
      // Leaves the current tool, so the result shows without a mask or text draft over it.
      get().select(generation.id);
      if (get().view === 'compare' || get().view === 'channel') set({ view: 'image' });
    }
    return generation;
  }

  /** Saves a changed version in place (favourite, text layer edited or merged). */
  async function replaceVersion(generation: Generation) {
    await db.putGeneration(generation);
    set({ generations: get().generations.map((g) => (g.id === generation.id ? generation : g)) });
  }

  /** Edits only the area of `mask` (white/opaque = edit); the rest is merged back untouched. */
  async function regionEdit(
    source: Generation,
    mask: HTMLCanvasElement,
    prompt: string,
    fullPrompt: string,
    apiKey: string,
    action?: GenerationAction,
    model?: ModelId,
  ) {
    const highlighted = await highlightRegion(source.blob, mask);
    return runJob({
      kind: 'region',
      action,
      prompt,
      fullPrompt,
      // Clean image first (what gets edited), marked copy second (where to edit):
      // sending only the marked copy lets the magenta tint bleed into the result.
      images: [source.blob, highlighted],
      params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio, ...(model ? { model } : {}) },
      parent: source,
      apiKey,
      finalize: (edited) => mergeWithMask(source.blob, edited, mask),
      batch: { shown: false },
    });
  }

  /** Images and full prompt for the current brief, shared by `generate` and `previewPrompt`. */
  function generationRequest() {
    const { brief, refs } = get();
    const attached = [
      ...personaImages(),
      ...refs.map((r) => ({ blob: r.blob, role: { kind: 'reference', label: r.label } as ImageRole })),
    ];
    const fullPrompt = buildGenerationPrompt({
      brief: brief.brief,
      videoTitle: brief.videoTitle,
      aspectRatio: useSettings.getState().aspectRatio,
      style: findStyle(brief.styleId)?.prompt,
      roles: attached.map((a) => a.role),
      colors: get().brand.colors,
    });
    return { attached, fullPrompt };
  }

  function fail(message: string): Outcome<Generation>[] {
    toast.error(message);
    return [{ error: message }];
  }

  function checkKey(): string | null {
    const key = useSettings.getState().apiKey();
    if (!key) {
      toast.error(t('brief.needKey'));
      window.dispatchEvent(new CustomEvent('nt:open-settings'));
      return null;
    }
    return key;
  }

  async function runJob(opts: {
    kind: GenerationKind;
    action?: GenerationAction;
    prompt: string;
    fullPrompt: string;
    images: Blob[];
    params: GenerationParams;
    /** The version being edited; none for a generation from the brief. */
    parent?: Generation;
    videoTitle?: string;
    apiKey: string;
    /** Post-process the raw model output (region edits merge it back into the original). */
    finalize?: (blob: Blob) => Promise<Blob>;
    /** Text blocks to keep editable over the result (upscaling a text version). */
    textBlocks?: LayerBlock[];
    /** Send the images at this size instead of the usual reference downscale. */
    reference?: { maxSide: number; bytes: number };
    /** Shared by the jobs of one batch: the first result to arrive gets shown. */
    batch: { shown: boolean };
    blocking?: boolean;
  }): Promise<Outcome<Generation>> {
    // The project it was started in, even if the user opens another one meanwhile.
    const projectId = opts.parent?.projectId ?? get().projectId;
    const job: Job = {
      id: db.uid('j_'),
      kind: opts.kind,
      blocking: opts.blocking,
      status: 'running',
      startedAt: Date.now(),
      elapsed: 0,
      parentId: opts.parent?.id,
      controller: new AbortController(),
    };
    set({ jobs: [...get().jobs, job] });
    const patchJob = (patch: Partial<Job>) =>
      set({ jobs: get().jobs.map((j) => (j.id === job.id ? { ...j, ...patch } : j)) });

    try {
      const images = await Promise.all(opts.images.map((b) => prepareReference(b, opts.reference?.maxSide, opts.reference?.bytes)));
      let blob = await generateImage({
        prompt: opts.fullPrompt,
        images,
        params: opts.params,
        apiKey: opts.apiKey,
        signal: job.controller.signal,
        onProgress: (elapsed) => patchJob({ elapsed }),
      });
      if (opts.finalize) blob = await opts.finalize(blob);
      // The first result of a batch gets shown.
      const show = !opts.batch.shown && projectId === get().projectId;
      if (show) opts.batch.shown = true;
      const generation = await saveVersion({
        parent: opts.parent,
        projectId,
        kind: opts.kind,
        action: opts.action,
        prompt: opts.prompt,
        fullPrompt: opts.fullPrompt,
        videoTitle: opts.videoTitle,
        params: opts.params,
        blob,
        blocks: opts.textBlocks,
        show,
      });
      set({ jobs: get().jobs.filter((j) => j.id !== job.id) });
      return { value: generation };
    } catch (error) {
      if (isAbort(error) && job.controller.signal.aborted) {
        set({ jobs: get().jobs.filter((j) => j.id !== job.id) });
        return { error: t('agent.canceled') };
      }
      const message = reportError(error, set);
      patchJob({ status: 'failed', error: message });
      return { error: message };
    }
  }

  return {
    ready: false,
    projects: [],
    projectId: '',
    generations: [],
    selectedId: null,
    pickedIds: [],
    jobs: [],
    brief: loadBrief(),
    refs: [],
    personaIds: [],
    personas: [],
    library: [],
    brand: EMPTY_BRAND,
    view: 'image',
    safeZones: false,
    tool: null,
    hasMask: false,
    ranking: null,
    ranking_busy: false,
    lastError: null,

    init: async () => {
      const [projects, personas, library, brand] = await Promise.all([
        db.listProjects(),
        db.listPersonas(),
        db.listLibrary(),
        db.getBrandKit(),
      ]);
      // Every registered person is in the thumbnails by default (up to the limit); unticking one lasts until the next launch.
      set({ projects, personas, library, brand: migrateBrand(brand), personaIds: personas.slice(0, MAX_PERSONAS).map((p) => p.id) });
      let lastId: string | null = null;
      try {
        lastId = localStorage.getItem('nt_project');
      } catch {
        /* ignore */
      }
      const target = projects.find((p) => p.id === lastId) ?? projects[0];
      if (target) await get().openProject(target.id);
      else await get().newProject();
      set({ ready: true });
    },

    newProject: async (name) => {
      const now = Date.now();
      const project: Project = { id: db.uid('p_'), name: name ?? t('topbar.untitled'), createdAt: now, updatedAt: now };
      await db.putProject(project);
      set({ projects: [project, ...get().projects] });
      await get().openProject(project.id);
    },

    openProject: async (id) => {
      get().generations.forEach((g) => revoke(g.blob));
      const generations = await db.listGenerations(id);
      get().setTool(null);
      set({ projectId: id, generations, selectedId: generations[0]?.id ?? null, pickedIds: [], ranking: null });
      try {
        localStorage.setItem('nt_project', id);
      } catch {
        /* ignore */
      }
    },

    renameProject: async (name) => {
      const project = get().projects.find((p) => p.id === get().projectId);
      if (!project || !name.trim()) return;
      const updated = { ...project, name: name.trim(), updatedAt: Date.now() };
      await db.putProject(updated);
      set({ projects: get().projects.map((p) => (p.id === updated.id ? updated : p)) });
    },

    updateChannelPage: async (patch) => {
      const project = get().projects.find((p) => p.id === get().projectId);
      if (!project) return;
      const page = { ...(project.channelPage ?? { slots: [], dark: false, seed: randomSeed() }), ...patch };
      const updated = { ...project, channelPage: page };
      set({ projects: get().projects.map((p) => (p.id === updated.id ? updated : p)) });
      await db.putProject(updated);
    },

    removeProject: async (id) => {
      await db.deleteProject(id);
      const projects = get().projects.filter((p) => p.id !== id);
      set({ projects });
      if (id === get().projectId) {
        if (projects[0]) await get().openProject(projects[0].id);
        else await get().newProject();
      }
    },

    setBrief: (patch) => {
      const brief = { ...get().brief, ...patch };
      set({ brief });
      try {
        localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
      } catch {
        /* ignore */
      }
    },

    addFiles: async (files, source = 'upload') => {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const blob = await normaliseUpload(file);
          if (!get().addRef(blob, source)) break;
        } catch (error) {
          reportError(error, set);
        }
      }
    },

    addRef: (blob, source, label) => {
      if (get().refs.length >= MAX_IMAGES) {
        toast.error(t('brief.tooManyRefs'));
        return false;
      }
      set({ refs: [...get().refs, { id: db.uid('r_'), blob, source, label }] });
      return true;
    },

    removeRef: (id) => set({ refs: get().refs.filter((r) => r.id !== id) }),
    clearRefs: () => set({ refs: [] }),

    togglePersona: (id) => {
      const ids = get().personaIds;
      if (ids.includes(id)) return set({ personaIds: ids.filter((x) => x !== id) });
      if (ids.length >= MAX_PERSONAS) return void toast.error(t('brief.tooManyPersonas'));
      set({ personaIds: [...ids, id] });
    },

    heal: async () => {
      const source = selectedGeneration(get());
      if (!source || !get().hasMask || !maskCanvas) return null;
      const apiKey = checkKey();
      if (!apiKey) return null;
      const mask = snapshotMask(maskCanvas);
      // Filled locally first: the model then only restores texture, it has no hole to invent into.
      const patched = await smoothRegion(source.blob, mask);
      // Always Nano Banana 2, whatever the model chosen for generating.
      return regionEdit({ ...source, blob: patched }, mask, t('heal.done'), buildHealPrompt(), apiKey, 'heal', 'nano-banana-2');
    },

    addBlankImage: async () => {
      const settings = useSettings.getState();
      const { width, height } = BLANK_SIZES[settings.aspectRatio];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
      return saveVersion({ kind: 'import', prompt: t('filmstrip.blankImage'), videoTitle: get().brief.videoTitle || undefined, params: settings.params(), blob });
    },

    duplicateSelected: async () => {
      const source = selectedGeneration(get());
      if (!source) return null;
      const base = source.textLayer?.base ?? source.blob;
      // Its own Blob: deleting one of the two must not free the other's image.
      return saveVersion({
        projectId: source.projectId,
        kind: source.kind,
        prompt: source.prompt,
        fullPrompt: source.fullPrompt,
        videoTitle: source.videoTitle,
        params: source.params,
        blob: new Blob([base], { type: base.type }),
        blocks: source.textLayer?.blocks,
      });
    },

    smooth: async () => {
      const source = selectedGeneration(get());
      if (!source || !get().hasMask || !maskCanvas) return null;
      try {
        const blob = await smoothRegion(source.blob, snapshotMask(maskCanvas));
        return await saveVersion({ parent: source, kind: 'region', action: 'smooth', prompt: t('smooth.done'), blob });
      } catch (error) {
        reportError(error, set);
        return null;
      }
    },

    previewPrompt: () => generationRequest().fullPrompt,

    generate: async () => {
      const { brief } = get();
      if (!brief.brief.trim()) return fail(t('brief.needPrompt'));
      const apiKey = checkKey();
      if (!apiKey) return [{ error: t('brief.needKey') }];

      const settings = useSettings.getState();
      const { attached, fullPrompt } = generationRequest();
      if (attached.length > MAX_IMAGES) return fail(t('brief.tooManyRefs'));
      const params = settings.params();
      if (get().view === 'compare') set({ view: 'image' });
      const batch = { shown: false };

      return Promise.all(
        Array.from({ length: settings.count }, () =>
          runJob({
            kind: 'generate',
            prompt: brief.brief,
            fullPrompt,
            images: attached.map((a) => a.blob),
            params,
            videoTitle: brief.videoTitle || undefined,
            apiKey,
            batch,
          }),
        ),
      );
    },

    upscale: async (id) => {
      const source = get().generations.find((g) => g.id === id);
      if (!source) return null;
      const apiKey = checkKey();
      if (!apiKey) return null;
      return runJob({
        kind: 'upscale',
        prompt: t('export.upscaled'),
        fullPrompt: buildUpscalePrompt(),
        images: [source.textLayer?.base ?? source.blob],
        // 2K is above 1920×1080 at every aspect ratio.
        params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio, resolution: '2K' },
        parent: source,
        apiKey,
        textBlocks: source.textLayer?.blocks,
        // The model needs the full detail of the image it is asked to sharpen.
        reference: { maxSide: 2048, bytes: 3_000_000 },
        batch: { shown: false },
      });
    },

    edit: async (instruction, opts) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      if (!source || !instruction.trim()) return [];
      const apiKey = checkKey();
      if (!apiKey) return [{ error: t('brief.needKey') }];

      const settings = useSettings.getState();
      const params: GenerationParams = { ...settings.params(), aspectRatio: source.params.aspectRatio };
      const painted = get().tool === 'mask' && get().hasMask ? maskCanvas : null;

      const mask = opts?.mask ?? (painted ? snapshotMask(painted) : null);
      if (mask) return [await regionEdit(source, mask, instruction, buildRegionEditPrompt(instruction), apiKey)];

      // Re-send selected people so their identity doesn't drift over successive edits.
      const people = personaImages().slice(0, MAX_IMAGES - 1);
      const outcome = await runJob({
        kind: 'edit',
        prompt: instruction,
        fullPrompt: buildEditPrompt(instruction, people.map((p) => p.role)),
        images: [source.blob, ...people.map((p) => p.blob)],
        params,
        parent: source,
        apiKey,
        batch: { shown: false },
      });
      return [outcome];
    },

    cancelJob: (id) => {
      get().jobs.find((j) => j.id === id)?.controller.abort();
    },
    dismissJob: (id) => set({ jobs: get().jobs.filter((j) => j.id !== id) }),
    cancelAll: () => get().jobs.forEach((j) => j.status === 'running' && j.controller.abort()),

    select: (id) => {
      get().setTool(null);
      set({ selectedId: id });
    },

    togglePick: (id) => {
      const picked = get().pickedIds;
      set({ pickedIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(-4), ranking: null });
    },
    clearPicks: () => set({ pickedIds: [], ranking: null }),

    toggleFavorite: async (id) => {
      const gen = get().generations.find((g) => g.id === id);
      if (!gen) return;
      await replaceVersion({ ...gen, favorite: !gen.favorite });
    },

    removeGeneration: async (id) => {
      const gen = get().generations.find((g) => g.id === id);
      await db.deleteGeneration(id);
      const generations = get().generations.filter((g) => g.id !== id);
      // Versions can share a Blob in memory (a copy, a text version's base): only free it once unused.
      if (gen && !generations.some((g) => g.blob === gen.blob || g.textLayer?.base === gen.blob)) revoke(gen.blob);
      set({
        generations,
        selectedId: get().selectedId === id ? (generations[0]?.id ?? null) : get().selectedId,
        pickedIds: get().pickedIds.filter((x) => x !== id),
      });
    },

    reuse: (gen) => {
      const s = useSettings.getState();
      s.set({ model: gen.params.model, aspectRatio: gen.params.aspectRatio, resolution: gen.params.resolution });
      if (gen.kind === 'generate' || gen.kind === 'import') get().setBrief({ brief: gen.prompt, videoTitle: gen.videoTitle ?? get().brief.videoTitle });
    },

    rankPicked: async () => {
      const ids = get().pickedIds;
      const gens = ids.map((id) => get().generations.find((g) => g.id === id)).filter((g): g is Generation => !!g);
      if (gens.length < 2) return { error: t('agent.needTwo') };
      const apiKey = checkKey();
      if (!apiKey) return { error: t('brief.needKey') };
      set({ ranking_busy: true });
      try {
        const settings = useSettings.getState();
        const result = await rankThumbnails(
          { provider: settings.provider, apiKey },
          gens.map((g) => g.blob),
          { videoTitle: gens[0].videoTitle || get().brief.videoTitle, lang: settings.lang },
        );
        set({ ranking: { ids: gens.map((g) => g.id), result } });
        return { value: result };
      } catch (error) {
        return { error: reportError(error, set) };
      } finally {
        set({ ranking_busy: false });
      }
    },

    reloadPersonas: async () => {
      const known = new Set(get().personas.map((p) => p.id));
      const personas = await db.listPersonas();
      // Deleted people leave the selection; people just added join it, while there is room.
      const ids = get().personaIds.filter((id) => personas.some((p) => p.id === id));
      for (const p of personas) if (!known.has(p.id) && !ids.includes(p.id) && ids.length < MAX_PERSONAS) ids.push(p.id);
      set({ personas, personaIds: ids });
    },
    reloadLibrary: async () => set({ library: await db.listLibrary() }),
    saveBrand: async (kit) => {
      const previous = get().brand.channelName;
      const updated = { ...kit, updatedAt: Date.now() };
      await db.putBrandKit(updated);
      set({ brand: updated });
      // A project still under its default name takes the channel's name; a name the user chose is kept.
      const project = get().projects.find((p) => p.id === get().projectId);
      const name = updated.channelName.trim();
      if (name && name !== previous.trim() && project && DEFAULT_PROJECT_NAMES.has(project.name)) await get().renameProject(name);
    },
    saveToLibrary: async (blob) => {
      await db.putLibraryImage({ id: db.uid('l_'), blob, createdAt: Date.now() });
      await get().reloadLibrary();
      toast.success(t('canvas.savedToLibrary'));
    },

    // The painted area lives on the image view's canvas.
    setView: (view) => {
      if (view !== 'image' && get().tool === 'mask') get().setTool(null);
      set({ view });
    },
    setSafeZones: (on) => set({ safeZones: on }),
    setTool: (tool) => {
      const current = get().tool;
      if (tool === current || (tool && !get().selectedId)) return;
      // Text and arrows share one layer: switching between them keeps the unapplied blocks.
      const text = useText.getState();
      if (isLayerTool(current) && !isLayerTool(tool)) text.clear();
      if (isLayerTool(current) && isLayerTool(tool)) text.select(null);
      if (!isLayerTool(current) && isLayerTool(tool)) text.load(selectedGeneration(get())?.textLayer?.blocks ?? []);
      if (current === 'reframe' || tool === 'reframe') useReframe.getState().reset();
      set({ tool, hasMask: tool === 'mask' && current === 'mask' && get().hasMask, ...(tool ? { view: 'image' as const } : {}) });
      // Opening one with nothing of its kind yet starts with one to place.
      if (tool === 'text' && !useText.getState().blocks.some((b) => !isArrow(b))) get().addBlock('text');
      if (tool === 'arrow' && !useText.getState().blocks.some(isArrow)) get().addBlock('arrow');
    },
    addBlock: (kind) => {
      const color = get().brand.colors[0];
      if (kind === 'arrow') useText.getState().addArrow();
      else useText.getState().add('Anton', color ? { background: color } : {});
    },
    pendingBlocks: () => {
      if (isLayerTool(get().tool)) return useText.getState().blocks.filter(isVisible);
      return selectedGeneration(get())?.textLayer?.blocks ?? [];
    },

    reframe: async (frame, zone) => {
      const source = selectedGeneration(get());
      if (!source || isIdentity(frame)) return null;
      // A text version keeps its text where it is: only the image under it moves.
      const base = source.textLayer?.base ?? source.blob;
      const blocks = source.textLayer?.blocks;
      try {
        const { composed, mask, width, height } = isZone(zone) ? await composeZoneReframe(base, frame, zone) : await composeReframe(base, frame);
        if (!mask) {
          // Still covers the frame (zoom in / crop): no model needed.
          return { value: await saveVersion({ parent: source, kind: 'edit', action: 'reframe', prompt: t('reframe.done'), blob: composed, blocks }) };
        }
        const apiKey = checkKey();
        if (!apiKey) return null;
        get().setTool(null);
        return runJob({
          kind: 'edit',
          action: 'reframe',
          prompt: t('reframe.done'),
          fullPrompt: buildOutpaintPrompt(),
          images: [composed],
          params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio },
          parent: source,
          apiKey,
          textBlocks: blocks,
          // Only the empty areas come from the model; the moved image stays pixel-exact.
          finalize: (generated) => mergeWithMask(composed, generated, mask, 16, true),
          reference: { maxSide: 2048, bytes: 3_000_000 },
          batch: { shown: false },
          blocking: true,
        });
      } catch (error) {
        reportError(error, set);
        return null;
      }
    },

    applyText: async (blocks, opts) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      const used = blocks.filter(isVisible);
      // A text version may end up with no text (all removed); a plain image needs some.
      if (!source || (!used.length && !source.textLayer)) return null;
      try {
        const base = source.textLayer?.base ?? source.blob;
        const summary = textSummary(used);
        if (!source.textLayer) return await saveVersion({ parent: source, kind: 'text', prompt: summary, blob: base, blocks: used });
        const generation: Generation = { ...source, blob: await renderText(base, used), textLayer: { base, blocks: used }, prompt: summary || source.prompt };
        if (opts?.merge) delete generation.textLayer;
        await replaceVersion(generation);
        get().setTool(null);
        return generation;
      } catch (error) {
        reportError(error, set);
        return null;
      }
    },

    bakeText: async (blocks, merge) => {
      const source = selectedGeneration(get());
      const used = blocks.filter(isVisible);
      const baked = used.filter((b) => (isArrow(b) ? merge.arrows : merge.text));
      if (!source) return null;
      // Nothing to draw into the image: keep the blocks as an editable layer.
      if (!baked.length) return used.length || source.textLayer ? get().applyText(used) : source;
      try {
        const kept = used.filter((b) => !baked.includes(b));
        const base = await renderText(source.textLayer?.base ?? source.blob, baked);
        return await saveVersion({ parent: source, kind: 'text', prompt: textSummary(used), blob: base, blocks: kept.length ? kept : undefined });
      } catch (error) {
        reportError(error, set);
        return null;
      }
    },

    mergeText: async (id) => {
      const gen = get().generations.find((g) => g.id === id);
      if (!gen?.textLayer) return;
      const merged: Generation = { ...gen };
      delete merged.textLayer;
      await replaceVersion(merged);
    },
    setHasMask: (on) => set({ hasMask: on }),
    showError: (report) => set({ lastError: report }),
  };
});

/** An image tool working on the selected image. */
export type Tool = 'mask' | 'text' | 'arrow' | 'reframe';

/** The text and arrow tools edit the same layer (`stores/text.ts`), each its own kind of block. */
export function isLayerTool(tool: Tool | null): tool is 'text' | 'arrow' {
  return tool === 'text' || tool === 'arrow';
}

export function selectedGeneration(s: WorkspaceState): Generation | undefined {
  return s.generations.find((g) => g.id === s.selectedId);
}

