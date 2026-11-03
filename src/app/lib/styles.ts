import type { ConceptStyle } from './ai';
import { DEFAULT_PROMPT_OPTIONS } from './prompt';
import type { CustomStyle, PromptOptions, ResolvedPromptOptions } from './types';

/**
 * Thumbnail style presets. Each injects an art-direction fragment into the prompt.
 * The user's own styles (`CustomStyle`, shared by every project) work the same way.
 *
 * Based on current creator practice (1of10, vidIQ 2026 breakout study, Google's
 * Nano Banana guides). Composition rules are conventions, not proven CTR laws:
 * the point is to give the model a coherent, recognisable visual grammar.
 * « La personne mise en avant » is whoever is attached as a persona, if anyone. In French, like every prompt.
 */
export interface StylePreset {
  id: string;
  name: { en: string; fr: string };
  hint: { en: string; fr: string };
  emoji: string;
  prompt: string;
  /** Written by the user, in the shared style library. */
  custom?: boolean;
  /** `text`: the style itself writes in the image. */
  preset?: { text?: 'style' };
}

export const STYLES: StylePreset[] = [
  {
    id: 'reaction',
    emoji: '😲',
    name: { en: 'Reaction + object', fr: 'Réaction + objet' },
    hint: { en: 'Entertainment, reviews', fr: 'Divertissement, tests' },
    prompt:
      'Gros plan serré sur la personne mise en avant, sur un tiers du cadre, le visage occupant environ un tiers de l’image avec une réaction sincère et clairement lisible. De l’autre côté, un seul objet principal, grand et net. Fond propre et saturé, léger contre-jour qui détache le sujet.',
  },
  {
    id: 'versus',
    emoji: '🆚',
    preset: { text: 'style' },
    name: { en: 'Versus', fr: 'Versus' },
    hint: { en: 'Comparisons, debates', fr: 'Comparatifs, débats' },
    prompt:
      'Composition divisée en deux : le premier sujet sur une moitié gauche bleu froid, le second sur une moitié droite orange chaud, un grand badge « VS » au centre. Les deux à la même échelle, éclairage de studio net, forte séparation entre les moitiés.',
  },
  {
    id: 'before-after',
    emoji: '🔄',
    name: { en: 'Before / after', fr: 'Avant / après' },
    hint: { en: 'Transformations, results', fr: 'Transformations, résultats' },
    prompt:
      'Avant/après côte à côte avec un cadrage identique sur les deux moitiés. Moitié gauche désaturée, sombre et terne ; moitié droite éclatante, soignée et lumineuse. Une grande flèche ou une séparation nette rend la transformation évidente.',
  },
  {
    id: 'tech',
    emoji: '💻',
    preset: { text: 'style' },
    name: { en: 'Tech tutorial', fr: 'Tuto tech' },
    hint: { en: 'Dev, software, how-to', fr: 'Dev, logiciels, tutos' },
    prompt:
      'Style tech moderne et épuré : la personne mise en avant d’un côté, l’air sûr d’elle, à côté d’un appareil ou d’un écran d’application flottant à l’interface nette et lisible. Fond en dégradé sombre et doux, lumière principale douce, beaucoup d’espace libre.',
  },
  {
    id: 'cinematic',
    emoji: '🎬',
    name: { en: 'Cinematic documentary', fr: 'Documentaire cinéma' },
    hint: { en: 'History, true crime, essays', fr: 'Histoire, faits divers, essais' },
    prompt:
      'Plan large cinématographique, comme un photogramme de film, éclairage en clair-obscur dramatique, étalonnage sourd bleu-vert et ambre, léger grain argentique, faible profondeur de champ. L’atmosphère et le mystère priment sur les couleurs vives.',
  },
  {
    id: 'minimal',
    emoji: '⬜',
    name: { en: 'Minimal bold', fr: 'Minimaliste' },
    hint: { en: 'Commentary, business', fr: 'Opinion, business' },
    prompt:
      'Graphisme minimaliste : un fond uni d’une seule couleur forte, un seul petit élément marquant et beaucoup d’espace vide. La typographie, s’il y en a, domine le cadre. Rien d’autre ne détourne l’attention.',
  },
  {
    id: 'story',
    emoji: '⏱️',
    name: { en: 'Story moment', fr: 'Moment clé' },
    hint: { en: 'Challenges, narrative vlogs', fr: 'Défis, vlogs narratifs' },
    prompt:
      'Un seul instant de tension figé en pleine action, en contre-plongée au grand-angle. L’issue reste visiblement incertaine, ce qui crée de la curiosité. Composition en diagonale dynamique, couleurs naturelles mais percutantes.',
  },
  {
    id: 'ranking',
    emoji: '🏆',
    preset: { text: 'style' },
    name: { en: 'List / ranking', fr: 'Classement / top' },
    hint: { en: 'Top N, mistakes, tips', fr: 'Tops, erreurs, astuces' },
    prompt:
      'La personne mise en avant tient ou montre un objet principal, avec un grand badge numéroté dans un coin supérieur et quelques objets plus petits disposés en éventail derrière. Éclairage très contrasté sur un fond épuré.',
  },
  {
    id: 'gaming',
    emoji: '🎮',
    name: { en: 'Gaming', fr: 'Gaming' },
    hint: { en: "Let's plays, highlights", fr: 'Let’s play, highlights' },
    prompt:
      'Style gaming plein d’énergie : la personne mise en avant éclairée par des néons violet et cyan avec un fort contre-jour, une action de jeu qui explose derrière elle, composition en diagonale dynamique, accents lumineux et forte saturation.',
  },
  {
    id: 'finance',
    emoji: '💰',
    name: { en: 'Money / finance', fr: 'Argent / finance' },
    hint: { en: 'Finance, crypto, business', fr: 'Finance, crypto, business' },
    prompt:
      'La personne mise en avant à côté d’une immense flèche de graphique brillante (verte et montante, ou rouge et en chute, selon le brief), avec un accessoire clairement lié à l’argent à proximité. Fond sombre, fort contraste, expression sérieuse ou choquée.',
  },
  {
    id: 'vlog',
    emoji: '✈️',
    name: { en: 'Vlog / travel', fr: 'Vlog / voyage' },
    hint: { en: 'Travel, lifestyle', fr: 'Voyage, lifestyle' },
    prompt:
      'Photo spontanée à l’heure dorée, sourire naturel, couleurs chaudes façon pellicule, prise à l’objectif 35 mm. Le lieu est immédiatement reconnaissable et occupe une grande partie du cadre.',
  },
  {
    id: 'hyper',
    emoji: '🤯',
    name: { en: 'Hyper-saturated', fr: 'Hyper-saturé' },
    hint: { en: 'Big challenges, stakes', fr: 'Gros défis, enjeux' },
    prompt:
      'Style ultra-lumineux et hyper-saturé, éclairage propre et brillant, couleurs primaires éclatantes. Les personnes réagissent, les yeux écarquillés, face à quelque chose aux enjeux énormes et démesurés. Tout est exagéré en taille et lisible au premier regard.',
  },
  {
    id: 'clay',
    emoji: '🧸',
    name: { en: '3D / clay', fr: '3D / pâte à modeler' },
    hint: { en: 'Explainers, faceless channels', fr: 'Vulgarisation, chaînes sans visage' },
    prompt:
      'Rendu sous forme de mignon diorama 3D en pâte à modeler brillante, éclairage de studio doux, fond pastel et effet miniature tilt-shift. Formes arrondies, ludiques et tactiles.',
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    name: { en: 'Podcast / interview', fr: 'Podcast / interview' },
    hint: { en: 'Interviews, talk shows', fr: 'Interviews, talk-shows' },
    prompt:
      'Deux personnes en gros plan face à face avec des micros de podcast, studio flou en bokeh derrière elles, lumière principale douce et léger contre-jour. Expressions saisies en pleine conversation, intenses et captivées.',
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
    prompt: s.prompt,
    custom: true,
    preset: s.addsText ? ({ text: 'style' } as const) : undefined,
  }));
  return [...own, ...STYLES];
}

/** The whole library, as the concepts prompt lists it. In French, like every prompt. */
export function conceptStyles(custom: CustomStyle[]): ConceptStyle[] {
  return allStyles(custom).map((s) => ({ id: s.id, name: s.name.fr, hint: s.hint.fr, prompt: s.prompt }));
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
