import type { AspectRatio, OutputRatio, Guideline, PromptOptions, ReferenceUse, ResolvedPromptOptions, TitleZone } from './types';

/**
 * Prompt construction for Nano Banana Pro / Nano Banana 2.
 *
 * Follows Google's prompting guidance for these models:
 * - natural-language brief, not keyword lists ("tag soup");
 * - state the intent (it's a YouTube thumbnail) and the format in the text;
 * - declare the role of every attached image ("Image 2 is the art-style reference");
 * - lock identity explicitly ("keep facial features exactly the same as…");
 * - phrase constraints positively rather than as lists of negatives;
 * - edits: "change only X, keep everything else exactly the same".
 * Sources: ai.google.dev/gemini-api/docs/image-generation,
 * cloud.google.com/blog/…/ultimate-prompting-guide-for-nano-banana
 *
 * Every prompt is written in French, whatever the interface language.
 */

export type ImageRole =
  | { kind: 'persona'; name: string; description?: string; expression?: string }
  | { kind: 'reference'; label?: string; use?: ReferenceUse };

interface BriefInput {
  brief: string;
  videoTitle?: string;
  aspectRatio: OutputRatio;
  /** Art-direction fragment from a style preset. */
  style?: string;
  roles: ImageRole[];
  /** Brand colours. */
  colors?: string[];
  options?: ResolvedPromptOptions;
}

export const DEFAULT_PROMPT_OPTIONS: ResolvedPromptOptions = {
  text: 'none',
  titleZone: 'none',
  guidelines: { focal: true, background: true, colors: true, emotion: true },
  brandWeight: 'accents',
  likeness: 'exact',
};

const FORMAT_HINT: Record<OutputRatio, string> = {
  '16:9': 'une miniature de vidéo YouTube au format 16:9',
  '9:16': 'une couverture verticale de YouTube Shorts au format 9:16',
};

export const OUTPUT_RATIOS: OutputRatio[] = ['16:9', '9:16'];

/** The output format for a saved value: one the studio no longer generates falls back to 16:9. */
export function outputRatio(ratio: AspectRatio | undefined): OutputRatio {
  return ratio === '9:16' ? '9:16' : '16:9';
}

function imageLabel(from: number, to: number): string {
  return from === to ? `Image ${from}` : `Images ${from}–${to}`;
}

/** What each kind of reference asks of the model. Text in an image is never to be copied. */
const REFERENCE_USES: Record<ReferenceUse, (label: string) => string> = {
  free: (label) => `image de référence${label}, à utiliser comme le décrit le brief ; si le brief n’en parle pas, inspire-t’en librement, sans recopier son texte.`,
  composition: (label) => `référence de composition${label} : reprends son cadrage et la disposition de ses éléments, pas son contenu ni son texte.`,
  style: (label) => `référence de style${label} : reprends son rendu, ses couleurs et sa lumière, pas son contenu ni son texte.`,
  object: (label) => `objet${label} à reproduire fidèlement dans la miniature.`,
  background: (label) => `décor${label} à utiliser en arrière-plan de la scène.`,
};

/** « de Sam », « d’Alex ». */
function ofName(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/** "Images 1–3 : photos d’Alex…" — consecutive photos of the same person are grouped. */
export function describeImages(roles: ImageRole[], offset = 0, likeness: PromptOptions['likeness'] = 'exact'): string[] {
  if (roles.length === 0) return [];
  const lines: string[] = [];

  let i = 0;
  while (i < roles.length) {
    const role = roles[i];
    let j = i;
    while (j + 1 < roles.length && role.kind === 'persona') {
      const next = roles[j + 1];
      if (next.kind !== 'persona' || next.name !== role.name) break;
      j++;
    }
    const label = imageLabel(offset + i + 1, offset + j + 1);
    switch (role.kind) {
      case 'persona': {
        const expressions = roles
          .slice(i, j + 1)
          .map((r) => (r.kind === 'persona' ? r.expression : undefined))
          .filter(Boolean);
        lines.push(
          `- ${label} : photos ${ofName(role.name)}${role.description ? ` (${role.description})` : ''}. ` +
            (likeness === 'exact'
              ? `Garde les traits du visage ${ofName(role.name)} exactement identiques à ces photos : forme du visage, yeux, nez, teint, cheveux.`
              : `Garde ${role.name} reconnaissable à ses traits (forme du visage, yeux, nez, cheveux), en les adaptant au rendu demandé par la direction artistique.`) +
            (expressions.length ? ` Elles montrent aussi ses expressions typiques : ${expressions.join(', ')}.` : ''),
        );
        break;
      }
      case 'reference':
        lines.push(`- ${label} : ${REFERENCE_USES[role.use ?? 'free'](role.label ? ` (${role.label})` : '')}`);
        break;
    }
    i = j + 1;
  }
  return lines;
}

/*
 * The blocks of the generation prompt, all shown in the brief panel so nothing
 * is sent unseen. Those that depend on a choice return '' when it adds nothing.
 */
export function titleLine(videoTitle?: string): string {
  return videoTitle?.trim()
    ? `La miniature s’affichera à côté du titre de la vidéo : ${videoTitle.trim()}. Ce titre est un contexte, à ne pas écrire dans l’image : la miniature doit ajouter de la curiosité au titre plutôt que le répéter.`
    : '';
}

/** The title's block in the brief panel: shows where the title will go while there is none (nothing is sent then). */
export function titlePreviewLine(videoTitle?: string): string {
  return titleLine(videoTitle) || titleLine('[titre de la vidéo]');
}

export function sceneLine(brief: string): string {
  return `Scène : ${brief.trim()}`;
}

/** With `people` (how many are attached), says who the style's people are when that differs from what it describes. */
export function styleLine(style?: string, people?: number): string {
  if (!style?.trim()) return '';
  return [`Direction artistique : ${style.trim()}`, people === undefined ? '' : peopleNote(style, people)].filter(Boolean).join(' ');
}

function peopleNote(style: string, people: number): string {
  if (!/personne/i.test(style)) return '';
  const duo = /deux personnes/i.test(style);
  if (people === 0) return duo ? '' : 'Aucune photo de personne n’est jointe : si cette direction parle d’une personne, utilise le sujet de la scène.';
  if (people === 1) return duo ? 'Une seule personne est fournie en photo : l’autre reste libre, sauf si la scène dit le contraire.' : '';
  return 'Plusieurs personnes sont fournies en photo : « la personne mise en avant » les désigne toutes.';
}

const BRAND_WEIGHTS: Record<ResolvedPromptOptions['brandWeight'], string> = {
  subtle: 'Utilise-les discrètement, en petites touches.',
  accents: 'Utilise-les comme couleurs d’accent, sans remplacer les couleurs demandées par la direction artistique.',
  dominant: 'Fais-en les couleurs dominantes de l’image, même si la direction artistique en demande d’autres.',
};

export function colorsLine(colors: string[], weight: ResolvedPromptOptions['brandWeight'] = 'accents'): string {
  return colors.length ? `Couleurs de marque : ${colors.join(', ')}. ${BRAND_WEIGHTS[weight]}` : '';
}

export function formatLine(aspectRatio: OutputRatio): string {
  return `Génère ${FORMAT_HINT[aspectRatio]}.`;
}

export function textLine(text: ResolvedPromptOptions['text'] = 'none'): string {
  return text === 'style'
    ? 'Texte : uniquement les éléments courts demandés par la direction artistique (badge, chiffre, écran), sans autre lettre, légende ni filigrane.'
    : 'Texte : aucune lettre, aucun chiffre, légende ni filigrane dans l’image, même si la direction artistique en mentionne.';
}

const TITLE_ZONES: Record<Exclude<TitleZone, 'none'>, string> = {
  'top-left': 'en haut à gauche',
  top: 'en haut',
  'top-right': 'en haut à droite',
  left: 'à gauche',
  center: 'au centre',
  right: 'à droite',
  'bottom-left': 'en bas à gauche',
  bottom: 'en bas',
  // The video's duration covers the very corner (`marginLine`).
  'bottom-right': 'en bas à droite, juste au-dessus du coin où s’affiche la durée,',
};

/** The headline is added afterwards with the studio's text tool, where it stays editable and exact. */
export function titleZoneLine(zone: TitleZone = DEFAULT_PROMPT_OPTIONS.titleZone): string {
  return zone === 'none' ? '' : `Un court texte sera ajouté ensuite : garde une zone dégagée et épurée ${TITLE_ZONES[zone]} pour l’accueillir.`;
}

/** Comes first among the descriptions of the attached images. */
export const IMAGES_HEADER = 'Images jointes, dans l’ordre :';

const GUIDELINES: Record<Guideline, string> = {
  focal: 'un seul point focal',
  background: 'une forte séparation entre le sujet et un fond simple',
  colors: 'un fort contraste et des couleurs percutantes',
  emotion: 'des visages à l’émotion claire et lisible',
};

export function guidelinesLine(guidelines: Record<Guideline, boolean> = DEFAULT_PROMPT_OPTIONS.guidelines): string {
  const list = (Object.keys(GUIDELINES) as Guideline[]).filter((g) => guidelines[g]).map((g) => GUIDELINES[g]).join(', ');
  return `Fais-en une miniature efficace, comprise en une fraction de seconde à la taille d’un fil sur téléphone${list ? ` : ${list}` : ''}.`;
}

export function marginLine(): string {
  return 'Laisse un peu de marge autour des éléments importants : aucun ne doit toucher les bords du cadre ni être coupé par accident. Garde le coin bas droit libre, car la durée de la vidéo s’y affiche.';
}

export function priorityLine(): string {
  return 'En cas de conflit, la scène l’emporte sur la direction artistique, et la direction artistique sur les consignes générales.';
}

export function buildGenerationPrompt(input: BriefInput): string {
  const { brief, videoTitle, aspectRatio, style, roles, colors = [], options = DEFAULT_PROMPT_OPTIONS } = input;
  const people = new Set(roles.flatMap((r) => (r.kind === 'persona' ? [r.name] : []))).size;
  const sections: string[] = [];

  sections.push([formatLine(aspectRatio), titleLine(videoTitle)].filter(Boolean).join(' '));
  sections.push(sceneLine(brief));
  if (style?.trim()) sections.push(styleLine(style, people));
  sections.push(textLine(options.text));

  const zone = titleZoneLine(options.titleZone);
  if (zone) sections.push(zone);

  const imageLines = describeImages(roles, 0, options.likeness);
  if (imageLines.length) sections.push([IMAGES_HEADER, ...imageLines].join('\n'));

  if (colors.length) sections.push(colorsLine(colors, options.brandWeight));

  sections.push(guidelinesLine(options.guidelines), marginLine(), priorityLine());

  return sections.join('\n\n');
}

export function buildEditPrompt(instruction: string, extraRoles: ImageRole[] = []): string {
  const lines = [
    `À partir de l’image 1 (la miniature actuelle), ${lowerFirst(instruction.trim())}`,
    // The instruction wins over the preservation clause: a fixed "keep the composition"
    // made the model ignore moves, resizes and reframing requests.
    'Applique cette instruction entièrement et visiblement, même si elle change la position, la taille ou le cadrage d’un élément, ou la composition. ' +
      'Garde exactement à l’identique tout ce que l’instruction ne mentionne pas : les autres éléments, les personnes et les traits de leur visage, le texte, les couleurs, la lumière et le format de l’image.',
  ];
  if (extraRoles.length) {
    lines.push(['Autres images jointes :', ...describeImages(extraRoles, 1)].join('\n'));
  }
  return lines.join('\n\n');
}

/** Reframing: fill the flat grey areas left around the moved or zoomed-out image. */
export function buildOutpaintPrompt(): string {
  return [
    'L’image 1 est une miniature dont l’image, ou une partie découpée, a été déplacée ou dézoomée dans son cadre : les zones gris moyen, plates et uniformes, sont vides.',
    'Remplis uniquement ces zones grises en prolongeant naturellement la scène existante : même décor, même perspective, même lumière, mêmes couleurs, même netteté et même style, en poursuivant chaque objet, surface et contour qui y entre, pour que le résultat paraisse être une seule photo sans raccord. Fais disparaître tout bord net autour d’une partie déplacée pour qu’elle s’intègre naturellement à la scène.',
    'Ne change rien en dehors des zones grises. N’ajoute ni texte, ni logo, ni personne, ni nouveau sujet principal dans les zones remplies, et ne laisse aucun gris.',
  ].join('\n\n');
}

/** A sharper, higher-resolution copy of image 1 that changes nothing else. */
export function buildUpscalePrompt(): string {
  return [
    'Agrandis l’image 1 à une résolution plus élevée.',
    'Reproduis-la exactement : même composition et même cadrage, mêmes personnes avec exactement les mêmes visages et expressions, mêmes objets, même texte et mêmes lettres, mêmes couleurs et même lumière.',
    'Rends-la seulement plus nette, avec des détails plus fins et plus propres et des contours précis, et supprime le flou, le bruit et les artefacts de compression. N’ajoute, ne supprime, ne déplace et ne restyle rien, et garde le format de l’image.',
  ].join('\n\n');
}

/**
 * Healing brush: the marked area arrives already filled from its surroundings
 * (« Lisser »), so the model only restores texture. An empty or highlighted
 * area made it draw an object of the area's shape instead.
 */
export function buildHealPrompt(): string {
  return buildRegionEditPrompt(
    'cette zone a été raccommodée et paraît étalée. Restaure la texture, le grain, la lumière et la netteté naturels de ce qui l’entoure pour qu’elle se fonde de façon invisible. N’ajoute rien de nouveau : ni objet, ni forme, ni bord, ni ligne.',
  );
}

export function buildRegionEditPrompt(instruction: string): string {
  return [
    'Modifie l’image 1 (la miniature). L’image 2 est la même miniature avec un calque magenta translucide qui indique seulement OÙ modifier : c’est un repère d’emplacement, pas un élément du visuel.',
    `Dans l’image 1, à l’intérieur de la zone marquée sur l’image 2 : ${instruction.trim()}`,
    'Respecte exactement le style environnant (même typographie, mêmes couleurs, même contour, même ombre et même lumière). N’utilise ni magenta ni rose, sauf si l’instruction le demande. Garde exactement à l’identique tout ce qui est en dehors de la zone marquée, en conservant la composition d’origine et le format de l’image.',
  ].join('\n\n');
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
