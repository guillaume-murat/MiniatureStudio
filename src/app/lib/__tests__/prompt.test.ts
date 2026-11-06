import { describe, expect, it } from 'vitest';
import { brandWeightLine, buildEditPrompt, buildFaceFixPrompt, buildGenerationPrompt, buildHealPrompt, identityLine, buildOutpaintPrompt, buildRegionEditPrompt, buildUpscalePrompt, colorsLine, DEFAULT_PROMPT_OPTIONS, describeImages, formatLine, imagesHeader, marginLine, outputRatio, priorityLine, qualityLine, sceneLine, styleLine, textLine, titleLine, titlePreviewLine, titleZoneLine } from '../prompt';

const base = { lang: 'fr' as const, brief: 'Une développeuse sur Mars', aspectRatio: '16:9' as const, roles: [] };

describe('option previews', () => {
  it('shows the text sent for the brand weight', () => {
    expect(colorsLine('fr', ['#ff0000'], 'dominant')).toContain(brandWeightLine('fr', 'dominant'));
  });
});

describe('identityLine', () => {
  const alex = { kind: 'persona', name: 'Alex' } as const;
  const ines = { kind: 'persona', name: 'Inès' } as const;

  it('names the featured person with the numbers of their photos', () => {
    const line = identityLine('fr', [ines, ines, ines, { kind: 'reference' }]);
    expect(line).toContain('La personne mise en avant est Inès (images 1–3).');
    expect(line).toContain('même personne, immédiatement reconnaissable');
    expect(line).toContain('Seule l’expression change');
  });

  it('names every person when there are several', () => {
    const line = identityLine('fr', [ines, ines, alex]);
    expect(line).toContain('Les personnes mises en avant sont Inès (images 1–2) et Alex (image 3).');
    expect(identityLine('en', [ines, alex])).toContain('The featured people are Inès (image 1) and Alex (image 2).');
  });

  it('adds nothing without photos of people', () => {
    expect(identityLine('fr', [{ kind: 'reference' }])).toBe('');
  });

  it('comes right after the scene', () => {
    const p = buildGenerationPrompt({ ...base, roles: [ines], style: 'Flat' });
    expect(p.indexOf(identityLine('fr', [ines]))).toBeGreaterThan(p.indexOf(sceneLine('fr', base.brief)));
    expect(p.indexOf(identityLine('fr', [ines]))).toBeLessThan(p.indexOf(styleLine('fr', 'Flat', 1)));
  });
});

describe('photos of a person', () => {
  it('keep the face when the expression changes', () => {
    const [line] = describeImages('fr', [{ kind: 'persona', name: 'Alex' }]);
    expect(line).toContain('même si son expression change');
    expect(buildEditPrompt('en', 'x', [{ kind: 'persona', name: 'Alex' }])).toContain('even if the expression changes');
  });
});

describe('buildFaceFixPrompt', () => {
  it('replaces the face in the marked area with the person of the photos sent after it', () => {
    const p = buildFaceFixPrompt('fr', [{ kind: 'persona', name: 'Inès' }, { kind: 'persona', name: 'Inès' }]);
    expect(p).toContain('L’image 2 est la même miniature');
    expect(p).toContain('remplace le visage par celui d’Inès (images 3–4)');
    expect(p).toContain('Garde l’expression, l’orientation de la tête');
    expect(p).toContain('- Images 3–4 : photos d’Inès');
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
    for (const line of [formatLine('fr', '16:9'), titleLine('fr', 'Mars'), styleLine('fr', 'Flat'), textLine('fr'), titleZoneLine('fr'), colorsLine('fr', ['#ff0000'])]) {
      expect(p).toContain(line);
    }
    expect([titleLine('fr', ' '), colorsLine('fr', [])]).toEqual(['', '']);
    expect(buildGenerationPrompt(base)).toContain(styleLine('fr'));
    expect(styleLine('fr')).toContain('informations fournies dans la scène');
  });

  it('sends nothing beyond the blocks shown in the brief panel', () => {
    const roles = [{ kind: 'persona', name: 'Alex' }, { kind: 'reference' }] as const;
    let p = buildGenerationPrompt({ ...base, roles: [...roles], videoTitle: 'Mars', style: 'Flat', colors: ['#ff0000'] });
    const shown = [formatLine('fr', '16:9'), titleLine('fr', 'Mars'), sceneLine('fr', base.brief), identityLine('fr', [...roles]), styleLine('fr', 'Flat', 1), textLine('fr'), titleZoneLine('fr'), imagesHeader('fr'), ...describeImages('fr', [...roles]), colorsLine('fr', ['#ff0000']), qualityLine('fr'), marginLine('fr'), priorityLine('fr')];
    for (const block of shown) {
      expect(p).toContain(block);
      p = p.replace(block, '');
    }
    expect(p.trim()).toBe('');
  });

  it('always asks for an efficient thumbnail', () => {
    expect(buildGenerationPrompt(base)).toContain(qualityLine('fr'));
    expect(qualityLine('fr')).toContain('sur youtube version mobile');
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
    expect(titleZoneLine('fr', 'top-left')).toContain('en haut à gauche');
    expect(titleZoneLine('fr', 'center')).toContain('au centre');
    expect(titleZoneLine('fr', 'bottom-right')).toContain('au-dessus du coin où s’affiche la durée');
    expect(titleZoneLine('fr', 'none')).toBe('');
  });

  it('explains the style’s people when they differ from who is attached', () => {
    const one = 'La personne mise en avant sourit.';
    expect(styleLine('fr', one, 1)).toBe(`Direction artistique : ${one}`);
    expect(styleLine('fr', one, 0)).toContain('Aucune photo de personne');
    expect(styleLine('fr', one, 2)).toContain('les désigne toutes');
    expect(styleLine('fr', 'Deux personnes face à face.', 1)).toContain('Une seule personne');
    expect(styleLine('fr', 'Un paysage.', 0)).toBe('Direction artistique : Un paysage.');
    expect(styleLine('fr', '- Un paysage\n- Fond clair', 0)).toBe('Direction artistique :\n- Un paysage\n- Fond clair');
    expect(styleLine('fr', '- La personne\n- Fond clair', 0)).toMatch(/Fond clair\n- Aucune photo de personne/);
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
    expect(titlePreviewLine('fr', ' ')).toContain('[titre de la vidéo]');
    expect(titlePreviewLine('fr', 'Mars')).toBe(titleLine('fr', 'Mars'));
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
    const lines = describeImages('fr', [
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
    expect(describeImages('fr', [{ kind: 'reference', use: 'style' }])[0]).toContain('référence de style');
    expect(describeImages('fr', [{ kind: 'reference', use: 'object', label: 'montre' }])[0]).toContain('objet (montre) à reproduire');
    expect(describeImages('fr', [{ kind: 'reference' }])[0]).toContain('si le brief n’en parle pas');
  });

  it('supports an index offset', () => {
    expect(describeImages('fr', [{ kind: 'reference' }], 1)[0]).toMatch(/^- Image 2 :/);
  });
});

describe('edit prompts', () => {
  it('applies the instruction fully and keeps only what it does not mention', () => {
    const p = buildEditPrompt('fr', 'Descends le visage');
    expect(p).toContain('À partir de l’image 1 (la miniature actuelle), descends le visage');
    expect(p).toContain('même si elle change la position, la taille ou le cadrage');
    expect(p).toContain('Garde exactement à l’identique tout ce que l’instruction ne mentionne pas');
    expect(p).not.toContain('composition d’origine');
  });

  it('describes extra images starting at index 2', () => {
    expect(buildEditPrompt('fr', 'x', [{ kind: 'persona', name: 'Alex' }])).toContain('- Image 2 : photos d’Alex');
  });

  it('region edits edit the clean image and use the marked copy only as a guide', () => {
    const p = buildRegionEditPrompt('fr', 'ajoute un chapeau');
    expect(p).toContain('Modifie l’image 1');
    expect(p).toContain('L’image 2 est la même miniature avec un calque magenta translucide');
    expect(p).toContain('à l’intérieur de la zone marquée sur l’image 2 : ajoute un chapeau');
  });

  it('region edits describe the selected people after the two images of the thumbnail', () => {
    const p = buildRegionEditPrompt('fr', 'remplace ce visage', [{ kind: 'persona', name: 'Alex' }, { kind: 'persona', name: 'Alex' }, { kind: 'persona', name: 'Sam' }]);
    expect(p).toContain('Autres images jointes :');
    expect(p).toContain('- Images 3–4 : photos d’Alex');
    expect(p).toContain('- Image 5 : photos de Sam');
    expect(buildRegionEditPrompt('fr', 'x')).not.toContain('Autres images jointes');
  });
});

describe('buildUpscalePrompt', () => {
  it('asks for the same image, only sharper', () => {
    const p = buildUpscalePrompt('fr');
    expect(p).toMatch(/^Agrandis l’image 1/);
    expect(p).toContain('Reproduis-la exactement');
    expect(p).toContain('N’ajoute, ne supprime, ne déplace et ne restyle rien');
  });
});

describe('buildOutpaintPrompt', () => {
  it('fills only the grey areas, without new subjects', () => {
    const p = buildOutpaintPrompt('fr');
    expect(p).toContain('zones gris moyen, plates et uniformes, sont vides');
    expect(p).toContain('Ne change rien en dehors des zones grises');
    expect(p).toContain('ne laisse aucun gris');
  });
});

describe('the prompts follow the interface language', () => {
  const en = { ...base, lang: 'en' as const, brief: 'A developer on Mars' };

  it('writes the whole generation prompt in that language', () => {
    const roles = [{ kind: 'persona', name: 'Alex', expression: 'surprised' }, { kind: 'reference', use: 'style', label: 'logo' }] as const;
    const options = { text: 'style', titleZone: 'bottom-right', brandWeight: 'dominant' } as const;
    const p = buildGenerationPrompt({ ...en, roles: [...roles], videoTitle: 'Mars', style: 'Flat', colors: ['#ff0000'], options });
    expect(p).toMatch(/^Generate a YouTube video thumbnail in 16:9 format\. The thumbnail will appear next to the video title: Mars\./);
    for (const part of ['Scene: A developer on Mars', 'Art direction: Flat', 'Attached images, in order:', '- Image 1: photos of Alex.', 'typical expressions: surprised', '- Image 2: style reference (logo):', 'Brand colours: #ff0000.', 'the corner where the duration appears']) {
      expect(p).toContain(part);
    }
    // None of the French words the prompts are made of.
    expect(p).not.toMatch(/\b(Génère|Scène|Direction artistique|miniature|Couleurs|Garde|Images jointes)\b/);
  });

  it('keeps the blocks shown in the brief panel the same as what is sent', () => {
    let p = buildGenerationPrompt({ ...en, videoTitle: 'Mars', style: 'Flat' });
    for (const block of [formatLine('en', '16:9'), titleLine('en', 'Mars'), sceneLine('en', en.brief), styleLine('en', 'Flat', 0), textLine('en'), qualityLine('en'), marginLine('en'), priorityLine('en')]) {
      expect(p).toContain(block);
      p = p.replace(block, '');
    }
    expect(p.trim()).toBe('');
  });

  it('writes the edit prompts in that language', () => {
    const edit = buildEditPrompt('en', 'Make the face bigger', [{ kind: 'persona', name: 'Alex' }]);
    expect(edit).toContain('Starting from image 1 (the current thumbnail), make the face bigger');
    expect(edit).toContain('Other attached images:\n- Image 2: photos of Alex');
    expect(buildRegionEditPrompt('en', 'add a hat')).toContain('inside the area marked on image 2: add a hat');
    expect(buildHealPrompt('en')).toContain('Add nothing new');
    expect(buildHealPrompt('fr')).toContain('N’ajoute rien de nouveau');
    expect(buildUpscalePrompt('en')).toMatch(/^Enlarge image 1/);
    expect(buildOutpaintPrompt('en')).toContain('Change nothing outside the grey areas');
  });

  it('notices the people of a style written in either language, as a user’s own stays as typed', () => {
    expect(styleLine('en', 'The featured person smiles.', 0)).toContain('No photo of a person');
    expect(styleLine('en', 'La personne sourit.', 0)).toContain('No photo of a person');
    expect(styleLine('fr', 'Two people talking.', 1)).toContain('Une seule personne');
    expect(styleLine('en', 'A landscape.', 0)).toBe('Art direction: A landscape.');
  });

  it('previews the missing title in that language', () => {
    expect(titlePreviewLine('en', ' ')).toContain('[video title]');
  });
});
