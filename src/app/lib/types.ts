export type Provider = 'replicate' | 'gemini' | 'openrouter' | 'mammouth' | 'vertex';
export type ModelId = 'nano-banana-pro' | 'nano-banana-2' | 'nano-banana-2-lite';
/** The ratio of an existing image: older ones may be in a format the studio no longer generates, and their edits keep it. */
export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1' | '21:9';
/** The formats a new image can have. */
export type OutputRatio = '16:9' | '9:16';
export type Resolution = '1K' | '2K' | '4K';
export type OutputFormat = 'png' | 'jpg';
export type SafetyLevel = 'block_only_high' | 'block_medium_and_above' | 'block_low_and_above';

export interface GenerationParams {
  provider: Provider;
  model: ModelId;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  format: OutputFormat;
  safety: SafetyLevel;
}

/** How an image came to exist: fresh generation, whole-image edit, masked edit, or imported. */
export type GenerationKind = 'generate' | 'edit' | 'region' | 'import' | 'text' | 'upscale';

/** The tool behind a version, when its kind alone doesn't say it (named in the versions panel). */
export type GenerationAction = 'reframe' | 'smooth' | 'heal' | 'arrow';

export interface Generation {
  id: string;
  projectId: string;
  /** Image this one was derived from (edit / region edit). */
  parentId?: string;
  kind: GenerationKind;
  action?: GenerationAction;
  /** What the user typed (brief or edit instruction). */
  prompt: string;
  /** Exact prompt sent to the model, kept for transparency and reuse. */
  fullPrompt: string;
  /**
   * Editable text added with the text tool: `blob` is `base` with the blocks drawn
   * on it. Dropped when the user merges the text into the image.
   */
  videoTitle?: string;
  params: GenerationParams;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
  favorite?: boolean;
}

export interface Project {
  id: string;
  name: string;
  videoTitle?: string;
  channelPage?: ChannelPage;
  /** Everything in the brief panel, as left in this project (older projects get it on first open). */
  inputs?: ProjectInputs;
  createdAt: number;
  updatedAt: number;
}

export type TitleZone = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right' | 'none';

/** The advanced options of the brief panel. Absent values come from the style's preset. */
export interface PromptOptions {
  text?: 'none' | 'style';
  titleZone?: TitleZone;
  brandWeight?: 'subtle' | 'accents' | 'dominant';
}

export type ResolvedPromptOptions = Required<PromptOptions>;

/** The brief panel of a project: each project starts empty and keeps its own. Only app settings (provider, keys, theme, language) are shared. */
export interface ProjectInputs {
  brief: { videoTitle: string; brief: string; styleId: string; options?: PromptOptions };
  refs: RefImage[];
  brand: BrandKit;
  /** The people in this project's thumbnails, at most 5 (records in the `personas` store, a library shared by all projects). */
  people: string[];
  output: ProjectOutput;
}

export type ProjectOutput = Pick<GenerationParams, 'model' | 'aspectRatio' | 'resolution' | 'format' | 'safety'> & { count: 1 | 2 | 4 };

/** The channel page preview of a project: what its six videos show. */
export interface ChannelPage {
  /** Per video: the version placed there (else filled from the project) and its title (else the video title). */
  slots: Array<{ id?: string; title?: string }>;
  dark: boolean;
  /** Seed of the random views, durations and upload ages. */
  seed: number;
}

export type PersonaPhotoSlot = 'front' | 'left' | 'right' | 'expression';

export interface PersonaPhoto {
  id: string;
  slot: PersonaPhotoSlot;
  /** Free label for expression photos, e.g. "surprised", "laughing". */
  expression?: string;
  blob: Blob;
}

/** A style the user wrote, shared by every project. */
export interface CustomStyle {
  id: string;
  name: string;
  hint?: string;
  emoji: string;
  prompt: string;
  /** The style itself puts text in the image: the prompt then allows it (`text` preset). */
  addsText?: boolean;
  createdAt: number;
}

export interface Persona {
  id: string;
  name: string;
  description?: string;
  photos: PersonaPhoto[];
  createdAt: number;
}

export interface LibraryImage {
  id: string;
  blob: Blob;
  createdAt: number;
}

/** The channel: shown in the feed and channel previews; its colours also go into the prompt. */
export interface BrandKit {
  id: 'default';
  channelName: string;
  /** Channel profile picture (previews only, never sent to the image model). */
  logo?: Blob;
  colors: string[];
  /** Channel page preview details. */
  banner?: Blob;
  handle?: string;
  subscribers?: number;
  videoCount?: number;
  description?: string;
  verified?: boolean;
  updatedAt: number;
}

export type RefSource = 'upload' | 'persona' | 'library' | 'history' | 'youtube';

/** An image attached to the current brief. */
export type ReferenceUse = 'free' | 'composition' | 'style' | 'object' | 'background';

export interface RefImage {
  id: string;
  blob: Blob;
  source: RefSource;
  personaId?: string;
  label?: string;
  /** What the image is for; absent = as the brief says. */
  use?: ReferenceUse;
}
