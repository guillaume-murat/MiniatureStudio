import { describe, expect, it } from 'vitest';
import { brandWeightLine, buildEditPrompt, buildGenerationPrompt, buildOutpaintPrompt, buildRegionEditPrompt, buildUpscalePrompt, colorsLine, DEFAULT_PROMPT_OPTIONS, describeImages, formatLine, IMAGES_HEADER, marginLine, outputRatio, priorityLine, qualityLine, sceneLine, styleLine, textLine, titleLine, titlePreviewLine, titleZoneLine } from '../prompt';

const base = { brief: 'Une développeuse sur Mars', aspectRatio: '16:9' as const, roles: [] };

describe('option previews', () => {
  it('shows the text sent for the brand weight', () => {
    expect(colorsLine(['#ff0000'], 'dominant')).toContain(brandWeightLine('dominant'));
  });
});

describe('outputRatio', () => {
  it('keeps the two formats and falls back to 16:9 for the others', () => {
    expect(outputRatio('9:16')).toBe('9:16');
    expect(outputRatio('16:9')).toBe('16:9');
    expect(outputRatio('4:3')).toBe('16:9');
    expect(outputRatio('1:1')).toBe('16:9');
    expect(outputRatio(undefined)).toBe('16:9');
  });
});

describe('buildGenerationPrompt', () => {
  it('is made of the lines shown in the brief panel', () => {
    const p = buildGenerationPrompt({ ...base, videoTitle: 'Mars', style: 'Flat', colors: ['#ff0000'] });
    for (const line of [formatLine('16:9'), titleLine('Mars'), styleLine('Flat'), textLine(), titleZoneLine(), colorsLine(['#ff0000'])]) {
      expect(p).toContain(line);
    }
    expect([titleLine(' '), colorsLine([])]).toEqual(['', '']);
    expect(buildGenerationPrompt(base)).toContain(styleLine());
    expect(styleLine()).toContain('informations fournies dans la scène');
  });

  it('sends nothing beyond the blocks shown in the brief panel', () => {
    const roles = [{ kind: 'persona', name: 'Alex' }, { kind: 'reference' }] as const;
    let p = buildGenerationPrompt({ ...base, roles: [...roles], videoTitle: 'Mars', style: 'Flat', colors: ['#ff0000'] });
    const shown = [formatLine('16:9'), titleLine('Mars'), sceneLine(base.brief), styleLine('Flat', 1), textLine(), titleZoneLine(), IMAGES_HEADER, ...describeImages([...roles]), colorsLine(['#ff0000']), qualityLine(), marginLine(), priorityLine()];
    for (const block of shown) {
      expect(p).toContain(block);
      p = p.replace(block, '');
    }
    expect(p.trim()).toBe('');
  });

  it('always asks for an efficient thumbnail', () => {
    expect(buildGenerationPrompt(base)).toContain(qualityLine());
    expect(qualityLine()).toContain('sur youtube version mobile');
  });

  it('asks for margins rather than a centred subject', () => {
    const p = buildGenerationPrompt(base);
    expect(p).not.toContain('centraux');
    expect(p).toContain('Garde le coin bas droit libre');
  });

  it('follows the advanced options', () => {
    const options = { ...DEFAULT_PROMPT_OPTIONS, text: 'style', titleZone: 'none', brandWeight: 'dominant' } as const;
    const p = buildGenerationPrompt({ ...base, colors: ['#ff0000'], options });
    expect(p).toContain('uniquement les éléments courts');
    expect(p).not.toContain('zone dégagée');
    expect(p).toContain('couleurs dominantes de l’image');
    expect(p).not.toContain('point focal');
  });

  it('places the title area where asked, or nowhere', () => {
    expect(titleZoneLine('top-left')).toContain('en haut à gauche');
    expect(titleZoneLine('center')).toContain('au centre');
    expect(titleZoneLine('bottom-right')).toContain('au-dessus du coin où s’affiche la durée');
    expect(titleZoneLine('none')).toBe('');
  });

  it('explains the style’s people when they differ from who is attached', () => {
    const one = 'La personne mise en avant sourit.';
    expect(styleLine(one, 1)).toBe(`Direction artistique : ${one}`);
    expect(styleLine(one, 0)).toContain('Aucune photo de personne');
    expect(styleLine(one, 2)).toContain('les désigne toutes');
    expect(styleLine('Deux personnes face à face.', 1)).toContain('Une seule personne');
    expect(styleLine('Un paysage.', 0)).toBe('Direction artistique : Un paysage.');
  });

  it('states the format and the scene', () => {
    const p = buildGenerationPrompt(base);
    expect(p).toMatch(/^Génère une miniature de vidéo YouTube au format 16:9\./);
    expect(p).toContain('Scène : Une développeuse sur Mars');
  });

  it('keeps text out of the image and reserves no room for it unless asked', () => {
    const p = buildGenerationPrompt(base);
    expect(p).toContain('aucune lettre, aucun chiffre, légende ni filigrane');
    expect(p).not.toContain('zone dégagée');
    const options = { ...DEFAULT_PROMPT_OPTIONS, titleZone: 'top' } as const;
    expect(buildGenerationPrompt({ ...base, options })).toContain('zone dégagée et épurée en haut pour l’accueillir');
  });

  it('previews the title block without a title but sends nothing', () => {
    expect(titlePreviewLine(' ')).toContain('[titre de la vidéo]');
    expect(titlePreviewLine('Mars')).toBe(titleLine('Mars'));
    expect(buildGenerationPrompt(base)).not.toContain('titre de la vidéo');
  });

  it('adds the video title as context without asking to repeat it', () => {
    const p = buildGenerationPrompt({ ...base, videoTitle: 'J’ai codé sur Mars' });
    expect(p).toContain('J’ai codé sur Mars');
    expect(p).not.toContain('"');
    expect(p).toContain('à ne pas écrire dans l’image');
    expect(p).toContain('plutôt que le répéter');
  });

  it('includes the style and the brand colours when given', () => {
    expect(buildGenerationPrompt(base)).not.toContain('Couleurs de marque');
    const p = buildGenerationPrompt({ ...base, style: 'Pâte à modeler', colors: ['#ff0000', '#00ff00'] });
    expect(p).toContain('Direction artistique : Pâte à modeler');
    expect(p).toContain('Couleurs de marque : #ff0000, #00ff00');
  });
});

describe('describeImages', () => {
  it('groups consecutive photos of the same person', () => {
    const lines = describeImages([
      { kind: 'persona', name: 'Alex' },
      { kind: 'persona', name: 'Alex', expression: 'surpris' },
      { kind: 'persona', name: 'Sam' },
      { kind: 'reference', label: 'logo' },
    ]);
    expect(lines[0]).toMatch(/^- Images 1–2 : photos d’Alex\./);
    expect(lines[0]).toContain('surpris');
    expect(lines[1]).toMatch(/^- Image 3 : photos de Sam\./);
    expect(lines[2]).toMatch(/^- Image 4 : image de référence \(logo\)/);
  });

  it('tells what each reference is for', () => {
    expect(describeImages([{ kind: 'reference', use: 'style' }])[0]).toContain('référence de style');
    expect(describeImages([{ kind: 'reference', use: 'object', label: 'montre' }])[0]).toContain('objet (montre) à reproduire');
    expect(describeImages([{ kind: 'reference' }])[0]).toContain('si le brief n’en parle pas');
  });

  it('supports an index offset', () => {
    expect(describeImages([{ kind: 'reference' }], 1)[0]).toMatch(/^- Image 2 :/);
  });
});

describe('edit prompts', () => {
  it('applies the instruction fully and keeps only what it does not mention', () => {
    const p = buildEditPrompt('Descends le visage');
    expect(p).toContain('À partir de l’image 1 (la miniature actuelle), descends le visage');
    expect(p).toContain('même si elle change la position, la taille ou le cadrage');
    expect(p).toContain('Garde exactement à l’identique tout ce que l’instruction ne mentionne pas');
    expect(p).not.toContain('composition d’origine');
  });

  it('describes extra images starting at index 2', () => {
    expect(buildEditPrompt('x', [{ kind: 'persona', name: 'Alex' }])).toContain('- Image 2 : photos d’Alex');
  });

  it('region edits edit the clean image and use the marked copy only as a guide', () => {
    const p = buildRegionEditPrompt('ajoute un chapeau');
    expect(p).toContain('Modifie l’image 1');
    expect(p).toContain('L’image 2 est la même miniature avec un calque magenta translucide');
    expect(p).toContain('à l’intérieur de la zone marquée sur l’image 2 : ajoute un chapeau');
  });
});

describe('buildUpscalePrompt', () => {
  it('asks for the same image, only sharper', () => {
    const p = buildUpscalePrompt();
    expect(p).toMatch(/^Agrandis l’image 1/);
    expect(p).toContain('Reproduis-la exactement');
    expect(p).toContain('N’ajoute, ne supprime, ne déplace et ne restyle rien');
  });
});

describe('buildOutpaintPrompt', () => {
  it('fills only the grey areas, without new subjects', () => {
    const p = buildOutpaintPrompt();
    expect(p).toContain('zones gris moyen, plates et uniformes, sont vides');
    expect(p).toContain('Ne change rien en dehors des zones grises');
    expect(p).toContain('ne laisse aucun gris');
  });
});
