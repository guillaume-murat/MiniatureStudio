import type { LayerBlock } from './textBlocks';

export type Provider = 'replicate' | 'gemini' | 'openrouter' | 'mammouth' | 'vertex';
export type ModelId = 'nano-banana-pro' | 'nano-banana-2';
export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1' | '21:9';
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
export type GenerationAction = 'reframe' | 'smooth' | 'heal';

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
  textLayer?: { base: Blob; blocks: LayerBlock[] };
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
  createdAt: number;
  updatedAt: number;
}

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
export interface RefImage {
  id: string;
  blob: Blob;
  source: RefSource;
  personaId?: string;
  label?: string;
}
