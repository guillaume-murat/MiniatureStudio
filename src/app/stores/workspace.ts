import { create } from 'zustand';
import { toast } from 'sonner';
import * as db from '../lib/db';
import { generateImage, isAbort } from '../lib/providers';
import {
  buildEditPrompt,
  buildFaceFixPrompt,
  buildGenerationPrompt,
  describeImages,
  identityLine,
  imagesHeader,
  buildOutpaintPrompt,
  buildRegionEditPrompt,
  buildHealPrompt,
  buildUpscalePrompt,
  type ImageRole,
} from '../lib/prompt';
import { composeReframe, composeZoneReframe, isIdentity, isZone, type Point, type Reframe } from '../lib/reframe';
import { useReframe } from './reframe';
import { dimensions, highlightRegion, mergeWithMask, normaliseUpload, prepareReference } from '../lib/images';
import { errorLog, explainError, type JobContext, type JobStep } from '../lib/errors';
import { smoothRegion } from '../lib/smooth';
import { isMakingView, type View as PanelView } from '../lib/panels';
import { addStroke, EMPTY_SKETCH, isEmptySketch, isSketch, sketchBlob, undoStroke, type Sketch, type SketchStroke } from '../lib/sketch';
import { randomSeed } from '../lib/channel';
import { newGeneration, type VersionInput, historyOf, isOlderVersion, versionsAfter } from '../lib/versions';
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

/** Every prompt is written in the interface's language. */
const promptLang = () => useSettings.getState().lang;

export const MAX_IMAGES = 14;
export const MAX_PERSONAS = 5;

export type ViewMode = PanelView;
export { isMakingView };

export interface Job {
  id: string;
  kind: GenerationKind;
  status: 'running' | 'failed' | 'canceled';
  startedAt: number;
  elapsed: number;
  parentId?: string;
  error?: string;
  /** What the error dialog shows for a failed job. */
  report?: ErrorReport;
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

export interface ErrorReport {
  message: string;
  status?: number;
  details?: unknown;
  /** Everything known about the failure, as text (image jobs). */
  log?: string;
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
  /** The open project's sketch, drawn in the Gribouillis view. */
  sketch: Sketch;
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
  /** `fromAgent`: an MCP call, never from the sketch, whatever view the user has open. */
  generate: (opts?: { fromAgent?: boolean }) => Promise<Outcome<Generation>[]>;
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
  /** « Corriger le visage »: the painted face becomes this person's, from their photos (Nano Banana Pro). */
  fixFace: (personaId: string) => Promise<Outcome<Generation> | null>;
  /** A version copied as a new, independent thumbnail, shown at once. */
  duplicateVersion: (id: string) => Promise<Generation | null>;
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
  /** Deletes the versions after this one, which becomes the latest again, unless a call to the model is running. */
  revertTo: (id: string) => Promise<void>;
  /** Deletes a thumbnail with all its versions, under the same condition. */
  removeThumbnail: (id: string) => Promise<void>;
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
  addSketchStroke: (stroke: SketchStroke) => void;
  undoSketchStroke: () => void;
  clearSketch: () => void;
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
// project, shortly after each change.

/** The project whose inputs are on screen; null while switching (nothing gets saved then). */
let loadedProjectId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
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
  const inputs: ProjectInputs = { brief: ws.brief, refs: ws.refs, brand: ws.brand, people: ws.personaIds, output: currentOutput(), sketch: ws.sketch };
  const updated = { ...project, inputs };
  useWorkspace.setState({ projects: useWorkspace.getState().projects.map((p) => (p.id === updated.id ? updated : p)) });
  await db.putProject(updated);
}

/** The report of any error: its message, the provider's response, and the job's log when there is one. */
export function errorReport(error: unknown, context?: JobContext): ErrorReport {
  const info = explainError(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return {
    message: info.message,
    status: info.status,
    details: info.details,
    log: context ? errorLog(error, context) : [`${error instanceof Error || error instanceof DOMException ? error.name : typeof error}: ${info.message}`, stack].filter(Boolean).join('\n\n'),
  };
}

/** Shows an error with a button to its technical details. Returns its translated title. */
export function toastError(error: unknown, context?: JobContext): { title: string; report: ErrorReport } {
  const info = explainError(error);
  const report = errorReport(error, context);
  if (!isAbort(error)) {
    toast.error(t(info.key), {
      description: info.message,
      // Kept until closed: the details are read when it fails, not ten seconds later.
      duration: Infinity,
      closeButton: true,
      action: { label: t('errors.details'), onClick: () => useWorkspace.getState().showError(report) },
    });
  }
  return { title: t(info.key), report };
}

/** What the next edit sends, for the eye of the edit bar. */
export interface EditPreview {
  region: boolean;
  prompt: string;
  params: GenerationParams;
  images: Array<{ blob: Blob; role: 'current' | 'marked' | 'person'; person?: string }>;
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
  /** The versions a new one is being saved after. */
  const savingAfter = new Set<string>();

  async function saveVersion(input: Omit<VersionInput, 'width' | 'height'> & { show?: boolean }): Promise<Generation> {
    const { show = true, ...rest } = input;
    // The one rule of the history: nothing follows an older version. Claimed before
    // waiting, as two saves at once (agents call in parallel) would both pass otherwise.
    const parentId = input.parent?.id;
    if (parentId && (isOlderVersion(get().generations, parentId) || savingAfter.has(parentId))) throw new Error(t('versions.olderLocked'));
    if (parentId) savingAfter.add(parentId);
    try {
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
    } finally {
      if (parentId) savingAfter.delete(parentId);
    }
  }

  /** Deletes versions at once, and everything that pointed at them. */
  async function dropVersions(removed: Generation[], selectAfter: (remaining: Generation[], selectedId: string | null) => string | null) {
    await db.deleteGenerations(removed.map((g) => g.id));
    // Read after the wait: a favourite may have changed meanwhile.
    const { generations, selectedId, pickedIds, ranking, projects, projectId } = get();
    const isRemoved = (id?: string) => removed.some((g) => g.id === id);
    const remaining = generations.filter((g) => !isRemoved(g.id));
    // Versions can share a Blob in memory: only free it once unused.
    for (const { blob } of removed) if (!remaining.some((g) => g.blob === blob)) revoke(blob);
    const next = selectAfter(remaining, selectedId);
    if (next !== selectedId) get().setTool(null);
    set({
      generations: remaining,
      selectedId: next,
      pickedIds: pickedIds.filter((picked) => !isRemoved(picked)),
      // It was made from a set that no longer exists.
      ranking: pickedIds.some(isRemoved) ? null : ranking,
    });
    // A channel page's video goes with its title, or the next image placed there would inherit it.
    const slots = projects.find((p) => p.id === projectId)?.channelPage?.slots;
    if (slots?.some((slot) => isRemoved(slot?.id))) await get().updateChannelPage({ slots: slots.map((slot) => (isRemoved(slot?.id) ? {} : slot)) });
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
    people: Blob[] = [],
  ) {
    const highlighted = await highlightRegion(source.blob, mask);
    return runJob({
      kind: 'region',
      action,
      prompt,
      fullPrompt,
      // Clean image first (what gets edited), marked copy second (where to edit):
      // sending only the marked copy lets the magenta tint bleed into the result.
      images: [source.blob, highlighted, ...people],
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

  /**
   * Selected people are sent again with an edit, so their identity doesn't drift over successive edits.
   * `sent`: the images of the thumbnail sent before them (a region edit adds the marked copy).
   */
  function editPeople(sent = 1) {
    return personaImages().slice(0, MAX_IMAGES - sent);
  }

  /** The people of an edit as the edit bar's eye lists them. */
  function sentPeople(people: ReturnType<typeof editPeople>) {
    return people.map(({ blob, role }) => ({ blob, role: 'person' as const, person: role.kind === 'persona' ? role.name : undefined }));
  }

  /** What a concept's preview is generated with. */
  function conceptParams(): GenerationParams {
    return { ...useSettings.getState().params(), model: 'nano-banana-2-lite', resolution: '1K' };
  }

  /** Images and full prompt for the current brief, shared by `generate` and `previewPrompt`. */
  function generationRequest(concept?: Concept, fromAgent = false) {
    const { brief } = get();
    const style = findStyle(concept?.styleId ?? brief.styleId, get().customStyles);
    // A concept is previewed from its text alone: no photos or references to send.
    const attached = concept ? [] : [...personaImages(), ...referenceImages()];
    // From the Gribouillis view, the sketch comes first (its PNG is drawn by `generate`).
    const sketchView = !concept && !fromAgent && get().view === 'sketch';
    const withSketch = sketchView && hasSketch();
    const roles: ImageRole[] = [...(withSketch ? [{ kind: 'sketch' as const }] : []), ...attached.map((a) => a.role)];
    const fullPrompt = buildGenerationPrompt({
      brief: concept?.brief ?? brief.brief,
      videoTitle: brief.videoTitle,
      aspectRatio: useSettings.getState().aspectRatio,
      lang: promptLang(),
      style: style?.prompt[promptLang()],
      roles,
      sketchView,
      colors: get().brand.colors,
      options: resolveOptions(style, brief.options),
    });
    return { attached, fullPrompt, withSketch, imageCount: roles.length };
  }

  /** Something drawn on the sheet: from the Gribouillis view, it is sent as image 1. */
  function hasSketch(): boolean {
    return !isEmptySketch(get().sketch);
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
    // Before paying for an image that couldn't be saved.
    const parentId = opts.parent?.id;
    if (parentId && (isOlderVersion(get().generations, parentId) || get().jobs.some((j) => j.status === 'running' && j.parentId === parentId))) return { error: t('versions.olderLocked') };
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

    let step: JobStep = 'prepare';
    try {
      const images = await Promise.all(opts.images.map((b) => prepareReference(b, opts.reference?.maxSide, opts.reference?.bytes)));
      step = 'call';
      let blob = await generateImage({
        prompt: opts.fullPrompt,
        images,
        params: opts.params,
        apiKey: opts.apiKey,
        signal: job.controller.signal,
        onProgress: (elapsed) => patchJob({ elapsed }),
      });
      step = 'finalize';
      if (opts.finalize) blob = await opts.finalize(blob);
      step = 'save';
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
      const { title, report } = toastError(error, {
        at: Date.now(),
        step,
        kind: opts.kind,
        action: opts.action,
        params: opts.params,
        images: opts.images,
        promptLength: opts.fullPrompt.length,
        elapsedMs: Date.now() - job.startedAt,
        userAgent: navigator.userAgent,
        secret: opts.apiKey,
      });
      patchJob({ status: 'failed', error: title, report });
      return { error: title };
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
    sketch: EMPTY_SKETCH,
    safeZones: false,
    tool: null,
    hasMask: false,
    ranking: null,
    ranking_busy: false,
    lastError: null,

    init: async () => {
      const [projects, library, personas, customStyles] = await Promise.all([db.listProjects(), db.listLibrary(), db.listPersonas(), db.listStyles()]);
      set({ customStyles });
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
      const inputs = get().projects.find((p) => p.id === id)?.inputs;
      if (!inputs) return;
      await flushSave();
      loadedProjectId = null;
      get().generations.forEach((g) => revoke(g.blob));
      const generations = await db.listGenerations(id);
      const { personas } = get();
      get().setTool(null);
      useSettings.getState().set(inputs.output);
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
        sketch: isSketch(inputs.sketch) ? inputs.sketch : EMPTY_SKETCH,
      });
      loadedProjectId = id;
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
          toastError(error).title;
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
      return regionEdit({ ...source, blob: patched }, mask, t('heal.done'), buildHealPrompt(promptLang()), apiKey, 'heal', 'nano-banana-2');
    },

    fixFace: async (personaId) => {
      const source = selectedGeneration(get());
      const person = get().personas.find((p) => p.id === personaId);
      if (!source || !person || !get().hasMask || !maskCanvas) return null;
      const apiKey = checkKey();
      if (!apiKey) return null;
      // The thumbnail and its marked copy come first.
      const photos = personaImages([personaId]).slice(0, MAX_IMAGES - 2);
      const mask = snapshotMask(maskCanvas);
      const prompt = buildFaceFixPrompt(promptLang(), photos.map((p) => p.role));
      // Always Nano Banana Pro, whatever the model chosen for generating: the most faithful to a face.
      return regionEdit(source, mask, t('face.done', { name: person.name }), prompt, apiKey, 'face', 'nano-banana-pro', photos.map((p) => p.blob));
    },

    duplicateVersion: async (id) => {
      const source = get().generations.find((g) => g.id === id);
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
        toastError(error).title;
        return null;
      }
    },

    previewPrompt: () => generationRequest().fullPrompt,

    promptOptions: () => resolveOptions(findStyle(get().brief.styleId, get().customStyles), get().brief.options),

    previewImageLines: () => {
      // After the sketch, from the Gribouillis view: the numbers move up by one.
      const sketch: ImageRole[] = get().view === 'sketch' && hasSketch() ? [{ kind: 'sketch' }] : [];
      const people = personaImages().map((a) => a.role);
      const references = referenceImages().map((a) => a.role);
      const lang = promptLang();
      const head = sketch.length ? [imagesHeader(lang), ...describeImages(lang, sketch)] : [];
      return {
        people: (people.length ? [identityLine(lang, [...sketch, ...people]), '', ...(sketch.length ? head : [imagesHeader(lang)]), ...describeImages(lang, people, sketch.length)] : []).join('\n'),
        references: (references.length && !people.length ? (sketch.length ? head : [imagesHeader(lang)]) : [])
          .concat(describeImages(lang, references, sketch.length + people.length))
          .join('\n'),
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
        // Its own Blob: each click is an independent thumbnail, as with `duplicateVersion`.
        blob: new Blob([blob], { type: blob.type }),
      }),

    generate: async ({ fromAgent = false } = {}) => {
      const { brief } = get();
      const sketchView = !fromAgent && get().view === 'sketch';
      // From the Gribouillis view, the sketch may say it all; never a call with nothing to go on.
      if (!brief.brief.trim() && !(sketchView && hasSketch())) return fail(t(sketchView ? 'sketch.needSketch' : 'brief.needPrompt'));
      const apiKey = checkKey();
      if (!apiKey) return [{ error: t('brief.needKey') }];

      const settings = useSettings.getState();
      const { attached, fullPrompt, withSketch, imageCount } = generationRequest(undefined, fromAgent);
      if (imageCount > MAX_IMAGES) return fail(t('brief.tooManyRefs'));
      const params = settings.params();
      const blobs = attached.map((a) => a.blob);
      if (withSketch) blobs.unshift(await sketchBlob(get().sketch, settings.aspectRatio));
      // The results show in the image view; the sketch stays as it is for another try.
      if (get().view === 'compare' || sketchView) set({ view: 'image' });
      const batch = { shown: false };

      return Promise.all(
        Array.from({ length: settings.count }, () =>
          runJob({
            kind: 'generate',
            prompt: brief.brief.trim() || t('sketch.versionPrompt'),
            fullPrompt,
            images: blobs,
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
        fullPrompt: buildUpscalePrompt(promptLang()),
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
        const people = editPeople(2);
        return {
          region: true,
          prompt: buildRegionEditPrompt(promptLang(), text, people.map((p) => p.role)),
          params,
          images: [{ blob: source.blob, role: 'current' }, { blob: await highlightRegion(source.blob, mask), role: 'marked' }, ...sentPeople(people)],
        };
      }
      const people = editPeople();
      return {
        region: false,
        prompt: buildEditPrompt(promptLang(), text, people.map((p) => p.role)),
        params,
        images: [{ blob: source.blob, role: 'current' }, ...sentPeople(people)],
      };
    },

    edit: async (instruction, opts) => {
      const source = get().generations.find((g) => g.id === get().selectedId);
      if (!source || !instruction.trim()) return [];
      const apiKey = checkKey();
      if (!apiKey) return [{ error: t('brief.needKey') }];

      const painted = paintedMask();
      const mask = opts?.mask ?? (painted ? snapshotMask(painted) : null);
      if (mask) {
        const people = editPeople(2);
        const prompt = buildRegionEditPrompt(promptLang(), instruction, people.map((p) => p.role));
        return [await regionEdit(source, mask, instruction, prompt, apiKey, undefined, undefined, people.map((p) => p.blob))];
      }

      const people = editPeople();
      const outcome = await runJob({
        kind: 'edit',
        prompt: instruction,
        fullPrompt: buildEditPrompt(promptLang(), instruction, people.map((p) => p.role)),
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

    revertTo: async (id) => {
      if (get().jobs.some((j) => j.status === 'running')) return;
      const removed = versionsAfter(get().generations, id);
      if (!removed.length) return;
      await dropVersions(removed, () => id);
    },

    removeThumbnail: async (id) => {
      if (get().jobs.some((j) => j.status === 'running')) return;
      const removed = historyOf(get().generations, id);
      if (!removed.length) return;
      await dropVersions(removed, (remaining, selectedId) => (remaining.some((g) => g.id === selectedId) ? selectedId : (remaining[0]?.id ?? null)));
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
        return { error: toastError(error).title };
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
      // Image tools work on the image view only.
      if (view === 'sketch' && get().tool) get().setTool(null);
      set({ view });
    },

    addSketchStroke: (stroke) => {
      set({ sketch: addStroke(get().sketch, stroke) });
      scheduleSave();
    },

    undoSketchStroke: () => {
      set({ sketch: undoStroke(get().sketch) });
      scheduleSave();
    },

    clearSketch: () => {
      set({ sketch: EMPTY_SKETCH });
      scheduleSave();
    },
    setSafeZones: (on) => set({ safeZones: on }),
    setTool: (tool) => {
      // Tools make versions: not from an older one.
      if (tool && viewingOlder(get())) return;
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
          fullPrompt: buildOutpaintPrompt(promptLang()),
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
        toastError(error).title;
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
        toastError(error).title;
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

/** The selected version is an older one: it can be looked at, not edited. */
export function viewingOlder(s: Pick<WorkspaceState, 'generations' | 'selectedId'>): boolean {
  return !!s.selectedId && isOlderVersion(s.generations, s.selectedId);
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
