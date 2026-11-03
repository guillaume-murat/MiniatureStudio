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
  brief: string;
  why: string;
  styleId?: string;
}

export async function suggestConcepts(
  auth: Auth,
  input: { videoTitle: string; idea: string; lang: Lang; styles: Array<{ id: string; name: string }> },
): Promise<Concept[]> {
  const prompt = `Titre de la vidéo : "${input.videoTitle || '(pas encore de titre)'}"
Idée de départ du créateur : "${input.idea || '(aucune)'}"

Propose 3 concepts de miniature aux angles vraiment différents (par exemple réaction émotionnelle, résultat ou transformation, mystère ou objet). Pour chacun :
- name : 2 à 4 mots
- brief : une description de scène vivante pour un modèle d’image (sujet, action, émotion, composition, fond, lumière), en 2 ou 3 phrases, rédigée en ${LANG_NAME[input.lang]}
- why : une phrase en ${LANG_NAME[input.lang]} expliquant pourquoi elle donnerait envie de cliquer
- styleId : l’identifiant le plus adapté dans cette liste, ou "" : ${input.styles.map((s) => `${s.id} (${s.name})`).join(', ')}

Réponds uniquement en JSON : {"concepts": [{"name": "", "brief": "", "why": "", "styleId": ""}]}`;

  const raw = await generateJSON<{ concepts: Concept[] }>({
    ...auth,
    system: 'Tu es un grand stratège des miniatures YouTube. Tu raisonnes en termes de curiosité, d’enjeux et de visuels lisibles au premier regard.',
    prompt,
  });
  return (raw.concepts ?? []).slice(0, 3);
}
