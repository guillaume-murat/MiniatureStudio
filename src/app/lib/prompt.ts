import type { Lang, OutputRatio, PromptOptions, ReferenceUse, ResolvedPromptOptions, TitleZone } from './types';

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
 * Every prompt is written in the interface's language: French or English (`COPY`).
 * The caller always passes it, so that no prompt silently falls back on one of them.
 */

export type ImageRole =
  | { kind: 'persona'; name: string; description?: string; expression?: string }
  | { kind: 'reference'; label?: string; use?: ReferenceUse }
  /** The black-on-white sketch of the Gribouillis view: always image 1. */
  | { kind: 'sketch' };

interface BriefInput {
  lang: Lang;
  brief: string;
  videoTitle?: string;
  aspectRatio: OutputRatio;
  /** Art-direction fragment from a style preset. */
  style?: string;
  roles: ImageRole[];
  /** Generated from the Gribouillis view: the rendering replaces the style, generated text and title zone, even on a blank sheet. */
  sketchView?: boolean;
  /** Brand colours. */
  colors?: string[];
  options?: ResolvedPromptOptions;
}

export const DEFAULT_PROMPT_OPTIONS: ResolvedPromptOptions = {
  text: 'none',
  titleZone: 'none',
  brandWeight: 'accents',
};

export const OUTPUT_RATIOS: OutputRatio[] = ['16:9', '9:16'];

/** The output format for a saved preference: anything else falls back to 16:9. */
export function outputRatio(ratio: string | undefined): OutputRatio {
  return ratio === '9:16' ? '9:16' : '16:9';
}

/** Every sentence sent to the models, once per language: the types keep the two in step. */
interface PromptCopy {
  format: Record<OutputRatio, string>;
  /** "Image 2", "Images 1–3", as it starts a line describing them. */
  imageLabel: (label: string) => string;
  /** What each kind of reference asks of the model. Text in an image is never to be copied. */
  references: Record<ReferenceUse, (label: string) => string>;
  person: (name: string, description: string, expressions: string[]) => string;
  identity: (people: string[]) => string;
  faceFix: (who: string) => string;
  title: (title: string) => string;
  titlePlaceholder: string;
  scene: (brief: string) => string;
  styleNone: string;
  styleHeading: string;
  noPersonPhoto: string;
  onePersonOfTwo: string;
  severalPeople: string;
  brandWeights: Record<ResolvedPromptOptions['brandWeight'], string>;
  colors: (list: string) => string;
  generate: (format: string) => string;
  text: Record<ResolvedPromptOptions['text'], string>;
  zones: Record<Exclude<TitleZone, 'none'>, string>;
  zone: (where: string) => string;
  imagesHeader: string;
  /** A generation from a sketch: what to take from it, and the look asked for instead of a style. */
  /** `n`: the sketch's number among the attached images (after the people's photos). */
  sketch: (n: number) => string;
  sketchImage: string;
  sketchRender: string;
  quality: string;
  margin: string;
  priority: string;
  edit: (instruction: string) => string;
  editApply: string;
  otherImages: string;
  outpaint: string[];
  upscale: string[];
  heal: string;
  region: (instruction: string) => string[];
}

/** « de Sam », « d’Alex ». */
function joinFr(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}
function joinEn(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function ofName(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`;
}

const COPY: Record<Lang, PromptCopy> = {
  fr: {
    format: {
      '16:9': 'une miniature de vidéo YouTube au format 16:9',
      '9:16': 'une couverture verticale de YouTube Shorts au format 9:16',
    },
    imageLabel: (label) => `${label} :`,
    references: {
      free: (label) => `image de référence${label}, à utiliser comme le décrit le brief ; si le brief n’en parle pas, inspire-t’en librement, sans recopier son texte.`,
      composition: (label) => `référence de composition${label} : reprends son cadrage et la disposition de ses éléments, pas son contenu ni son texte.`,
      style: (label) => `référence de style${label} : reprends son rendu, ses couleurs et sa lumière, pas son contenu ni son texte.`,
      object: (label) => `objet${label} à reproduire fidèlement dans la miniature.`,
      background: (label) => `décor${label} à utiliser en arrière-plan de la scène.`,
    },
    person: (name, description, expressions) =>
      `photos ${ofName(name)}${description ? ` (${description})` : ''}. ` +
      `Garde les traits du visage ${ofName(name)} exactement identiques à ces photos (forme du visage, yeux, nez, bouche, teint, cheveux), même si son expression change.` +
      (expressions.length ? ` Elles montrent aussi ses expressions typiques : ${expressions.join(', ')}.` : ''),
    identity: (people) =>
      (people.length === 1 ? `La personne mise en avant est ${people[0]}. Cette personne doit` : `Les personnes mises en avant sont ${joinFr(people)}. Chacune doit`) +
      ' rester la même personne, immédiatement reconnaissable, avec les traits du visage de ses photos. Seule l’expression change quand la scène ou la direction artistique le demande : la forme du visage, les yeux, le nez, la bouche, le teint et les cheveux restent les siens.',
    faceFix: (who) =>
      `remplace le visage par celui ${who}, avec exactement les mêmes traits (forme du visage, yeux, nez, bouche, teint, cheveux). Garde l’expression, l’orientation de la tête, la lumière, les couleurs et le grain de l’image 1, pour que le visage s’intègre sans raccord.`,
    title: (title) => `La miniature s’affichera à côté du titre de la vidéo : ${title}. Ce titre est un contexte, à ne pas écrire dans l’image : la miniature doit ajouter de la curiosité au titre plutôt que le répéter.`,
    titlePlaceholder: '[titre de la vidéo]',
    scene: (brief) => `Scène : ${brief}`,
    styleNone: 'Direction artistique : baser la direction artistique de l’image sur les informations fournies dans la scène.',
    styleHeading: 'Direction artistique :',
    noPersonPhoto: 'Aucune photo de personne n’est jointe : si cette direction parle d’une personne, utilise le sujet de la scène.',
    onePersonOfTwo: 'Une seule personne est fournie en photo : l’autre reste libre, sauf si la scène dit le contraire.',
    severalPeople: 'Plusieurs personnes sont fournies en photo : « la personne mise en avant » les désigne toutes.',
    brandWeights: {
      subtle: 'Utilise-les discrètement, en petites touches.',
      accents: 'Utilise-les comme couleurs d’accent, sans remplacer les couleurs demandées par la direction artistique.',
      dominant: 'Fais-en les couleurs dominantes de l’image, même si la direction artistique en demande d’autres.',
    },
    colors: (list) => `Couleurs de marque : ${list}.`,
    generate: (format) => `Génère ${format}.`,
    text: {
      style: 'Texte : uniquement les éléments courts demandés par la direction artistique (badge, chiffre, écran), sans autre lettre, légende ni filigrane.',
      none: 'Texte : aucune lettre, aucun chiffre, légende ni filigrane dans l’image, même si la direction artistique en mentionne.',
    },
    zones: {
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
    },
    zone: (where) => `Un court texte sera ajouté ensuite : garde une zone dégagée et épurée ${where} pour l’accueillir.`,
    imagesHeader: 'Images jointes, dans l’ordre :',
    sketch: (n) =>
      `Composition : l’image ${n} est un croquis rapide, noir sur blanc. Suis sa composition : la place, la taille et la pose de chaque élément, et le cadrage. N’imite jamais son trait : ni contours noirs, ni fond blanc, ni aspect de dessin. Le résultat est une miniature finie où rien du croquis ne se voit.`,
    sketchImage: 'le croquis de composition, à suivre pour la place des éléments, jamais pour le trait.',
    sketchRender: 'Rendu : une photo réaliste et percutante de miniature YouTube.',
    quality: 'Fais-en une miniature efficace, comprise en une fraction de seconde sur youtube version mobile : des éléments qui ressortent, un fond simple, un fort contraste et des couleurs percutantes.',
    margin: 'Laisse un peu de marge autour des éléments importants : aucun ne doit toucher les bords du cadre ni être coupé par accident. Garde le coin bas droit libre, car la durée de la vidéo s’y affiche.',
    priority: 'En cas de conflit, la scène l’emporte sur la direction artistique, et la direction artistique sur les consignes générales.',
    edit: (instruction) => `À partir de l’image 1 (la miniature actuelle), ${instruction}`,
    editApply:
      'Applique cette instruction entièrement et visiblement, même si elle change la position, la taille ou le cadrage d’un élément, ou la composition. ' +
      'Garde exactement à l’identique tout ce que l’instruction ne mentionne pas : les autres éléments, les personnes et les traits de leur visage, le texte, les couleurs, la lumière et le format de l’image.',
    otherImages: 'Autres images jointes :',
    outpaint: [
      'L’image 1 est une miniature dont l’image, ou une partie découpée, a été déplacée ou dézoomée dans son cadre : les zones gris moyen, plates et uniformes, sont vides.',
      'Remplis uniquement ces zones grises en prolongeant naturellement la scène existante : même décor, même perspective, même lumière, mêmes couleurs, même netteté et même style, en poursuivant chaque objet, surface et contour qui y entre, pour que le résultat paraisse être une seule photo sans raccord. Fais disparaître tout bord net autour d’une partie déplacée pour qu’elle s’intègre naturellement à la scène.',
      'Ne change rien en dehors des zones grises. N’ajoute ni texte, ni logo, ni personne, ni nouveau sujet principal dans les zones remplies, et ne laisse aucun gris.',
    ],
    upscale: [
      'Agrandis l’image 1 à une résolution plus élevée.',
      'Reproduis-la exactement : même composition et même cadrage, mêmes personnes avec exactement les mêmes visages et expressions, mêmes objets, même texte et mêmes lettres, mêmes couleurs et même lumière.',
      'Rends-la seulement plus nette, avec des détails plus fins et plus propres et des contours précis, et supprime le flou, le bruit et les artefacts de compression. N’ajoute, ne supprime, ne déplace et ne restyle rien, et garde le format de l’image.',
    ],
    heal: 'cette zone a été raccommodée et paraît étalée. Restaure la texture, le grain, la lumière et la netteté naturels de ce qui l’entoure pour qu’elle se fonde de façon invisible. N’ajoute rien de nouveau : ni objet, ni forme, ni bord, ni ligne.',
    region: (instruction) => [
      'Modifie l’image 1 (la miniature). L’image 2 est la même miniature avec un calque magenta translucide qui indique seulement OÙ modifier : c’est un repère d’emplacement, pas un élément du visuel.',
      `Dans l’image 1, à l’intérieur de la zone marquée sur l’image 2 : ${instruction}`,
      'Respecte exactement le style environnant (même typographie, mêmes couleurs, même contour, même ombre et même lumière). N’utilise ni magenta ni rose, sauf si l’instruction le demande. Garde exactement à l’identique tout ce qui est en dehors de la zone marquée, en conservant la composition d’origine et le format de l’image.',
    ],
  },
  en: {
    format: {
      '16:9': 'a YouTube video thumbnail in 16:9 format',
      '9:16': 'a vertical YouTube Shorts cover in 9:16 format',
    },
    imageLabel: (label) => `${label}:`,
    references: {
      free: (label) => `reference image${label}, to use as the brief describes; if the brief doesn’t mention it, draw on it freely without copying its text.`,
      composition: (label) => `composition reference${label}: reuse its framing and the layout of its elements, not its content or text.`,
      style: (label) => `style reference${label}: reuse its look, colours and lighting, not its content or text.`,
      object: (label) => `object${label} to reproduce faithfully in the thumbnail.`,
      background: (label) => `setting${label} to use as the background of the scene.`,
    },
    person: (name, description, expressions) =>
      `photos of ${name}${description ? ` (${description})` : ''}. ` +
      `Keep ${name}’s facial features exactly the same as in these photos (face shape, eyes, nose, mouth, skin tone, hair), even if the expression changes.` +
      (expressions.length ? ` They also show typical expressions: ${expressions.join(', ')}.` : ''),
    identity: (people) =>
      (people.length === 1 ? `The featured person is ${people[0]}. This person must` : `The featured people are ${joinEn(people)}. Each must`) +
      ' remain the same person, instantly recognisable, with the facial features of their photos. Only the expression changes when the scene or the art direction asks for it: the face shape, eyes, nose, mouth, skin tone and hair stay their own.',
    faceFix: (who) =>
      `replace the face with the face of ${who}, with exactly the same features (face shape, eyes, nose, mouth, skin tone, hair). Keep the expression, head angle, lighting, colours and grain of image 1, so the face blends in with no seam.`,
    title: (title) => `The thumbnail will appear next to the video title: ${title}. This title is context, not to be written in the image: the thumbnail should add curiosity to the title rather than repeat it.`,
    titlePlaceholder: '[video title]',
    scene: (brief) => `Scene: ${brief}`,
    styleNone: 'Art direction: base the image’s art direction on the information given in the scene.',
    styleHeading: 'Art direction:',
    noPersonPhoto: 'No photo of a person is attached: if this direction mentions a person, use the subject of the scene.',
    onePersonOfTwo: 'Only one person is provided in photos: the other one is free, unless the scene says otherwise.',
    severalPeople: 'Several people are provided in photos: “the featured person” means all of them.',
    brandWeights: {
      subtle: 'Use them discreetly, in small touches.',
      accents: 'Use them as accent colours, without replacing the colours the art direction asks for.',
      dominant: 'Make them the dominant colours of the image, even if the art direction asks for others.',
    },
    colors: (list) => `Brand colours: ${list}.`,
    generate: (format) => `Generate ${format}.`,
    text: {
      style: 'Text: only the short elements the art direction asks for (badge, number, screen), with no other lettering, caption or watermark.',
      none: 'Text: no letters, numbers, captions or watermarks in the image, even if the art direction mentions some.',
    },
    zones: {
      'top-left': 'at the top left',
      top: 'at the top',
      'top-right': 'at the top right',
      left: 'on the left',
      center: 'in the centre',
      right: 'on the right',
      'bottom-left': 'at the bottom left',
      bottom: 'at the bottom',
      // The video's duration covers the very corner (`marginLine`).
      'bottom-right': 'at the bottom right, just above the corner where the duration appears,',
    },
    zone: (where) => `A short text will be added afterwards: keep a clear, uncluttered area ${where} for it.`,
    imagesHeader: 'Attached images, in order:',
    sketch: (n) =>
      `Composition: image ${n} is a rough black-on-white sketch. Follow its composition: where each element sits, its size and pose, and the framing. Never copy its lines: no black outlines, no white background, nothing that looks drawn. The result is a finished thumbnail where nothing of the sketch shows.`,
    sketchImage: 'the composition sketch, to follow for where things sit, never for its lines.',
    sketchRender: 'Rendering: a realistic, striking YouTube thumbnail photo.',
    quality: 'Make it an effective thumbnail, understood in a split second on YouTube mobile: elements that stand out, a simple background, strong contrast and punchy colours.',
    margin: 'Leave some margin around the important elements: none should touch the edges of the frame or be cut off by accident. Keep the bottom-right corner clear, as the video’s duration appears there.',
    priority: 'In case of conflict, the scene takes priority over the art direction, and the art direction over the general instructions.',
    edit: (instruction) => `Starting from image 1 (the current thumbnail), ${instruction}`,
    editApply:
      'Apply this instruction fully and visibly, even if it changes the position, size or framing of an element, or the composition. ' +
      'Keep exactly the same everything the instruction doesn’t mention: the other elements, the people and their facial features, the text, the colours, the lighting and the image’s format.',
    otherImages: 'Other attached images:',
    outpaint: [
      'Image 1 is a thumbnail whose image, or a cut-out part of it, was moved or zoomed out within its frame: the flat, uniform mid-grey areas are empty.',
      'Fill only these grey areas by naturally extending the existing scene: same setting, same perspective, same lighting, same colours, same sharpness and same style, continuing every object, surface and outline that enters them, so the result looks like a single photo with no seam. Remove any hard edge around a moved part so that it blends naturally into the scene.',
      'Change nothing outside the grey areas. Add no text, logo, person or new main subject in the filled areas, and leave no grey.',
    ],
    upscale: [
      'Enlarge image 1 to a higher resolution.',
      'Reproduce it exactly: same composition and framing, same people with exactly the same faces and expressions, same objects, same text and lettering, same colours and same lighting.',
      'Only make it sharper, with finer, cleaner details and precise outlines, and remove blur, noise and compression artefacts. Add, remove, move and restyle nothing, and keep the image’s format.',
    ],
    heal: 'this area was patched and looks smeared. Restore the natural texture, grain, lighting and sharpness of its surroundings so that it blends in invisibly. Add nothing new: no object, shape, edge or line.',
    region: (instruction) => [
      'Edit image 1 (the thumbnail). Image 2 is the same thumbnail with a translucent magenta overlay that only shows WHERE to edit: it is a location guide, not part of the visual.',
      `In image 1, inside the area marked on image 2: ${instruction}`,
      'Match the surrounding style exactly (same typography, colours, outline, shadow and lighting). Use no magenta or pink unless the instruction asks for it. Keep everything outside the marked area exactly the same, preserving the original composition and the image’s format.',
    ],
  },
};

function imageLabel(from: number, to: number): string {
  return from === to ? `Image ${from}` : `Images ${from}–${to}`;
}

/** Each person and the numbers of their photos ("Inès (images 1–3)"), in order. */
function peopleWithImages(roles: ImageRole[], offset = 0): string[] {
  const out: string[] = [];
  roles.forEach((role, i) => {
    if (role.kind !== 'persona') return;
    const prev = roles[i - 1];
    if (prev?.kind === 'persona' && prev.name === role.name) return;
    let j = i;
    while (roles[j + 1]?.kind === 'persona' && (roles[j + 1] as typeof role).name === role.name) j++;
    out.push(`${role.name} (${imageLabel(offset + i + 1, offset + j + 1).toLowerCase()})`);
  });
  return out;
}

/** Right after the scene: who the featured people are, and that only their expression may change. */
export function identityLine(lang: Lang, roles: ImageRole[]): string {
  const people = peopleWithImages(roles);
  return people.length ? COPY[lang].identity(people) : '';
}

/** "Images 1–3: photos of Alex…": consecutive photos of the same person are grouped. */
export function describeImages(lang: Lang, roles: ImageRole[], offset = 0): string[] {
  const copy = COPY[lang];
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
    const label = copy.imageLabel(imageLabel(offset + i + 1, offset + j + 1));
    switch (role.kind) {
      case 'persona': {
        const expressions = roles.slice(i, j + 1).flatMap((r) => (r.kind === 'persona' && r.expression ? [r.expression] : []));
        lines.push(`- ${label} ${copy.person(role.name, role.description ?? '', expressions)}`);
        break;
      }
      case 'reference':
        lines.push(`- ${label} ${copy.references[role.use ?? 'free'](role.label ? ` (${role.label})` : '')}`);
        break;
      case 'sketch':
        lines.push(`- ${label} ${copy.sketchImage}`);
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
export function titleLine(lang: Lang, videoTitle?: string): string {
  return videoTitle?.trim() ? COPY[lang].title(videoTitle.trim()) : '';
}

/** The title's block in the brief panel: shows where the title will go while there is none (nothing is sent then). */
export function titlePreviewLine(lang: Lang, videoTitle?: string): string {
  return titleLine(lang, videoTitle) || titleLine(lang, COPY[lang].titlePlaceholder);
}

export function sceneLine(lang: Lang, brief: string): string {
  return COPY[lang].scene(brief.trim());
}

/** With `people` (how many are attached), says who the style's people are when that differs from what it describes. */
export function styleLine(lang: Lang, style?: string, people?: number): string {
  const copy = COPY[lang];
  if (!style?.trim()) return copy.styleNone;
  const note = people === undefined ? '' : peopleNote(lang, style, people);
  // A list keeps its lines; a user's style may be a plain sentence.
  if (style.trim().startsWith('- ')) return [`${copy.styleHeading}\n${style.trim()}`, note && `- ${note}`].filter(Boolean).join('\n');
  return [`${copy.styleHeading} ${style.trim()}`, note].filter(Boolean).join(' ');
}

// A user's own style stays in the language it was written in, whatever the interface's.
function peopleNote(lang: Lang, style: string, people: number): string {
  const copy = COPY[lang];
  if (!/personne|\bperson\b|\bpeople\b/i.test(style)) return '';
  const duo = /deux personnes|two people/i.test(style);
  if (people === 0) return duo ? '' : copy.noPersonPhoto;
  if (people === 1) return duo ? copy.onePersonOfTwo : '';
  return copy.severalPeople;
}

export function colorsLine(lang: Lang, colors: string[], weight: ResolvedPromptOptions['brandWeight'] = 'accents'): string {
  return colors.length ? `${COPY[lang].colors(colors.join(', '))} ${COPY[lang].brandWeights[weight]}` : '';
}

/** What the brand weight option asks, added to the colours when there are some. */
export function brandWeightLine(lang: Lang, weight: ResolvedPromptOptions['brandWeight'] = 'accents'): string {
  return COPY[lang].brandWeights[weight];
}

export function formatLine(lang: Lang, aspectRatio: OutputRatio): string {
  return COPY[lang].generate(COPY[lang].format[aspectRatio]);
}

export function textLine(lang: Lang, text: ResolvedPromptOptions['text'] = 'none'): string {
  return COPY[lang].text[text];
}

/** The headline is added afterwards with the studio's text tool. */
export function titleZoneLine(lang: Lang, zone: TitleZone = DEFAULT_PROMPT_OPTIONS.titleZone): string {
  return zone === 'none' ? '' : COPY[lang].zone(COPY[lang].zones[zone]);
}

/** Generating from the Gribouillis view: image 1 is the sketch, whose composition is followed. */
export function sketchLine(lang: Lang, n = 1): string {
  return COPY[lang].sketch(n);
}

/** Takes the place of the style, generated text and title zone, greyed in the Gribouillis view. */
export function sketchRenderLine(lang: Lang): string {
  return COPY[lang].sketchRender;
}

/** Comes first among the descriptions of the attached images. */
export function imagesHeader(lang: Lang): string {
  return COPY[lang].imagesHeader;
}

export function qualityLine(lang: Lang): string {
  return COPY[lang].quality;
}

export function marginLine(lang: Lang): string {
  return COPY[lang].margin;
}

export function priorityLine(lang: Lang): string {
  return COPY[lang].priority;
}

export function buildGenerationPrompt(input: BriefInput): string {
  const { lang, brief, videoTitle, aspectRatio, style, roles, colors = [], options = DEFAULT_PROMPT_OPTIONS } = input;
  const people = new Set(roles.flatMap((r) => (r.kind === 'persona' ? [r.name] : []))).size;

  const hasSketch = roles.some((r) => r.kind === 'sketch');
  const fromSketchView = input.sketchView || hasSketch;
  const sections: string[] = [];

  sections.push([formatLine(lang, aspectRatio), titleLine(lang, videoTitle)].filter(Boolean).join(' '));
  if (hasSketch) sections.push(sketchLine(lang, roles.findIndex((r) => r.kind === 'sketch') + 1));
  // From a sketch, the scene is optional: the drawing may say it all.
  if (!hasSketch || brief.trim()) sections.push(sceneLine(lang, brief));
  const identity = identityLine(lang, roles);
  if (identity) sections.push(identity);
  if (fromSketchView) sections.push(sketchRenderLine(lang));
  else {
    sections.push(styleLine(lang, style, people));
    sections.push(textLine(lang, options.text));
    const zone = titleZoneLine(lang, options.titleZone);
    if (zone) sections.push(zone);
  }

  const imageLines = describeImages(lang, roles);
  if (imageLines.length) sections.push([imagesHeader(lang), ...imageLines].join('\n'));

  if (colors.length) sections.push(colorsLine(lang, colors, options.brandWeight));

  sections.push(qualityLine(lang), marginLine(lang), priorityLine(lang));

  return sections.join('\n\n');
}

export function buildEditPrompt(lang: Lang, instruction: string, extraRoles: ImageRole[] = []): string {
  const copy = COPY[lang];
  // The instruction wins over the preservation clause: a fixed "keep the composition"
  // made the model ignore moves, resizes and reframing requests.
  const lines = [copy.edit(lowerFirst(instruction.trim())), copy.editApply];
  if (extraRoles.length) lines.push([copy.otherImages, ...describeImages(lang, extraRoles, 1)].join('\n'));
  return lines.join('\n\n');
}

/** Reframing: fill the flat grey areas left around the moved or zoomed-out image. */
export function buildOutpaintPrompt(lang: Lang): string {
  return COPY[lang].outpaint.join('\n\n');
}

/** A sharper, higher-resolution copy of image 1 that changes nothing else. */
export function buildUpscalePrompt(lang: Lang): string {
  return COPY[lang].upscale.join('\n\n');
}

/**
 * Healing brush: the marked area arrives already filled from its surroundings
 * (« Lisser »), so the model only restores texture. An empty or highlighted
 * area made it draw an object of the area's shape instead.
 */
export function buildHealPrompt(lang: Lang): string {
  return buildRegionEditPrompt(lang, COPY[lang].heal);
}

/** `people`: the selected people, sent after the clean and the marked copies of the thumbnail. */
/**
 * « Corriger le visage »: the face in the painted area becomes the person's of the
 * photos, sent after the thumbnail and its marked copy (images 3 and on).
 */
export function buildFaceFixPrompt(lang: Lang, photos: ImageRole[]): string {
  const [who = ''] = peopleWithImages(photos, 2);
  return buildRegionEditPrompt(lang, COPY[lang].faceFix(lang === 'fr' ? ofName(who) : who), photos);
}

export function buildRegionEditPrompt(lang: Lang, instruction: string, people: ImageRole[] = []): string {
  const copy = COPY[lang];
  const lines = copy.region(instruction.trim());
  if (people.length) lines.push([copy.otherImages, ...describeImages(lang, people, 2)].join('\n'));
  return lines.join('\n\n');
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
