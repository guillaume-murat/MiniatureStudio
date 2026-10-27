import { describe, expect, it } from 'vitest';
import { buildEditPrompt, buildGenerationPrompt, buildOutpaintPrompt, buildRegionEditPrompt, buildUpscalePrompt, describeImages, quote } from '../prompt';

const base = { brief: 'A developer on Mars', aspectRatio: '16:9' as const, roles: [] };

describe('buildGenerationPrompt', () => {
  it('states the format and the scene', () => {
    const p = buildGenerationPrompt(base);
    expect(p).toMatch(/^Generate a 16:9 YouTube video thumbnail\./);
    expect(p).toContain('Scene: A developer on Mars');
  });

  it('keeps text out of the image and leaves room for it', () => {
    const p = buildGenerationPrompt(base);
    expect(p).toContain('no lettering, captions or watermarks');
    expect(p).toContain('clean, uncluttered area in the upper part or one side');
    expect(buildGenerationPrompt({ ...base, aspectRatio: '9:16' })).toContain('in the upper third');
  });

  it('adds the video title as context without asking to repeat it', () => {
    const p = buildGenerationPrompt({ ...base, videoTitle: 'I coded on Mars' });
    expect(p).toContain('"I coded on Mars"');
    expect(p).toContain('rather than repeat it');
  });

  it('includes the style and the brand colours when given', () => {
    expect(buildGenerationPrompt(base)).not.toContain('Brand colours');
    const p = buildGenerationPrompt({ ...base, style: 'Clay render', colors: ['#ff0000', '#00ff00'] });
    expect(p).toContain('Art direction: Clay render');
    expect(p).toContain('Brand colours: #ff0000, #00ff00');
  });
});

describe('describeImages', () => {
  it('groups consecutive photos of the same person', () => {
    const lines = describeImages([
      { kind: 'persona', name: 'Alex' },
      { kind: 'persona', name: 'Alex', expression: 'surprised' },
      { kind: 'persona', name: 'Sam' },
      { kind: 'reference', label: 'logo' },
    ]);
    expect(lines[0]).toMatch(/^- Images 1–2: photos of Alex\./);
    expect(lines[0]).toContain('surprised');
    expect(lines[1]).toMatch(/^- Image 3: photos of Sam\./);
    expect(lines[2]).toMatch(/^- Image 4: reference image \(logo\)/);
  });

  it('supports an index offset', () => {
    expect(describeImages([{ kind: 'reference' }], 1)[0]).toMatch(/^- Image 2:/);
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

describe('buildOutpaintPrompt', () => {
  it('fills only the grey areas, without new subjects', () => {
    const p = buildOutpaintPrompt();
    expect(p).toContain('flat, uniform mid-grey areas are empty');
    expect(p).toContain('Do not change anything outside the grey areas');
    expect(p).toContain('leave no grey behind');
  });
});
