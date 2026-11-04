import { generateJSON, type TextRequest } from './providers';
import { prepareReference } from './images';
import type { Lang } from './types';

type Auth = Pick<TextRequest, 'provider' | 'apiKey' | 'signal'>;
/** Thumbnails are judged at the size they're actually seen, so no need for full resolution. */
const toVisionInput = (blob: Blob) => prepareReference(blob, 1024, 200_000);

/** Every prompt is written in the interface's language, and so are the answers. */
const CRITIC_SYSTEM: Record<Lang, string> = {
  fr: `Tu es un stratège senior du packaging YouTube qui a analysé des milliers de miniatures.
Tu juges les miniatures comme les spectateurs les découvrent : en une fraction de seconde, en petit, parmi beaucoup d’autres dans un fil.
Sois précis et concret. Appuie-toi sur des éléments réels de l’image. Ne sois jamais générique ni flatteur.`,
  en: `You are a senior YouTube packaging strategist who has analysed thousands of thumbnails.
You judge thumbnails the way viewers discover them: in a split second, small, among many others in a feed.
Be precise and concrete. Rely on real elements of the image. Never be generic or flattering.`,
};

const RANK_PROMPT: Record<Lang, (count: number, videoTitle?: string) => string> = {
  fr: (count, videoTitle) => `Ces ${count} images sont des miniatures alternatives pour la même vidéo${videoTitle ? ` intitulée "${videoTitle}"` : ''}, numérotées de 1 à ${count} dans l’ordre.
Classe-les selon la probabilité qu’un spectateur qui fait défiler un fil YouTube sur son téléphone clique, tout en restant fidèles au titre.
Réponds uniquement en JSON :
{"order": [<numéros des images, de la meilleure à la moins bonne>], "reasons": ["<une phrase par image, dans l’ordre d’origine 1..${count}>"], "winnerWhy": "<deux phrases expliquant pourquoi la gagnante l’emporte>"}
Rédige en français.`,
  en: (count, videoTitle) => `These ${count} images are alternative thumbnails for the same video${videoTitle ? ` titled "${videoTitle}"` : ''}, numbered 1 to ${count} in order.
Rank them by how likely a viewer scrolling a YouTube feed on their phone is to click, while staying true to the title.
Answer only in JSON:
{"order": [<image numbers, from best to worst>], "reasons": ["<one sentence per image, in the original order 1..${count}>"], "winnerWhy": "<two sentences explaining why the winner wins>"}
Write in English.`,
};

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
  const prompt = RANK_PROMPT[context.lang](images.length, context.videoTitle);

  const raw = await generateJSON<Ranking>({
    ...auth,
    system: CRITIC_SYSTEM[context.lang],
    prompt,
    images: await Promise.all(images.map(toVisionInput)),
  });
  const order = (raw.order ?? []).map((n) => Number(n) - 1).filter((i) => i >= 0 && i < images.length);
  for (let i = 0; i < images.length; i++) if (!order.includes(i)) order.push(i);
  return { order, reasons: raw.reasons ?? [], winnerWhy: raw.winnerWhy ?? '' };
}

export interface Concept {
  name: string;
  /** The scene as sent to the image model: natural sentences. */
  brief: string;
  /** The same scene, to read at a glance. */
  points?: string[];
  why: string;
  styleId?: string;
}

/** What the assistant lists for a concept: its points, or the sentences of its brief if the model gave none. */
export function conceptPoints({ points, brief }: Pick<Concept, 'points' | 'brief'>): string[] {
  const given = Array.isArray(points) ? points.map((p) => String(p).trim()).filter(Boolean) : [];
  return given.length ? given : brief.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** A concept as it fills the brief's idea: its points, one per line. */
export function conceptIdea(concept: Pick<Concept, 'points' | 'brief'>): string {
  return conceptPoints(concept).map((point) => `- ${point}`).join('\n');
}

/** A style of the library, as the model chooses among them. */
export interface ConceptStyle {
  id: string;
  name: string;
  hint: string;
  prompt: string;
}

function styleEntry(lang: Lang, { id, name, hint, prompt }: ConceptStyle): string {
  const entry = `- ${id}${lang === 'fr' ? ' :' : ':'} ${name}${hint ? ` (${hint})` : ''}.`;
  return prompt.trim().startsWith('- ') ? `${entry}\n${prompt.trim().replace(/^/gm, '  ')}` : `${entry} ${prompt}`;
}

export interface ConceptsInput {
  videoTitle: string;
  lang: Lang;
  styles: ConceptStyle[];
}

const CONCEPTS_SYSTEM: Record<Lang, string> = {
  fr: 'Tu es un grand stratège des miniatures YouTube. Tu raisonnes en termes de curiosité, d’enjeux et de visuels lisibles au premier regard.',
  en: 'You are a leading YouTube thumbnail strategist. You think in terms of curiosity, stakes and visuals readable at first glance.',
};

function conceptsUserPrompt(input: ConceptsInput): string {
  const styles = input.styles.map((style) => styleEntry(input.lang, style)).join('\n');
  return input.lang === 'fr'
    ? `Titre de la vidéo : "${input.videoTitle}"

Propose 3 concepts de miniature aux angles vraiment différents (par exemple réaction émotionnelle, résultat ou transformation, mystère ou objet). Pour chacun :
- name : 2 à 4 mots
- brief : une description de scène vivante pour un modèle d’image (sujet, action, émotion, composition, fond, lumière), en 2 ou 3 phrases, rédigée en français
- points : la même scène en 3 ou 4 puces très courtes (8 mots maximum chacune), en français
- why : une phrase en français expliquant pourquoi elle donnerait envie de cliquer
- styleId : l’identifiant du style le plus adapté dans la liste ci-dessous, ou "" si aucun ne convient

Styles disponibles (identifiant : nom, usages, direction artistique) :
${styles}

Réponds uniquement en JSON : {"concepts": [{"name": "", "brief": "", "points": [""], "why": "", "styleId": ""}]}`
    : `Video title: "${input.videoTitle}"

Suggest 3 thumbnail concepts with genuinely different angles (for example emotional reaction, result or transformation, mystery or object). For each one:
- name: 2 to 4 words
- brief: a vivid scene description for an image model (subject, action, emotion, composition, background, lighting), in 2 or 3 sentences, written in English
- points: the same scene as 3 or 4 very short bullets (8 words maximum each), in English
- why: one sentence in English explaining why it would make people want to click
- styleId: the id of the best-suited style in the list below, or "" if none fits

Available styles (id: name, uses, art direction):
${styles}

Answer only in JSON: {"concepts": [{"name": "", "brief": "", "points": [""], "why": "", "styleId": ""}]}`;
}

/** The whole text sent for the concepts, as the assistant shows it. */
export function conceptsPrompt(input: ConceptsInput): string {
  return `${CONCEPTS_SYSTEM[input.lang]}\n\n${conceptsUserPrompt(input)}`;
}

export async function suggestConcepts(auth: Auth, input: ConceptsInput): Promise<Concept[]> {
  const raw = await generateJSON<{ concepts: Concept[] }>({
    ...auth,
    system: CONCEPTS_SYSTEM[input.lang],
    prompt: conceptsUserPrompt(input),
  });
  return (raw.concepts ?? []).slice(0, 3);
}
