import { generateJSON, generateText, type TextRequest } from './providers';
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

/** A style of the library, as the model chooses among them. */
export interface ConceptStyle {
  id: string;
  name: string;
  hint: string;
  prompt: string;
}

function styleEntry({ id, name, hint, prompt }: ConceptStyle): string {
  return `- ${id} : ${name}${hint ? ` (${hint})` : ''}. ${prompt}`;
}

export interface ConceptsInput {
  videoTitle: string;
  idea: string;
  lang: Lang;
  styles: ConceptStyle[];
}

const CONCEPTS_SYSTEM = 'Tu es un grand stratège des miniatures YouTube. Tu raisonnes en termes de curiosité, d’enjeux et de visuels lisibles au premier regard.';

function conceptsUserPrompt(input: ConceptsInput): string {
  return `Titre de la vidéo : "${input.videoTitle || '(pas encore de titre)'}"
Idée de départ du créateur : "${input.idea || '(aucune)'}"

Propose 3 concepts de miniature aux angles vraiment différents (par exemple réaction émotionnelle, résultat ou transformation, mystère ou objet). Pour chacun :
- name : 2 à 4 mots
- brief : une description de scène vivante pour un modèle d’image (sujet, action, émotion, composition, fond, lumière), en 2 ou 3 phrases, rédigée en ${LANG_NAME[input.lang]}
- why : une phrase en ${LANG_NAME[input.lang]} expliquant pourquoi elle donnerait envie de cliquer
- styleId : l’identifiant du style le plus adapté dans la liste ci-dessous, ou "" si aucun ne convient

Styles disponibles (identifiant : nom, usages, direction artistique) :
${input.styles.map(styleEntry).join('\n')}

Réponds uniquement en JSON : {"concepts": [{"name": "", "brief": "", "why": "", "styleId": ""}]}`;
}

/** A concept's composition, to draw it without generating an image. Positions and sizes in % of the frame. */
export interface ConceptLayout {
  background: string;
  elements: Array<{ label: string; kind: 'person' | 'object' | 'text' | 'shape'; x: number; y: number; w: number; h: number; color: string }>;
}

const KINDS = ['person', 'object', 'text', 'shape'] as const;
const hexOr = (value: unknown, fallback: string) => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback);
const percent = (value: unknown) => Math.min(100, Math.max(0, Number(value) || 0));

/** What the model answered, made safe to draw: unknown colours and kinds replaced, boxes kept in the frame. */
export function cleanLayout(raw: Partial<ConceptLayout> | undefined): ConceptLayout {
  return {
    background: hexOr(raw?.background, '#334155'),
    elements: (Array.isArray(raw?.elements) ? raw.elements : []).slice(0, 8).map((e) => {
      const [x, y] = [percent(e?.x), percent(e?.y)];
      return {
        label: String(e?.label ?? '').slice(0, 24),
        kind: KINDS.includes(e?.kind) ? e.kind : 'shape',
        x,
        y,
        w: Math.min(percent(e?.w), 100 - x),
        h: Math.min(percent(e?.h), 100 - y),
        color: hexOr(e?.color, '#64748b'),
      };
    }),
  };
}

const describeConcept = (concept: Concept) => `Concept de miniature YouTube « ${concept.name} » : ${concept.brief}`;

export async function conceptLayout(auth: Auth, concept: Concept): Promise<ConceptLayout> {
  const raw = await generateJSON<Partial<ConceptLayout>>({
    ...auth,
    prompt: `${describeConcept(concept)}

Décris sa composition sous forme de maquette, avec 2 à 6 éléments.
- background : couleur dominante du fond, en hexadécimal
- elements : pour chaque élément, label (1 à 3 mots en français), kind ("person", "object", "text" ou "shape"), x et y (coin haut gauche) et w et h (taille), en pourcentage du cadre de 0 à 100, et color (couleur dominante en hexadécimal)

Réponds uniquement en JSON : {"background": "", "elements": [{"label": "", "kind": "", "x": 0, "y": 0, "w": 0, "h": 0, "color": ""}]}`,
  });
  return cleanLayout(raw);
}

export async function conceptAscii(auth: Auth, concept: Concept): Promise<string> {
  const raw = await generateText({
    ...auth,
    prompt: `${describeConcept(concept)}

Dessine sa composition en ASCII art : 64 colonnes sur 18 lignes, pour une image horizontale. Réponds uniquement avec le dessin, sans explication.`,
  });
  return raw.replace(/^\s*```\w*\n?/, '').replace(/```\s*$/, '').trimEnd();
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
