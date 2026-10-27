import { describe, expect, it } from 'vitest';
import { buildEditPrompt, buildFaceFixPrompt, buildGenerationPrompt, buildOutpaintPrompt, buildRegionEditPrompt, buildUpscalePrompt, describeImages, quote } from '../prompt';

const base = { brief: 'A developer on Mars', overlayText: '', textMode: 'render' as const, aspectRatio: '16:9' as const, roles: [] };

describe('buildGenerationPrompt', () => {
  it('states the format and the scene', () => {
    const p = buildGenerationPrompt(base);
    expect(p).toMatch(/^Generate a 16:9 YouTube video thumbnail\./);
    expect(p).toContain('Scene: A developer on Mars');
  });

  it('asks for a purely visual image when there is no text', () => {
    expect(buildGenerationPrompt(base)).toContain('purely visual thumbnail');
  });

  it('renders the exact text, accents included', () => {
    const p = buildGenerationPrompt({ ...base, overlayText: 'Ça marche !' });
    expect(p).toContain('render the exact text "Ça marche !"');
  });

  it('reserves space instead of rendering text in space mode', () => {
    const p = buildGenerationPrompt({ ...base, overlayText: 'Hello', textMode: 'space' });
    expect(p).toContain('negative space');
    expect(p).not.toContain('"Hello"');
  });

  it('adds the video title as context without asking to repeat it', () => {
    const p = buildGenerationPrompt({ ...base, videoTitle: 'I coded on Mars' });
    expect(p).toContain('"I coded on Mars"');
    expect(p).toContain('rather than repeat it');
  });

  it('includes style and brand only when provided/enabled', () => {
    const brand = { enabled: false, channelName: '', colors: ['#ff0000'], font: '', fontStyle: '', notes: '', styleProfile: 'Bold yellow' };
    expect(buildGenerationPrompt({ ...base, brand })).not.toContain('Bold yellow');
    const p = buildGenerationPrompt({ ...base, style: 'Clay render', brand: { ...brand, enabled: true } });
    expect(p).toContain('Art direction: Clay render');
    expect(p).toContain('Channel visual identity: Bold yellow');
    expect(p).toContain('#ff0000');
  });

  it('names the brand font with its style, or falls back to the style alone', () => {
    const brand = { enabled: true, channelName: '', colors: [], font: 'Anton', fontStyle: 'all caps, white with a thick black stroke', notes: '', styleProfile: '' };
    expect(buildGenerationPrompt({ ...base, brand })).toContain(
      'Typography: set all text in the Anton typeface (Google Fonts), all caps, white with a thick black stroke.',
    );
    expect(buildGenerationPrompt({ ...base, brand: { ...brand, font: '' } })).toContain('Typography: all caps, white with a thick black stroke.');
  });

  it('lets the brand typography replace the default type treatment', () => {
    const brand = { enabled: true, channelName: '', colors: [], font: 'Anton', fontStyle: '', notes: '', styleProfile: '' };
    const withText = { ...base, overlayText: 'WOW', textMode: 'render' as const };
    expect(buildGenerationPrompt({ ...withText, brand })).toContain('in the brand typography described below');
    expect(buildGenerationPrompt({ ...withText, brand })).not.toContain('heavy, bold sans-serif');
    expect(buildGenerationPrompt({ ...withText, brand: { ...brand, enabled: false } })).toContain('heavy, bold sans-serif');
  });
});

describe('describeImages', () => {
  it('describes a font specimen', () => {
    const [line] = describeImages([{ kind: 'font', family: 'Bebas Neue' }]);
    expect(line).toMatch(/^- Image 1: a specimen of the Bebas Neue typeface/);
    expect(line).toContain('do not copy the specimen');
  });

  it('groups consecutive photos of the same person', () => {
    const lines = describeImages([
      { kind: 'persona', name: 'Alex' },
      { kind: 'persona', name: 'Alex', expression: 'surprised' },
      { kind: 'persona', name: 'Sam' },
      { kind: 'style' },
    ]);
    expect(lines[0]).toMatch(/^- Images 1–2: photos of Alex\./);
    expect(lines[0]).toContain('surprised');
    expect(lines[1]).toMatch(/^- Image 3: photos of Sam\./);
    expect(lines[2]).toMatch(/^- Image 4: .*art style only/);
  });

  it('supports an index offset', () => {
    expect(describeImages([{ kind: 'logo' }], 1)[0]).toMatch(/^- Image 2:/);
  });
});

describe('edit prompts', () => {
  it('applies the instruction fully and keeps only what it does not mention', () => {
    const p = buildEditPrompt('Move the face down');
    expect(p).toContain('Using image 1 (the current thumbnail), move the face down');
    expect(p).toContain('even when it changes the position, size or framing');
    expect(p).toContain('Keep everything the instruction does not mention exactly the same');
    expect(p).not.toContain('preserving the original composition');
  });

  it('describes extra images starting at index 2', () => {
    expect(buildEditPrompt('x', [{ kind: 'persona', name: 'Alex' }])).toContain('- Image 2: photos of Alex');
  });

  it('region edits edit the clean image and use the marked copy only as a guide', () => {
    const p = buildRegionEditPrompt('add a hat');
    expect(p).toContain('Edit image 1');
    expect(p).toContain('Image 2 is the same thumbnail with a translucent magenta overlay');
    expect(p).toContain('within the area marked in image 2: add a hat');
  });
});

describe('quote', () => {
  it('neutralises inner double quotes', () => {
    expect(quote('Say "hi"')).toBe('"Say \'hi\'"');
  });
});

describe('buildUpscalePrompt', () => {
  it('asks for the same image, only sharper', () => {
    const p = buildUpscalePrompt();
    expect(p).toMatch(/^Upscale image 1/);
    expect(p).toContain('Reproduce it exactly');
    expect(p).toContain('Do not add, remove, move or restyle anything');
  });
});

describe('buildFaceFixPrompt', () => {
  it('names the people, keeps the rest, and declares their photos', () => {
    const roles = [
      { kind: 'persona' as const, name: 'Alex' },
      { kind: 'persona' as const, name: 'Alex' },
      { kind: 'persona' as const, name: 'Sam' },
    ];
    const p = buildFaceFixPrompt(['Alex', 'Sam'], roles);
    expect(p).toContain('restore the faces of Alex and Sam');
    expect(p).toContain('Change only the faces');
    expect(p).toContain('- Images 2–3: photos of Alex');
    expect(p).toContain('- Image 4: photos of Sam');
  });
});

describe('buildOutpaintPrompt', () => {
  it('fills only the grey areas, without new subjects', () => {
    const p = buildOutpaintPrompt();
    expect(p).toContain('flat, uniform mid-grey areas are empty');
    expect(p).toContain('Do not change anything outside the grey areas');
    expect(p).toContain('leave no grey behind');
  });
});
