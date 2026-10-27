import { create } from 'zustand';
import { toast } from 'sonner';
import * as db from '../lib/db';
import { generateImage, isAbort } from '../lib/providers';
import {
  buildEditPrompt,
  buildFaceFixPrompt,
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
import { findStyle } from '../lib/styles';
import { rankThumbnails, type Ranking } from '../lib/ai';
import type { BrandKit, Generation, GenerationKind, GenerationParams, LibraryImage, Persona, Project, RefImage, RefSource } from '../lib/types';
import { useSettings } from './settings';
import { t } from '../i18n';
import { drawTextBlocks, cssFont, isArrow, isVisible, type LayerBlock, type TextBlock } from '../lib/textBlocks';
import { loadGoogleFont } from '../lib/fonts';
import { useText } from './text';

export const MAX_IMAGES = 14;
export const MAX_PERSONAS = 5;

export type ViewMode = 'image' | 'feed' | 'compare';

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

export interface ErrorReport {
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
  maskMode: boolean;
  /** Placing text blocks over the selected image (see stores/text.ts). */
  textMode: boolean;
  /** Moving / zooming the selected image inside its frame (see stores/reframe.ts). */
  reframeMode: boolean;
  hasMask: boolean;
  ranking: { ids: string[]; result: Ranking } | null;
  ranking_busy: boolean;
  lastError: ErrorReport | null;

  init: () => Promise<void>;
  // projects
  newProject: (name?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (name: string) => Promise<void>;
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
  /**
   * AI upscale: a 2K version of the image with finer detail, saved as a new
   * version. Editable text is kept as text and redrawn on the upscaled image.
   */
  upscale: (id: string) => Promise<Outcome<Generation> | null>;
  /** Restores these people's faces on the selected image from their reference photos (new version). */
  fixFaces: (personaIds: string[]) => Promise<Outcome<Generation> | null>;
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
  setMaskMode: (on: boolean) => void;
  setTextMode: (on: boolean) => void;
  setReframeMode: (on: boolean) => void;
  /**
   * New version with the image moved / scaled in its frame. Done locally when it
   * still covers the frame; otherwise the model fills the empty areas.
   */
  /** Moves the whole image, or only `zone` (fractions of the image) when given. */
  reframe: (frame: Reframe, zone?: Point[] | null) => Promise<Outcome<Generation> | null>;
  /**
   * Draws the text blocks on the selected image. A text version is updated in
   * place (its blocks stay editable); any other image gets a new text version.
   */
  applyText: (blocks: LayerBlock[]) => Promise<Generation | null>;
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
  return { id: 'default', channelName: saved.channelName ?? '', colors: saved.colors ?? [], logo: saved.avatar ?? saved.logo, updatedAt: saved.updatedAt ?? 0 };
}

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

  /** Edits only the area of `mask` (white/opaque = edit); the rest is merged back untouched. */
  async function regionEdit(source: Generation, mask: HTMLCanvasElement, prompt: string, fullPrompt: string, apiKey: string) {
    const highlighted = await highlightRegion(source.blob, mask);
    return runJob({
      kind: 'region',
      prompt,
      fullPrompt,
      // Clean image first (what gets edited), marked copy second (where to edit):
      // sending only the marked copy lets the magenta tint bleed into the result.
      images: [source.blob, highlighted],
      params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio },
      parentId: source.id,
      videoTitle: source.videoTitle,
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
    prompt: string;
    fullPrompt: string;
    images: Blob[];
    params: GenerationParams;
    parentId?: string;
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
    const job: Job = {
      id: db.uid('j_'),
      kind: opts.kind,
      blocking: opts.blocking,
      status: 'running',
      startedAt: Date.now(),
      elapsed: 0,
      parentId: opts.parentId,
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
      const textLayer = opts.textBlocks ? { base: blob, blocks: opts.textBlocks } : undefined;
      if (textLayer) blob = await renderText(textLayer.base, textLayer.blocks);
      const { width, height } = await dimensions(blob);
      const generation: Generation = {
        id: db.uid('g_'),
        projectId: get().projectId,
        parentId: opts.parentId,
        kind: opts.kind,
        prompt: opts.prompt,
        fullPrompt: opts.fullPrompt,
        videoTitle: opts.videoTitle,
        params: opts.params,
        blob,
        width,
        height,
        createdAt: Date.now(),
        ...(textLayer ? { textLayer } : {}),
      };
      await db.putGeneration(generation);
      // The user may have switched project meanwhile: only show it if still relevant.
      if (generation.projectId === get().projectId) {
        set({ generations: [generation, ...get().generations] });
        if (!opts.batch.shown) {
          opts.batch.shown = true;
          set({ selectedId: generation.id, maskMode: false, hasMask: false, view: get().view === 'compare' ? 'image' : get().view });
        }
      }
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
    maskMode: false,
    textMode: false,
    reframeMode: false,
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
      set({ projects, personas, library, brand: migrateBrand(brand) });
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
      set({ projectId: id, generations, selectedId: generations[0]?.id ?? null, pickedIds: [], ranking: null, maskMode: false });
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
      return regionEdit(source, snapshotMask(maskCanvas), t('heal.done'), buildHealPrompt(), apiKey);
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
        parentId: source.id,
        videoTitle: source.videoTitle,
        apiKey,
        textBlocks: source.textLayer?.blocks,
        // The model needs the full detail of the image it is asked to sharpen.
        reference: { maxSide: 2048, bytes: 3_000_000 },
        batch: { shown: false },
      });
    },

    fixFaces: async (personaIds) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      const names = personaIds.map((id) => get().personas.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
      if (!source || !names.length) return null;
      const apiKey = checkKey();
      if (!apiKey) return null;
      const people = personaImages(personaIds).slice(0, MAX_IMAGES - 1);
      return runJob({
        kind: 'edit',
        prompt: t('iterate.fixFaceDone', { names: names.join(', ') }),
        fullPrompt: buildFaceFixPrompt(names, people.map((p) => p.role)),
        // Editable text stays text: the faces are fixed on the image under it.
        images: [source.textLayer?.base ?? source.blob, ...people.map((p) => p.blob)],
        params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio },
        parentId: source.id,
        videoTitle: source.videoTitle,
        apiKey,
        textBlocks: source.textLayer?.blocks,
        // Faces are small in a thumbnail: send the image with all its detail.
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
      const painted = get().maskMode && get().hasMask ? maskCanvas : null;

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
        parentId: source.id,
        videoTitle: source.videoTitle,
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
      if (get().textMode) useText.getState().clear();
      useReframe.getState().reset();
      set({ selectedId: id, maskMode: false, hasMask: false, textMode: false, reframeMode: false });
    },

    togglePick: (id) => {
      const picked = get().pickedIds;
      set({ pickedIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(-4), ranking: null });
    },
    clearPicks: () => set({ pickedIds: [], ranking: null }),

    toggleFavorite: async (id) => {
      const gen = get().generations.find((g) => g.id === id);
      if (!gen) return;
      const updated = { ...gen, favorite: !gen.favorite };
      await db.putGeneration(updated);
      set({ generations: get().generations.map((g) => (g.id === id ? updated : g)) });
    },

    removeGeneration: async (id) => {
      const gen = get().generations.find((g) => g.id === id);
      await db.deleteGeneration(id);
      revoke(gen?.blob);
      const generations = get().generations.filter((g) => g.id !== id);
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
      const personas = await db.listPersonas();
      set({ personas, personaIds: get().personaIds.filter((id) => personas.some((p) => p.id === id)) });
    },
    reloadLibrary: async () => set({ library: await db.listLibrary() }),
    saveBrand: async (kit) => {
      const updated = { ...kit, updatedAt: Date.now() };
      await db.putBrandKit(updated);
      set({ brand: updated });
    },
    saveToLibrary: async (blob) => {
      await db.putLibraryImage({ id: db.uid('l_'), blob, createdAt: Date.now() });
      await get().reloadLibrary();
      toast.success(t('canvas.savedToLibrary'));
    },

    setView: (view) => set({ view, maskMode: view === 'image' ? get().maskMode : false }),
    setSafeZones: (on) => set({ safeZones: on }),
    setMaskMode: (on) =>
      set({
        maskMode: on,
        hasMask: on ? get().hasMask : false,
        textMode: on ? false : get().textMode,
        reframeMode: on ? false : get().reframeMode,
        view: on ? 'image' : get().view,
      }),
    setTextMode: (on) => {
      const layer = selectedGeneration(get())?.textLayer;
      if (on && layer) useText.getState().load(layer.blocks);
      else useText.getState().clear();
      set({
        textMode: on,
        maskMode: on ? false : get().maskMode,
        hasMask: on ? false : get().hasMask,
        reframeMode: on ? false : get().reframeMode,
        view: on ? 'image' : get().view,
      });
    },
    setReframeMode: (on) => {
      useReframe.getState().reset();
      if (on) useText.getState().clear();
      set({
        reframeMode: on,
        maskMode: on ? false : get().maskMode,
        hasMask: on ? false : get().hasMask,
        textMode: on ? false : get().textMode,
        view: on ? 'image' : get().view,
      });
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
          const textLayer = blocks ? { base: composed, blocks } : undefined;
          const generation: Generation = {
            id: db.uid('g_'),
            projectId: source.projectId,
            parentId: source.id,
            kind: 'edit',
            prompt: t('reframe.done'),
            fullPrompt: '',
            videoTitle: source.videoTitle,
            params: source.params,
            blob: textLayer ? await renderText(composed, textLayer.blocks) : composed,
            width,
            height,
            createdAt: Date.now(),
            ...(textLayer ? { textLayer } : {}),
          };
          await db.putGeneration(generation);
          set({ generations: [generation, ...get().generations], selectedId: generation.id, reframeMode: false });
          return { value: generation };
        }
        const apiKey = checkKey();
        if (!apiKey) return null;
        set({ reframeMode: false });
        return runJob({
          kind: 'edit',
          prompt: t('reframe.done'),
          fullPrompt: buildOutpaintPrompt(),
          images: [composed],
          params: { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio },
          parentId: source.id,
          videoTitle: source.videoTitle,
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

    applyText: async (blocks) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      const used = blocks.filter(isVisible);
      // A text version may end up with no text (all removed); a plain image needs some.
      if (!source || (!used.length && !source.textLayer)) return null;
      try {
        const base = source.textLayer?.base ?? source.blob;
        const blob = await renderText(base, used);
        const summary = used.map((b) => (isArrow(b) ? '➜' : b.text.replace(/\s+/g, ' ').trim())).join(' · ');
        const textLayer = { base, blocks: used };
        let generation: Generation;
        if (source.textLayer) {
          generation = { ...source, blob, textLayer, prompt: summary || source.prompt };
          await db.putGeneration(generation);
          set({ generations: get().generations.map((g) => (g.id === source.id ? generation : g)) });
        } else {
          generation = {
            id: db.uid('g_'),
            projectId: source.projectId,
            parentId: source.id,
            kind: 'text',
            prompt: summary,
            fullPrompt: '',
            videoTitle: source.videoTitle,
            params: source.params,
            blob,
            width: source.width,
            height: source.height,
            createdAt: Date.now(),
            textLayer,
          };
          await db.putGeneration(generation);
          set({ generations: [generation, ...get().generations], selectedId: generation.id });
        }
        useText.getState().clear();
        set({ textMode: false });
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
        const generation: Generation = {
          id: db.uid('g_'),
          projectId: source.projectId,
          parentId: source.id,
          kind: 'text',
          prompt: used.map((b) => (isArrow(b) ? '➜' : b.text.replace(/\s+/g, ' ').trim())).join(' · '),
          fullPrompt: '',
          videoTitle: source.videoTitle,
          params: source.params,
          blob: kept.length ? await renderText(base, kept) : base,
          width: source.width,
          height: source.height,
          createdAt: Date.now(),
          ...(kept.length ? { textLayer: { base, blocks: kept } } : {}),
        };
        await db.putGeneration(generation);
        useText.getState().clear();
        set({ generations: [generation, ...get().generations], selectedId: generation.id, textMode: false });
        return generation;
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
      await db.putGeneration(merged);
      set({ generations: get().generations.map((g) => (g.id === id ? merged : g)) });
    },
    setHasMask: (on) => set({ hasMask: on }),
    showError: (report) => set({ lastError: report }),
  };
});

/** `base` with the text blocks drawn on it, at the image's own resolution. */
async function renderText(base: Blob, blocks: LayerBlock[]): Promise<Blob> {
  // The canvas only draws with fonts the page has loaded.
  const texts = blocks.filter((b): b is TextBlock => !isArrow(b));
  await Promise.all([...new Set(texts.map((b) => b.font))].map((f) => loadGoogleFont(f).catch(() => undefined)));
  await Promise.all(texts.map((b) => document.fonts.load(cssFont(b, 48)).catch(() => undefined)));
  const bitmap = await createImageBitmap(base);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  drawTextBlocks(ctx, canvas.width, canvas.height, blocks);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
}

export function selectedGeneration(s: WorkspaceState): Generation | undefined {
  return s.generations.find((g) => g.id === s.selectedId);
}

/** Walk parentId links back to the root, oldest first. */
export function lineage(generations: Generation[], id: string | null): Generation[] {
  const byId = new Map(generations.map((g) => [g.id, g]));
  const chain: Generation[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  // Also show direct children of the selected image (branches made from it).
  const children = generations.filter((g) => g.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
  return [...chain, ...children];
}
