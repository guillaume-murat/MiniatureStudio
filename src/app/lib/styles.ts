import type { ConceptStyle } from './ai';
import { DEFAULT_PROMPT_OPTIONS } from './prompt';
import type { CustomStyle, Lang, PromptOptions, ResolvedPromptOptions } from './types';

/**
 * Thumbnail style presets. Each injects an art-direction fragment into the prompt.
 * The user's own styles (`CustomStyle`, shared by every project) work the same way.
 *
 * Based on current creator practice (1of10, vidIQ 2026 breakout study, Google's
 * Nano Banana guides). Composition rules are conventions, not proven CTR laws:
 * the point is to give the model a coherent, recognisable visual grammar.
 * « La personne mise en avant » (“the featured person”) is whoever is attached as a persona, if anyone.
 * Written in both languages, like every prompt; a user's own style stays as it was written.
 */
export interface StylePreset {
  id: string;
  name: { en: string; fr: string };
  hint: { en: string; fr: string };
  emoji: string;
  prompt: Record<Lang, string>;
  /** Written by the user, in the shared style library. */
  custom?: boolean;
  /** `text`: the style itself writes in the image. */
  preset?: { text?: 'style' };
}

const bullets = (...lines: string[]) => lines.map((line) => `- ${line}`).join('\n');

export const STYLES: StylePreset[] = [
  {
    id: 'reaction',
    emoji: '😲',
    name: { en: 'Reaction + object', fr: 'Réaction + objet' },
    hint: { en: 'Entertainment, reviews', fr: 'Divertissement, tests' },
    prompt: {
      fr: bullets(
        'Gros plan serré sur la personne mise en avant, sur un tiers du cadre',
        'Visage occupant environ un tiers de l’image, avec une réaction sincère et clairement lisible',
        'De l’autre côté, un seul objet principal, grand et net',
        'Fond propre et saturé',
        'Léger contre-jour qui détache le sujet',
      ),
      en: bullets(
        'Tight close-up of the featured person, on one third of the frame',
        'Face filling about a third of the image, with a sincere, clearly readable reaction',
        'On the other side, a single main object, large and sharp',
        'Clean, saturated background',
        'Slight backlight that separates the subject',
      ),
    },
  },
  {
    id: 'versus',
    emoji: '🆚',
    preset: { text: 'style' },
    name: { en: 'Versus', fr: 'Versus' },
    hint: { en: 'Comparisons, debates', fr: 'Comparatifs, débats' },
    prompt: {
      fr: bullets(
        'Composition divisée en deux',
        'Premier sujet sur une moitié gauche bleu froid',
        'Second sujet sur une moitié droite orange chaud',
        'Grand badge « VS » au centre',
        'Les deux sujets à la même échelle',
        'Éclairage de studio net',
        'Forte séparation entre les moitiés',
      ),
      en: bullets(
        'Composition split in two',
        'First subject on a cold blue left half',
        'Second subject on a warm orange right half',
        'Large “VS” badge in the centre',
        'Both subjects at the same scale',
        'Crisp studio lighting',
        'Strong separation between the halves',
      ),
    },
  },
  {
    id: 'before-after',
    emoji: '🔄',
    name: { en: 'Before / after', fr: 'Avant / après' },
    hint: { en: 'Transformations, results', fr: 'Transformations, résultats' },
    prompt: {
      fr: bullets(
        'Avant/après côte à côte, avec un cadrage identique sur les deux moitiés',
        'Moitié gauche désaturée, sombre et terne',
        'Moitié droite éclatante, soignée et lumineuse',
        'Séparation nette qui rend la transformation évidente',
      ),
      en: bullets(
        'Before/after side by side, with identical framing on both halves',
        'Left half desaturated, dark and dull',
        'Right half vibrant, polished and bright',
        'Clean split that makes the transformation obvious',
      ),
    },
  },
  {
    id: 'tech',
    emoji: '💻',
    preset: { text: 'style' },
    name: { en: 'Tech tutorial', fr: 'Tuto tech' },
    hint: { en: 'Dev, software, how-to', fr: 'Dev, logiciels, tutos' },
    prompt: {
      fr: bullets(
        'Style tech moderne et épuré',
        'La personne mise en avant d’un côté, l’air sûr d’elle',
        'À côté d’elle, un appareil ou un écran d’application flottant, à l’interface nette et lisible',
        'Fond en dégradé sombre et doux',
        'Lumière principale douce',
        'Beaucoup d’espace libre',
      ),
      en: bullets(
        'Clean, modern tech style',
        'The featured person on one side, looking confident',
        'Next to them, a device or a floating app screen, with a sharp, readable interface',
        'Soft, dark gradient background',
        'Soft key light',
        'Plenty of empty space',
      ),
    },
  },
  {
    id: 'cinematic',
    emoji: '🎬',
    name: { en: 'Cinematic documentary', fr: 'Documentaire cinéma' },
    hint: { en: 'History, true crime, essays', fr: 'Histoire, faits divers, essais' },
    prompt: {
      fr: bullets(
        'Plan large cinématographique, comme un photogramme de film',
        'Éclairage en clair-obscur dramatique',
        'Étalonnage sourd bleu-vert et ambre',
        'Léger grain argentique',
        'Faible profondeur de champ',
        'L’atmosphère et le mystère priment sur les couleurs vives',
      ),
      en: bullets(
        'Wide cinematic shot, like a film still',
        'Dramatic chiaroscuro lighting',
        'Muted teal and amber colour grade',
        'Light film grain',
        'Shallow depth of field',
        'Atmosphere and mystery matter more than bright colours',
      ),
    },
  },
  {
    id: 'minimal',
    emoji: '⬜',
    name: { en: 'Minimal bold', fr: 'Minimaliste' },
    hint: { en: 'Commentary, business', fr: 'Opinion, business' },
    prompt: {
      fr: bullets(
        'Graphisme minimaliste',
        'Fond uni d’une seule couleur forte',
        'Un seul petit élément marquant',
        'Beaucoup d’espace vide',
        'La typographie, s’il y en a, domine le cadre',
        'Rien d’autre ne détourne l’attention',
      ),
      en: bullets(
        'Minimalist graphics',
        'Plain background in a single strong colour',
        'A single small striking element',
        'Plenty of empty space',
        'Typography, if any, dominates the frame',
        'Nothing else distracts',
      ),
    },
  },
  {
    id: 'story',
    emoji: '⏱️',
    name: { en: 'Story moment', fr: 'Moment clé' },
    hint: { en: 'Challenges, narrative vlogs', fr: 'Défis, vlogs narratifs' },
    prompt: {
      fr: bullets(
        'Un seul instant de tension figé en pleine action',
        'Contre-plongée au grand-angle',
        'Issue visiblement incertaine, ce qui crée de la curiosité',
        'Composition en diagonale dynamique',
        'Couleurs naturelles mais percutantes',
      ),
      en: bullets(
        'A single moment of tension frozen mid-action',
        'Low-angle wide shot',
        'Visibly uncertain outcome, which creates curiosity',
        'Dynamic diagonal composition',
        'Natural but punchy colours',
      ),
    },
  },
  {
    id: 'ranking',
    emoji: '🏆',
    preset: { text: 'style' },
    name: { en: 'List / ranking', fr: 'Classement / top' },
    hint: { en: 'Top N, mistakes, tips', fr: 'Tops, erreurs, astuces' },
    prompt: {
      fr: bullets(
        'La personne mise en avant tient ou montre un objet principal',
        'Grand badge numéroté dans un coin supérieur',
        'Quelques objets plus petits disposés en éventail derrière',
        'Éclairage très contrasté',
        'Fond épuré',
      ),
      en: bullets(
        'The featured person holding or showing a main object',
        'Large numbered badge in an upper corner',
        'A few smaller objects fanned out behind',
        'High-contrast lighting',
        'Clean background',
      ),
    },
  },
  {
    id: 'gaming',
    emoji: '🎮',
    name: { en: 'Gaming', fr: 'Gaming' },
    hint: { en: "Let's plays, highlights", fr: 'Let’s play, highlights' },
    prompt: {
      fr: bullets(
        'Style gaming plein d’énergie',
        'La personne mise en avant éclairée par des néons violet et cyan, avec un fort contre-jour',
        'Une action de jeu qui explose derrière elle',
        'Composition en diagonale dynamique',
        'Accents lumineux et forte saturation',
      ),
      en: bullets(
        'High-energy gaming style',
        'The featured person lit by purple and cyan neon lights, with a strong backlight',
        'A game action exploding behind them',
        'Dynamic diagonal composition',
        'Glowing accents and high saturation',
      ),
    },
  },
  {
    id: 'finance',
    emoji: '💰',
    name: { en: 'Money / finance', fr: 'Argent / finance' },
    hint: { en: 'Finance, crypto, business', fr: 'Finance, crypto, business' },
    prompt: {
      fr: bullets(
        'La personne mise en avant à côté d’une immense flèche de graphique brillante (verte et montante, ou rouge et en chute, selon le brief)',
        'Un accessoire clairement lié à l’argent à proximité',
        'Fond sombre et fort contraste',
        'Expression sérieuse ou choquée',
      ),
      en: bullets(
        'The featured person next to a huge glossy chart arrow (green and rising, or red and falling, depending on the brief)',
        'A prop clearly linked to money nearby',
        'Dark background and high contrast',
        'Serious or shocked expression',
      ),
    },
  },
  {
    id: 'vlog',
    emoji: '✈️',
    name: { en: 'Vlog / travel', fr: 'Vlog / voyage' },
    hint: { en: 'Travel, lifestyle', fr: 'Voyage, lifestyle' },
    prompt: {
      fr: bullets(
        'Photo spontanée à l’heure dorée',
        'Sourire naturel',
        'Couleurs chaudes façon pellicule',
        'Prise à l’objectif 35 mm',
        'Lieu immédiatement reconnaissable, occupant une grande partie du cadre',
      ),
      en: bullets(
        'Candid golden-hour photo',
        'Natural smile',
        'Warm, film-like colours',
        'Shot on a 35 mm lens',
        'Instantly recognisable place, filling a large part of the frame',
      ),
    },
  },
  {
    id: 'hyper',
    emoji: '🤯',
    name: { en: 'Hyper-saturated', fr: 'Hyper-saturé' },
    hint: { en: 'Big challenges, stakes', fr: 'Gros défis, enjeux' },
    prompt: {
      fr: bullets(
        'Style ultra-lumineux et hyper-saturé',
        'Éclairage propre et brillant',
        'Couleurs primaires éclatantes',
        'Les personnes réagissent, les yeux écarquillés, face à quelque chose aux enjeux énormes et démesurés',
        'Tout est exagéré en taille et lisible au premier regard',
      ),
      en: bullets(
        'Ultra-bright, hyper-saturated style',
        'Clean, glossy lighting',
        'Vivid primary colours',
        'People reacting, wide-eyed, to something with huge, outsized stakes',
        'Everything is exaggerated in size and readable at first glance',
      ),
    },
  },
  {
    id: 'clay',
    emoji: '🧸',
    name: { en: '3D / clay', fr: '3D / pâte à modeler' },
    hint: { en: 'Explainers, faceless channels', fr: 'Vulgarisation, chaînes sans visage' },
    prompt: {
      fr: bullets(
        'Rendu sous forme de mignon diorama 3D en pâte à modeler brillante',
        'Éclairage de studio doux',
        'Fond pastel',
        'Effet miniature tilt-shift',
        'Formes arrondies, ludiques et tactiles',
      ),
      en: bullets(
        'Rendered as a cute 3D diorama in glossy modelling clay',
        'Soft studio lighting',
        'Pastel background',
        'Tilt-shift miniature effect',
        'Rounded, playful, tactile shapes',
      ),
    },
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    name: { en: 'Podcast / interview', fr: 'Podcast / interview' },
    hint: { en: 'Interviews, talk shows', fr: 'Interviews, talk-shows' },
    prompt: {
      fr: bullets(
        'Deux personnes en gros plan, face à face, avec des micros de podcast',
        'Studio flou en bokeh derrière elles',
        'Lumière principale douce et léger contre-jour',
        'Expressions saisies en pleine conversation, intenses et captivées',
      ),
      en: bullets(
        'Two people in close-up, facing each other, with podcast microphones',
        'Studio blurred in bokeh behind them',
        'Soft key light and slight backlight',
        'Expressions caught mid-conversation, intense and engaged',
      ),
    },
  },
];

/** The emoji of « Libre », no style at all. */
export const NO_STYLE_EMOJI = '✨';

/** Quick choices when writing a style. */
export const STYLE_EMOJIS = ['🎨', '🔥', '⚡', '🌈', '🌙', '🖤', '📸', '🎥', '🧠', '🚀', '👑', '💎', '🌿', '🍿', '📚', '🛠️'];

/** The user's styles first, then the presets, all in the same shape. */
export function allStyles(custom: CustomStyle[]): StylePreset[] {
  const own = custom.map((s) => ({
    id: s.id,
    name: { en: s.name, fr: s.name },
    hint: { en: s.hint ?? '', fr: s.hint ?? '' },
    emoji: s.emoji,
    prompt: { en: s.prompt, fr: s.prompt },
    custom: true,
    preset: s.addsText ? ({ text: 'style' } as const) : undefined,
  }));
  return [...own, ...STYLES];
}

/** The whole library, as the concepts prompt lists it, in that prompt's language. */
export function conceptStyles(lang: Lang, custom: CustomStyle[]): ConceptStyle[] {
  return allStyles(custom).map((s) => ({ id: s.id, name: s.name[lang], hint: s.hint[lang], prompt: s.prompt[lang] }));
}

export function findStyle(id: string | undefined, custom: CustomStyle[] = []): StylePreset | undefined {
  return id ? allStyles(custom).find((s) => s.id === id) : undefined;
}

/** The advanced options in effect: the user's choices over the style's preset. */
export function resolveOptions(style: StylePreset | undefined, options: PromptOptions = {}): ResolvedPromptOptions {
  return {
    // A style that adds text cannot go without it, whatever was chosen before.
    text: style?.preset?.text ?? options.text ?? DEFAULT_PROMPT_OPTIONS.text,
    titleZone: options.titleZone ?? DEFAULT_PROMPT_OPTIONS.titleZone,
    brandWeight: options.brandWeight ?? DEFAULT_PROMPT_OPTIONS.brandWeight,
  };
}

/** Choosing another style brings back its preset; what does not depend on the style stays. */
export function optionsForNewStyle(options: PromptOptions | undefined): PromptOptions | undefined {
  if (!options) return undefined;
  const { titleZone, brandWeight } = options;
  return { titleZone, brandWeight };
}

/** What an emoji field keeps of its text: the last character typed, whole (an emoji can be several code points). */
export function lastGrapheme(text: string): string {
  return Array.from(new Intl.Segmenter().segment(text.trim())).at(-1)?.segment ?? '';
}
