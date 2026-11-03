import { generateJSON, type TextRequest } from './providers';
import { prepareReference } from './images';

type Auth = Pick<TextRequest, 'provider' | 'apiKey' | 'signal'>;
type Lang = 'en' | 'fr';

const LANG_NAME: Record<Lang, string> = { en: 'anglais', fr: 'français' };

/** Thumbnails are judged at the size they're actually seen, so no need for full resolution. */
const toVisionInput = (blob: Blob) => prepareReference(blob, 1024, 200_000);

const CRITIC_SYSTEM = `Tu es un stratège senior du packaging YouTube qui a analysé des milliers de miniatures.
Tu juges les miniatures comme les spectateurs les découvrent : en une fraction de seconde, en petit, parmi beaucoup d’autres dans un fil.
Sois précis et concret. Appuie-toi sur des éléments réels de l’image. Ne sois jamais générique ni flatteur.`;

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
  const prompt = `Ces ${images.length} images sont des miniatures alternatives pour la même vidéo${context.videoTitle ? ` intitulée "${context.videoTitle}"` : ''}, numérotées de 1 à ${images.length} dans l’ordre.
Classe-les selon la probabilité qu’un spectateur qui fait défiler un fil YouTube sur son téléphone clique, tout en restant fidèles au titre.
Réponds uniquement en JSON :
{"order": [<numéros des images, de la meilleure à la moins bonne>], "reasons": ["<une phrase par image, dans l’ordre d’origine 1..${images.length}>"], "winnerWhy": "<deux phrases expliquant pourquoi la gagnante l’emporte>"}
Rédige en ${LANG_NAME[context.lang]}.`;

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

function styleEntry({ id, name, hint, prompt }: ConceptStyle): string {
  const entry = `- ${id} : ${name}${hint ? ` (${hint})` : ''}.`;
  return prompt.trim().startsWith('- ') ? `${entry}\n${prompt.trim().replace(/^/gm, '  ')}` : `${entry} ${prompt}`;
}

export interface ConceptsInput {
  videoTitle: string;
  lang: Lang;
  styles: ConceptStyle[];
}

const CONCEPTS_SYSTEM = 'Tu es un grand stratège des miniatures YouTube. Tu raisonnes en termes de curiosité, d’enjeux et de visuels lisibles au premier regard.';

function conceptsUserPrompt(input: ConceptsInput): string {
  return `Titre de la vidéo : "${input.videoTitle}"

Propose 3 concepts de miniature aux angles vraiment différents (par exemple réaction émotionnelle, résultat ou transformation, mystère ou objet). Pour chacun :
- name : 2 à 4 mots
- brief : une description de scène vivante pour un modèle d’image (sujet, action, émotion, composition, fond, lumière), en 2 ou 3 phrases, rédigée en ${LANG_NAME[input.lang]}
- points : la même scène en 3 ou 4 puces très courtes (8 mots maximum chacune), en ${LANG_NAME[input.lang]}
- why : une phrase en ${LANG_NAME[input.lang]} expliquant pourquoi elle donnerait envie de cliquer
- styleId : l’identifiant du style le plus adapté dans la liste ci-dessous, ou "" si aucun ne convient

Styles disponibles (identifiant : nom, usages, direction artistique) :
${input.styles.map(styleEntry).join('\n')}

Réponds uniquement en JSON : {"concepts": [{"name": "", "brief": "", "points": [""], "why": "", "styleId": ""}]}`;
}

/** The whole text sent for the concepts, as the assistant shows it. */
export function conceptsPrompt(input: ConceptsInput): string {
  return `${CONCEPTS_SYSTEM}\n\n${conceptsUserPrompt(input)}`;
}

export async function suggestConcepts(auth: Auth, input: ConceptsInput): Promise<Concept[]> {
  const raw = await generateJSON<{ concepts: Concept[] }>({
    ...auth,
    system: CONCEPTS_SYSTEM,
    prompt: conceptsUserPrompt(input),
  });
  return (raw.concepts ?? []).slice(0, 3);
}
