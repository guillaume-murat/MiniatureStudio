import { create } from 'zustand';
import { toast } from 'sonner';
import * as db from '../lib/db';
import { generateImage, isAbort } from '../lib/providers';
import {
  buildEditPrompt,
  buildGenerationPrompt,
  describeImages,
  IMAGES_HEADER,
  buildOutpaintPrompt,
  buildRegionEditPrompt,
  buildHealPrompt,
  buildUpscalePrompt,
  outputRatio,
  type ImageRole,
} from '../lib/prompt';
import { composeReframe, composeZoneReframe, isIdentity, isZone, type Point, type Reframe } from '../lib/reframe';
import { useReframe } from './reframe';
import { dimensions, highlightRegion, mergeWithMask, normaliseUpload, prepareReference } from '../lib/images';
import { explainError } from '../lib/errors';
import { smoothRegion } from '../lib/smooth';
import { randomSeed } from '../lib/channel';
import { newGeneration, type VersionInput } from '../lib/versions';
import { findStyle, optionsForNewStyle, resolveOptions } from '../lib/styles';
import type { Concept } from '../lib/ai';
import { rankThumbnails, type Ranking } from '../lib/ai';
import type {
  BrandKit,
  ChannelPage,
  Generation,
  CustomStyle,
  GenerationAction,
  GenerationKind,
  GenerationParams,
  LibraryImage,
  ModelId,
  Persona,
  Project,
  ProjectInputs,
  ProjectOutput,
  RefImage,
  ReferenceUse,
  RefSource,
  ResolvedPromptOptions,
} from '../lib/types';
import { useSettings } from './settings';
import { t, translate } from '../i18n';
import { isArrow, isVisible, type LayerBlock } from '../lib/textBlocks';
import { renderText, textSteps, textSummary } from '../lib/textLayer';
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
  /** The tool behind it (reframe, heal), for its label. The studio is locked while any job runs (BlockingJobOverlay). */
  action?: GenerationAction;
}

export type Brief = ProjectInputs['brief'];

/** What an action produced, for callers that need it (the agent bridge); the UI ignores it. */
/** A concept's image, with what was actually sent to make it: the brief may change before it is added. */
export interface ConceptPreview {
  blob: Blob;
  fullPrompt: string;
  params: GenerationParams;
}

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
  /** The user's own styles, shared by every project. */
  customStyles: CustomStyle[];
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
  setRefUse: (id: string, use: ReferenceUse) => void;
  clearRefs: () => void;
  togglePersona: (id: string) => void;
  // generation
  generate: () => Promise<Outcome<Generation>[]>;
  /** A cheap image of a concept with the current brief's settings, not saved until `addConceptImage`. */
  previewConcept: (concept: Concept, signal?: AbortSignal) => Promise<ConceptPreview>;
  /** That image as a new thumbnail of the open project. */
  addConceptImage: (concept: Concept, preview: ConceptPreview) => Promise<Generation>;
  /** The prompt `generate` would send for the current brief, without sending anything. */
  previewPrompt: () => string;
  /** The lines the selected people and the references add to that prompt, numbered as sent. */
  previewImageLines: () => { people: string; references: string };
  /** The advanced options in effect for the current brief. */
  promptOptions: () => ResolvedPromptOptions;
  /** What `edit` would send for this instruction, without sending anything. */
  previewEdit: (instruction: string) => Promise<EditPreview>;
  /** `mask` overrides the painted mask (the agent describes regions as rectangles). */
  edit: (instruction: string, opts?: { mask?: HTMLCanvasElement }) => Promise<Outcome<Generation>[]>;
  /** Healing brush: the painted area is repainted to erase seams and hard edges. */
  heal: () => Promise<Outcome<Generation> | null>;
  /** The selected version copied as a new, independent thumbnail. */
  duplicateSelected: () => Promise<Generation | null>;
  /** « Lisser »: the painted area is refilled from its surroundings, locally, without AI. */
  smooth: () => Promise<Generation | null>;
  /** AI upscale: a 2K version of the image with finer detail, saved as a new version. */
  upscale: (id: string) => Promise<Outcome<Generation> | null>;
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
  reloadStyles: () => Promise<void>;
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
  /**
   * New version with the image moved / scaled in its frame. Done locally when it
   * still covers the frame; otherwise the model fills the empty areas. Moves
   * the whole image, or only `zone` (fractions of the image) when given.
   */
  reframe: (frame: Reframe, zone?: Point[] | null) => Promise<Outcome<Generation> | null>;
  /** Draws the blocks into the selected image, for good: one new version for the texts, one for the arrows. */
  applyText: (blocks: LayerBlock[]) => Promise<Generation | null>;
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

/** The name a new project gets, in either language: a project still named so was never renamed. */
const DEFAULT_PROJECT_NAMES = new Set([translate('fr', 'topbar.untitled'), translate('en', 'topbar.untitled')]);

const EMPTY_BRIEF: Brief = { videoTitle: '', brief: '', styleId: '' };

/** A new project's output settings. */
const DEFAULT_OUTPUT: ProjectOutput = { model: 'nano-banana-pro', aspectRatio: '16:9', resolution: '1K', format: 'png', safety: 'block_only_high', count: 1 };
const OUTPUT_KEYS = ['model', 'aspectRatio', 'resolution', 'format', 'safety', 'count'] as const;

function currentOutput(): ProjectOutput {
  const s = useSettings.getState();
  return { model: s.model, aspectRatio: s.aspectRatio, resolution: s.resolution, format: s.format, safety: s.safety, count: s.count };
}

// ─── Per-project brief panel ─────────────────────────────
// The brief panel (brief, references, channel, people, output) is saved in its
// project, shortly after each change. Projects made before that take the values
// that were shared then (the last brief, brand kit, people and output settings).

/** The project whose inputs are on screen; null while switching (nothing gets saved then). */
let loadedProjectId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Output settings at launch, for projects made before they were per project. */
let legacyOutput: ProjectOutput = DEFAULT_OUTPUT;
/** Every person record known, to spot the one just created (it joins the open project's selection). */
let knownPersonaIds = new Set<string>();

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), 300);
}

function cancelSave() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
}

async function flushSave() {
  cancelSave();
  const ws = useWorkspace.getState();
  const project = ws.projects.find((p) => p.id === ws.projectId);
  if (!project || loadedProjectId !== project.id) return;
  const inputs: ProjectInputs = { brief: ws.brief, refs: ws.refs, brand: ws.brand, people: ws.personaIds, output: currentOutput() };
  const updated = { ...project, inputs };
  useWorkspace.setState({ projects: useWorkspace.getState().projects.map((p) => (p.id === updated.id ? updated : p)) });
  await db.putProject(updated);
}

/** The brief that was shared by all projects (kept in localStorage before projects had their own). */
function loadBrief(): Brief {
  try {
    const saved = JSON.parse(localStorage.getItem('nt_brief') || '{}');
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

/** What the next edit sends, for the eye of the edit bar. */
export interface EditPreview {
  region: boolean;
  prompt: string;
  params: GenerationParams;
  images: Array<{ blob: Blob; role: 'current' | 'marked' | 'person'; person?: string }>;
  /** Selected people that a region edit does not send. */
  peopleLeftOut: boolean;
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

  function referenceImages(): Array<{ blob: Blob; role: ImageRole }> {
    return get().refs.map((r) => ({ blob: r.blob, role: { kind: 'reference', label: r.label, use: r.use } }));
  }

  /**
   * Every new image goes through here: a version of `parent`, or an original.
   * Saved, then shown when its project is still open, unless `show` is false
   * (the later results of a batch).
   */
  async function saveVersion(input: Omit<VersionInput, 'width' | 'height'> & { show?: boolean }): Promise<Generation> {
    const { show = true, ...rest } = input;
    const { width, height } = await dimensions(input.blob);
    const generation = newGeneration({ projectId: get().projectId, ...rest, width, height }, db.uid('g_'), Date.now());
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

  /** Saves a changed version in place (favourite). */
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

  /** The area painted with the mask tool, if any: an edit then only changes it. */
  function paintedMask() {
    return get().tool === 'mask' && get().hasMask ? maskCanvas : null;
  }

  function editParams(source: Generation): GenerationParams {
    return { ...useSettings.getState().params(), aspectRatio: source.params.aspectRatio };
  }

  /** Selected people are sent again with an edit, so their identity doesn't drift over successive edits. */
  function editPeople() {
    return personaImages().slice(0, MAX_IMAGES - 1);
  }

  /** What a concept's preview is generated with. */
  function conceptParams(): GenerationParams {
    return { ...useSettings.getState().params(), model: 'nano-banana-2-lite', resolution: '1K' };
  }

  /** Images and full prompt for the current brief, shared by `generate` and `previewPrompt`. */
  function generationRequest(concept?: Concept) {
    const { brief } = get();
    const style = findStyle(concept?.styleId ?? brief.styleId, get().customStyles);
    // A concept is previewed from its text alone: no photos or references to send.
    const attached = concept ? [] : [...personaImages(), ...referenceImages()];
    const fullPrompt = buildGenerationPrompt({
      brief: concept?.brief ?? brief.brief,
      videoTitle: brief.videoTitle,
      aspectRatio: useSettings.getState().aspectRatio,
      style: style?.prompt,
      roles: attached.map((a) => a.role),
      colors: get().brand.colors,
      options: resolveOptions(style, brief.options),
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
    /** Send the images at this size instead of the usual reference downscale. */
    reference?: { maxSide: number; bytes: number };
    /** Shared by the jobs of one batch: the first result to arrive gets shown. */
    batch: { shown: boolean };
  }): Promise<Outcome<Generation>> {
    // The project it was started in, even if the user opens another one meanwhile.
    const projectId = opts.parent?.projectId ?? get().projectId;
    const job: Job = {
      id: db.uid('j_'),
      kind: opts.kind,
      action: opts.action,
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
    brief: EMPTY_BRIEF,
    refs: [],
    personaIds: [],
    personas: [],
    customStyles: [],
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
      const [projects, library, personas, customStyles] = await Promise.all([db.listProjects(), db.listLibrary(), db.listPersonas(), db.listStyles()]);
      set({ customStyles });
      legacyOutput = currentOutput();
      knownPersonaIds = new Set(personas.map((p) => p.id));
      set({ projects, library, personas });
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
      // A new project starts with an empty brief panel.
      const project: Project = {
        id: db.uid('p_'),
        name: name ?? t('topbar.untitled'),
        createdAt: now,
        updatedAt: now,
        inputs: { brief: EMPTY_BRIEF, refs: [], brand: { ...EMPTY_BRAND, updatedAt: now }, people: [], output: DEFAULT_OUTPUT },
      };
      await db.putProject(project);
      set({ projects: [project, ...get().projects] });
      await get().openProject(project.id);
    },

    openProject: async (id) => {
      await flushSave();
      loadedProjectId = null;
      get().generations.forEach((g) => revoke(g.blob));
      const generations = await db.listGenerations(id);
      const { personas } = get();
      const project = get().projects.find((p) => p.id === id);
      const inputs: ProjectInputs = project?.inputs ?? {
        brief: loadBrief(),
        refs: [],
        brand: migrateBrand(await db.getBrandKit()),
        // Everyone was in the thumbnails by default.
        people: personas.slice(0, MAX_PERSONAS).map((p) => p.id),
        output: legacyOutput,
      };
      get().setTool(null);
      useSettings.getState().set({ ...inputs.output, aspectRatio: outputRatio(inputs.output.aspectRatio) });
      set({
        projectId: id,
        generations,
        selectedId: generations[0]?.id ?? null,
        pickedIds: [],
        ranking: null,
        brief: inputs.brief,
        refs: inputs.refs,
        brand: inputs.brand,
        // The library is shared; the people in this project's thumbnails are its own.
        personaIds: inputs.people.filter((pid) => personas.some((p) => p.id === pid)).slice(0, MAX_PERSONAS),
      });
      loadedProjectId = id;
      // An older project gets its own copy of what was shared.
      if (!project?.inputs) scheduleSave();
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
      if (id === loadedProjectId) {
        cancelSave();
        loadedProjectId = null;
      }
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
      if (brief.styleId !== get().brief.styleId && !patch.options) brief.options = optionsForNewStyle(brief.options);
      set({ brief });
      scheduleSave();
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
      scheduleSave();
      return true;
    },

    setRefUse: (id, use) => {
      set({ refs: get().refs.map((r) => (r.id === id ? { ...r, use } : r)) });
      scheduleSave();
    },
    removeRef: (id) => {
      set({ refs: get().refs.filter((r) => r.id !== id) });
      scheduleSave();
    },
    clearRefs: () => {
      set({ refs: [] });
      scheduleSave();
    },

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

    duplicateSelected: async () => {
      const source = selectedGeneration(get());
      if (!source) return null;
      // Its own Blob: deleting one of the two must not free the other's image.
      return saveVersion({
        projectId: source.projectId,
        kind: source.kind,
        prompt: source.prompt,
        fullPrompt: source.fullPrompt,
        videoTitle: source.videoTitle,
        params: source.params,
        blob: new Blob([source.blob], { type: source.blob.type }),
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

    promptOptions: () => resolveOptions(findStyle(get().brief.styleId, get().customStyles), get().brief.options),

    previewImageLines: () => {
      const people = personaImages().map((a) => a.role);
      const references = referenceImages().map((a) => a.role);
      return {
        people: (people.length ? [IMAGES_HEADER, ...describeImages(people)] : []).join('\n'),
        references: (references.length && !people.length ? [IMAGES_HEADER] : []).concat(describeImages(references, people.length)).join('\n'),
      };
    },

    // Not a job: it would lock the studio behind the dialog, and nothing joins the project yet.
    previewConcept: async (concept, signal) => {
      const settings = useSettings.getState();
      const { fullPrompt } = generationRequest(concept);
      const params = conceptParams();
      const blob = await generateImage({ prompt: fullPrompt, images: [], params, apiKey: settings.apiKey(), signal });
      return { blob, fullPrompt, params };
    },

    addConceptImage: (concept, { blob, fullPrompt, params }) =>
      saveVersion({
        kind: 'generate',
        prompt: concept.brief,
        fullPrompt,
        videoTitle: get().brief.videoTitle || undefined,
        params,
        // Its own Blob: each click is an independent thumbnail, as with `duplicateSelected`.
        blob: new Blob([blob], { type: blob.type }),
      }),

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
        images: [source.blob],
        // 2K is above 1920×1080 at every aspect ratio, and Lite does not reach it.
        params: {
          ...useSettings.getState().params(),
          aspectRatio: source.params.aspectRatio,
          resolution: '2K',
          ...(useSettings.getState().model === 'nano-banana-2-lite' ? { model: 'nano-banana-2' as const } : {}),
        },
        parent: source,
        apiKey,
        // The model needs the full detail of the image it is asked to sharpen.
        reference: { maxSide: 2048, bytes: 3_000_000 },
        batch: { shown: false },
      });
    },

    previewEdit: async (instruction) => {
      const source = selectedGeneration(get());
      if (!source) throw new Error('No image selected');
      const text = instruction.trim() || t('editPrompt.placeholder');
      const params = editParams(source);
      const painted = paintedMask();
      if (painted) {
        const mask = snapshotMask(painted);
        return {
          region: true,
          prompt: buildRegionEditPrompt(text),
          params,
          images: [{ blob: source.blob, role: 'current' }, { blob: await highlightRegion(source.blob, mask), role: 'marked' }],
          peopleLeftOut: personaImages().length > 0,
        };
      }
      const people = editPeople();
      return {
        region: false,
        prompt: buildEditPrompt(text, people.map((p) => p.role)),
        params,
        images: [
          { blob: source.blob, role: 'current' },
          ...people.map(({ blob, role }) => ({ blob, role: 'person' as const, person: role.kind === 'persona' ? role.name : undefined })),
        ],
        peopleLeftOut: false,
      };
    },

    edit: async (instruction, opts) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      if (!source || !instruction.trim()) return [];
      const apiKey = checkKey();
      if (!apiKey) return [{ error: t('brief.needKey') }];

      const painted = paintedMask();
      const mask = opts?.mask ?? (painted ? snapshotMask(painted) : null);
      if (mask) return [await regionEdit(source, mask, instruction, buildRegionEditPrompt(instruction), apiKey)];

      const people = editPeople();
      const outcome = await runJob({
        kind: 'edit',
        prompt: instruction,
        fullPrompt: buildEditPrompt(instruction, people.map((p) => p.role)),
        images: [source.blob, ...people.map((p) => p.blob)],
        params: editParams(source),
        parent: source,
        apiKey,
        batch: { shown: false },
      });
      return [outcome];
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
      // Versions can share a Blob in memory: only free it once unused.
      if (gen && !generations.some((g) => g.blob === gen.blob)) revoke(gen.blob);
      set({
        generations,
        selectedId: get().selectedId === id ? (generations[0]?.id ?? null) : get().selectedId,
        pickedIds: get().pickedIds.filter((x) => x !== id),
      });
    },

    reuse: (gen) => {
      const s = useSettings.getState();
      s.set({ model: gen.params.model, aspectRatio: outputRatio(gen.params.aspectRatio), resolution: gen.params.resolution });
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
      const everyone = await db.listPersonas();
      // A person just created joins the open project's selection while there is room; deleted ones leave it.
      const created = everyone.filter((p) => !knownPersonaIds.has(p.id));
      knownPersonaIds = new Set(everyone.map((p) => p.id));
      const ids = get().personaIds.filter((id) => everyone.some((p) => p.id === id));
      for (const p of created) if (ids.length < MAX_PERSONAS) ids.push(p.id);
      set({ personas: everyone, personaIds: ids });
    },
    reloadStyles: async () => {
      const customStyles = await db.listStyles();
      set({ customStyles });
      // The open project falls back to no style when its style was just deleted.
      if (!findStyle(get().brief.styleId, customStyles)) get().setBrief({ styleId: '' });
    },
    reloadLibrary: async () => set({ library: await db.listLibrary() }),
    saveBrand: async (kit) => {
      const previous = get().brand.channelName;
      const updated = { ...kit, updatedAt: Date.now() };
      set({ brand: updated });
      scheduleSave();
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
      if (current === 'reframe' || tool === 'reframe') useReframe.getState().reset();
      set({ tool, hasMask: tool === 'mask' && current === 'mask' && get().hasMask, ...(tool ? { view: 'image' as const } : {}) });
      // Opening one with nothing of its kind yet starts with one to place.
      if (tool === 'text' && !useText.getState().blocks.some((b) => !isArrow(b))) get().addBlock('text');
      if (tool === 'arrow' && !useText.getState().blocks.some(isArrow)) get().addBlock('arrow');
    },
    addBlock: (kind) => {
      // New text: Bricolage Grotesque, white on black (newTextBlock).
      if (kind === 'arrow') useText.getState().addArrow();
      else useText.getState().add();
    },
    reframe: async (frame, zone) => {
      const source = selectedGeneration(get());
      if (!source || isIdentity(frame)) return null;
      try {
        const { composed, mask, width, height } = isZone(zone) ? await composeZoneReframe(source.blob, frame, zone) : await composeReframe(source.blob, frame);
        if (!mask) {
          // Still covers the frame (zoom in / crop): no model needed.
          return { value: await saveVersion({ parent: source, kind: 'edit', action: 'reframe', prompt: t('reframe.done'), blob: composed }) };
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
          // Only the empty areas come from the model; the moved image stays pixel-exact.
          finalize: (generated) => mergeWithMask(composed, generated, mask, 16, true),
          reference: { maxSide: 2048, bytes: 3_000_000 },
          batch: { shown: false },
        });
      } catch (error) {
        reportError(error, set);
        return null;
      }
    },

    applyText: async (blocks) => {
      const source = selectedGeneration(get());
      const used = blocks.filter(isVisible);
      if (!source || !used.length) return null;
      try {
        let generation = source;
        for (const step of textSteps(used)) {
          generation = await saveVersion({
            parent: generation,
            kind: 'text',
            action: step.some(isArrow) ? 'arrow' : undefined,
            prompt: textSummary(step),
            blob: await renderText(generation.blob, step),
          });
        }
        get().setTool(null);
        return generation;
      } catch (error) {
        reportError(error, set);
        return null;
      }
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

// Output settings live in the settings store (shared with the request code) but belong to the open project.
// The selection is saved however it changes (panel, new person, agent); not while a project opens.
useWorkspace.subscribe((state, previous) => {
  if (loadedProjectId && state.personaIds !== previous.personaIds) scheduleSave();
});

useSettings.subscribe((state, previous) => {
  if (OUTPUT_KEYS.some((k) => state[k] !== previous[k])) scheduleSave();
});
