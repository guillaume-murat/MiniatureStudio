import { generateJSON, type TextRequest } from './providers';
import { prepareReference } from './images';

type Auth = Pick<TextRequest, 'provider' | 'apiKey' | 'signal'>;
type Lang = 'en' | 'fr';

const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French' };

/** Thumbnails are judged at the size they're actually seen, so no need for full resolution. */
const toVisionInput = (blob: Blob) => prepareReference(blob, 1024, 200_000);

const CRITIC_SYSTEM = `You are a senior YouTube packaging strategist who has reviewed thousands of thumbnails.
You judge thumbnails the way viewers meet them: a split second, at small size, among many others in a feed.
Be specific and actionable. Refer to concrete elements in the image. Never be generic or flattering.`;

export interface Ranking {
  /** Indices into the submitted images, best first. */
  order: number[];
  reasons: string[];
  winnerWhy: string;
}

export async function rankThumbnails(
  auth: Auth,
  images: Blob[],
  context: { videoTitle?: string; lang: Lang },
): Promise<Ranking> {
  const prompt = `These ${images.length} images are alternative thumbnails for the same video${context.videoTitle ? ` titled "${context.videoTitle}"` : ''}, numbered 1 to ${images.length} in order.
Rank them by how likely a viewer scrolling a YouTube feed on a phone is to click, while still matching the title.
Return JSON only:
{"order": [<image numbers, best first>], "reasons": ["<one sentence per image, in the original order 1..${images.length}>"], "winnerWhy": "<two sentences on why the winner wins>"}
Write in ${LANG_NAME[context.lang]}.`;

  const raw = await generateJSON<Ranking>({
    ...auth,
    system: CRITIC_SYSTEM,
    prompt,
    images: await Promise.all(images.map(toVisionInput)),
  });
  const order = (raw.order ?? []).map((n) => Number(n) - 1).filter((i) => i >= 0 && i < images.length);
  for (let i = 0; i < images.length; i++) if (!order.includes(i)) order.push(i);
  return { order, reasons: raw.reasons ?? [], winnerWhy: raw.winnerWhy ?? '' };
}

export interface Concept {
  name: string;
  brief: string;
  why: string;
  styleId?: string;
}

export async function suggestConcepts(
  auth: Auth,
  input: { videoTitle: string; idea: string; lang: Lang; styles: Array<{ id: string; name: string }> },
): Promise<Concept[]> {
  const prompt = `Video title: "${input.videoTitle || '(none yet)'}"
Creator's rough idea: "${input.idea || '(none)'}"

Propose 3 thumbnail concepts that take genuinely different angles (e.g. emotional reaction vs. result/transformation vs. mystery/object). For each:
- name: 2-4 words
- brief: a vivid scene description for an image model (subject, action, emotion, composition, background, lighting), 2-3 sentences, written in ${LANG_NAME[input.lang]}
- why: one sentence in ${LANG_NAME[input.lang]} on why it would get clicks
- styleId: the best matching id from this list, or "" : ${input.styles.map((s) => `${s.id} (${s.name})`).join(', ')}

Return JSON only: {"concepts": [{"name": "", "brief": "", "why": "", "styleId": ""}]}`;

  const raw = await generateJSON<{ concepts: Concept[] }>({
    ...auth,
    system: 'You are a top YouTube thumbnail strategist. You think in terms of curiosity gaps, stakes and instantly readable visuals.',
    prompt,
  });
  return (raw.concepts ?? []).slice(0, 3);
}
