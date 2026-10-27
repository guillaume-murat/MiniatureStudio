import type { AspectRatio, BrandKit } from './types';

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
 */

export type ImageRole =
  | { kind: 'persona'; name: string; description?: string; expression?: string }
  | { kind: 'style' }
  | { kind: 'logo' }
  | { kind: 'font'; family: string }
  | { kind: 'reference'; label?: string };

/**
 * - `render`: the model draws `overlayText` in the image.
 * - `space`: the model leaves clean negative space for a headline added later
 *   (in Canva, Photoshop…). Text from the model is the least reliable part of
 *   the image, so many creators prefer this.
 */
export type TextMode = 'render' | 'space';

export interface BriefInput {
  brief: string;
  /** Text for the thumbnail. Empty = purely visual thumbnail. */
  overlayText: string;
  textMode: TextMode;
  videoTitle?: string;
  aspectRatio: AspectRatio;
  /** Art-direction fragment from a style preset. */
  style?: string;
  roles: ImageRole[];
  brand?: Pick<BrandKit, 'enabled' | 'channelName' | 'colors' | 'font' | 'fontStyle' | 'notes' | 'styleProfile'>;
}

const FORMAT_HINT: Record<AspectRatio, string> = {
  '16:9': 'a 16:9 YouTube video thumbnail',
  '9:16': 'a 9:16 vertical YouTube Shorts cover',
  '4:3': 'a 4:3 video thumbnail',
  '1:1': 'a square 1:1 video thumbnail',
  '21:9': 'an ultra-wide 21:9 banner',
};

/** Quote text for the model: straight double quotes, inner quotes neutralised. */
export function quote(text: string): string {
  return `"${text.replace(/["“”]/g, "'").trim()}"`;
}

function imageLabel(from: number, to: number): string {
  return from === to ? `Image ${from}` : `Images ${from}–${to}`;
}

/** "Image 1–3: photos of Alex…" — consecutive photos of the same person are grouped. */
export function describeImages(roles: ImageRole[], offset = 0): string[] {
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
          `- ${label}: photos of ${role.name}${role.description ? ` (${role.description})` : ''}. ` +
            `Keep ${role.name}'s facial features exactly the same as in these photos — face shape, eyes, nose, skin tone, hair.` +
            (expressions.length ? ` They also show ${role.name}'s typical expressions: ${expressions.join(', ')}.` : ''),
        );
        break;
      }
      case 'style':
        lines.push(`- ${label}: one of the channel's existing thumbnails. Use it for the art style only — colour grading, typography treatment, graphic devices, energy — with a new subject and new text.`);
        break;
      case 'logo':
        lines.push(`- ${label}: the channel logo. Reproduce it faithfully and small, only where it fits naturally.`);
        break;
      case 'font':
        lines.push(
          `- ${label}: a specimen of the ${role.family} typeface. Set the thumbnail text in this exact typeface — same letter shapes, proportions and weight contrast — but do not copy the specimen's words or its plain black-on-white look.`,
        );
        break;
      case 'reference':
        lines.push(`- ${label}: reference image${role.label ? ` (${role.label})` : ''}, to use as the brief describes.`);
        break;
    }
    i = j + 1;
  }
  return lines;
}

/** `brandType`: the brand kit sets the typography, so the default type treatment would contradict it. */
function textSection(overlayText: string, textMode: TextMode, aspectRatio: AspectRatio, brandType = false): string {
  const text = overlayText.trim();
  if (!text) {
    return 'Text: a purely visual thumbnail — the image tells the story on its own, with clean surfaces free of lettering, captions and watermarks.';
  }
  if (textMode === 'space') {
    const side = aspectRatio === '9:16' ? 'upper third' : 'left or right third (whichever the composition favours)';
    return `Text: leave clean, uncluttered negative space in the ${side} for a short headline that will be added afterwards. The image itself stays free of lettering.`;
  }
  return (
    `Text: render the exact text ${quote(text)}, spelled exactly as written including accents and punctuation. ` +
    (brandType
      ? `Typeset it huge in the brand typography described below, high-contrast against the background so it reads instantly on a phone, on at most two lines. `
      : `Typeset it huge in a heavy, bold sans-serif with a thick dark outline or drop shadow so it reads instantly on a phone, on at most two lines. `) +
    `Place it in the upper part or to one side, clear of the bottom-right corner where YouTube shows the video duration.`
  );
}

export function buildGenerationPrompt(input: BriefInput): string {
  const { brief, overlayText, textMode, videoTitle, aspectRatio, style, roles, brand } = input;
  const sections: string[] = [];

  sections.push(
    `Generate ${FORMAT_HINT[aspectRatio]}.` +
      (videoTitle?.trim()
        ? ` It will sit next to the video title ${quote(videoTitle)} in the YouTube feed, so it should add intrigue to the title rather than repeat it.`
        : ''),
  );

  sections.push(`Scene: ${brief.trim()}`);

  if (style?.trim()) sections.push(`Art direction: ${style.trim()}`);

  const brandType = !!brand?.enabled && !!(brand.font || brand.fontStyle.trim());
  sections.push(textSection(overlayText, textMode, aspectRatio, brandType));

  const imageLines = describeImages(roles);
  if (imageLines.length) sections.push(['Attached images, in order:', ...imageLines].join('\n'));

  if (brand?.enabled) {
    const lines: string[] = [];
    if (brand.styleProfile.trim()) lines.push(`Channel visual identity: ${brand.styleProfile.trim()}`);
    if (brand.colors.length) lines.push(`Brand colours: ${brand.colors.join(', ')} — use them as the dominant accent colours.`);
    const fontStyle = brand.fontStyle.trim();
    if (brand.font) lines.push(`Typography: set all text in the ${brand.font} typeface (Google Fonts)${fontStyle ? `, ${fontStyle}` : ''}.`);
    else if (fontStyle) lines.push(`Typography: ${fontStyle}.`);
    if (brand.notes.trim()) lines.push(brand.notes.trim());
    if (lines.length) sections.push(lines.join('\n'));
  }

  sections.push(
    'Make it work as a thumbnail: one clear focal point that reads in a split second at phone-feed size, ' +
      'strong separation between subject and a simple background, high contrast and punchy colour, ' +
      'faces with a clear, readable emotion, and the key subject within the central 80% of the frame.',
  );

  return sections.join('\n\n');
}

export function buildEditPrompt(instruction: string, extraRoles: ImageRole[] = []): string {
  const lines = [
    `Using image 1 (the current thumbnail), ${lowerFirst(instruction.trim())}`,
    // The instruction wins over the preservation clause: a fixed "keep the composition"
    // made the model ignore moves, resizes and reframing requests.
    'Apply this instruction fully and visibly, even when it changes the position, size or framing of something, or the composition. ' +
      'Keep everything the instruction does not mention exactly the same: the other elements, people and their facial features, text, colours, lighting and the aspect ratio.',
  ];
  if (extraRoles.length) {
    lines.push(['Other attached images:', ...describeImages(extraRoles, 1)].join('\n'));
  }
  return lines.join('\n\n');
}

/**
 * Face restoration on image 1 using the people's reference photos (the roles
 * after image 1), changing nothing but the faces.
 */
export function buildFaceFixPrompt(names: string[], roles: ImageRole[]): string {
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return [
    `Using image 1 (the current thumbnail), restore the face${names.length > 1 ? 's' : ''} of ${who}. Fix every glitch and artefact on ${names.length > 1 ? 'them' : 'it'} — asymmetric, melted or misaligned eyes, malformed teeth, smeared or waxy skin, broken face outlines, mismatched ears and hairline — so each face looks like a sharp, natural, high-resolution photograph of that person.`,
    `Rebuild their exact facial features from the reference photos: face shape, eyes, nose, mouth, skin tone and texture, hair. Keep the expression, head pose, gaze direction, framing and lighting exactly as in image 1.`,
    'Change only the faces. Keep everything else in the image exactly the same, preserving the composition, bodies, clothing, background, text, colours and aspect ratio.',
    ['Other attached images:', ...describeImages(roles, 1)].join('\n'),
  ].join('\n\n');
}

/** Reframing: fill the flat grey areas left around the moved or zoomed-out image. */
export function buildOutpaintPrompt(): string {
  return [
    'Image 1 is a thumbnail whose picture was moved or zoomed out inside its frame: the flat, uniform mid-grey areas are empty.',
    'Fill only those grey areas by extending the existing scene naturally: the same setting, perspective, lighting, colours, focus and style, continuing every object, surface and edge that runs into them, so the result reads as one seamless photograph.',
    'Do not change anything outside the grey areas. Do not add text, logos, people or new focal subjects in the filled areas, and leave no grey behind.',
  ].join('\n\n');
}

/** A sharper, higher-resolution copy of image 1 that changes nothing else. */
export function buildUpscalePrompt(): string {
  return [
    'Upscale image 1 to a higher resolution.',
    'Reproduce it exactly: the same composition and framing, the same people with exactly the same faces and expressions, the same objects, text and lettering, colours and lighting.',
    'Only make it sharper, with finer, cleaner detail and crisp edges, and remove blur, noise and compression artefacts. Do not add, remove, move or restyle anything, and keep the aspect ratio.',
  ].join('\n\n');
}

export function buildRegionEditPrompt(instruction: string): string {
  return [
    'Edit image 1 (the thumbnail). Image 2 is the same thumbnail with a translucent magenta overlay that only marks WHERE to edit — it is a location guide, not part of the design.',
    `In image 1, within the area marked in image 2: ${instruction.trim()}`,
    'Match the surrounding style exactly (same typography, colours, stroke, shadow and lighting). Do not use magenta or pink anywhere unless the instruction asks for it. Keep everything outside the marked area exactly the same, preserving the original composition and aspect ratio.',
  ].join('\n\n');
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
