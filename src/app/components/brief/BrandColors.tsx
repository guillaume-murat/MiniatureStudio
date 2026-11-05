import { useEffect, useState, type ClipboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Field, Section } from '../Section';
import { useWorkspace } from '../../stores/workspace';
import { BRAND_PALETTES, MAX_BRAND_COLORS, mergeColors, normaliseHex, parseHexColors } from '../../lib/colors';
import { colorsLine } from '../../lib/prompt';
import { useSettings } from '../../stores/settings';
import { useT } from '../../i18n';

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-sm border">
      {colors.map((c) => (
        <span key={c} className="size-4" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Hex field for one colour: commits only valid codes, shows the stored value again on blur. */
function HexInput({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const hex = normaliseHex(e.target.value);
        if (hex) onChange(hex);
      }}
      onBlur={() => setText(value)}
      spellCheck={false}
      maxLength={7}
      className="h-8 w-[5.25rem] px-2 font-mono text-xs uppercase"
      aria-label={label}
    />
  );
}

/** Brand colours, sent in the prompt as the dominant accents: a preset palette, pickers, or pasted hex codes. */
export function BrandColors({ number }: { number: number }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { brand, saveBrand, promptOptions } = useWorkspace();
  const [hexText, setHexText] = useState('');
  const colors = brand.colors;
  const save = (next: string[]) => saveBrand({ ...useWorkspace.getState().brand, colors: next });
  const setColor = (i: number, hex: string) => save(colors.map((x, j) => (j === i ? hex : x)));

  /** Adds the hex codes found in pasted or typed text. Returns false when there were none. */
  function addHexColors(text: string): boolean {
    const found = parseHexColors(text);
    if (!found.length) return false;
    const merged = mergeColors(colors, found);
    if (merged.length < new Set([...colors, ...found]).size) toast.warning(t('brand.colorLimit', { n: MAX_BRAND_COLORS }));
    save(merged);
    setHexText('');
    return true;
  }

  function onHexPaste(e: ClipboardEvent<HTMLInputElement>) {
    if (addHexColors(e.clipboardData.getData('text'))) e.preventDefault();
  }

  const preset = BRAND_PALETTES.find((p) => p.colors.join() === colors.join())?.id ?? '';

  return (
    <Section
      foldable
      title={`${number}. ${t('brand.colors')}`}
      prompt={colorsLine(lang, colors, promptOptions().brandWeight)}
    >
      <Field label={t('brand.presets')} htmlFor="brandPalette">
        <Select value={preset} onValueChange={(id) => save([...BRAND_PALETTES.find((p) => p.id === id)!.colors])}>
          <SelectTrigger id="brandPalette" className="w-full">
            <SelectValue placeholder={t('brand.presetsPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="neutral-panel">
            {BRAND_PALETTES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <Swatches colors={p.colors} />
                {t(`brand.palettes.${p.id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {colors.length > 0 && (
        <Field label={t('brand.selected')}>
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((c, i) => (
              <div key={i} className="group relative flex items-center gap-1">
                <label className="block size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: c }}>
                  <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="size-full cursor-pointer opacity-0" aria-label={c} />
                </label>
                <HexInput value={c} onChange={(hex) => setColor(i, hex)} label={`${t('brand.colors')} ${i + 1}`} />
                <Button
                  type="button"
                  onClick={() => save(colors.filter((_, j) => j !== i))}
                  variant="outline"
              size="icon-2xs"
              className="absolute -top-1.5 left-5 hidden group-hover:inline-flex [@media(pointer:coarse)]:inline-flex"
                  aria-label={t('common.remove')}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </Field>
      )}

      <Field label={t('brand.paste')} htmlFor="brandHex">
        <div className="flex gap-2">
          <Input
            id="brandHex"
            value={hexText}
            onChange={(e) => setHexText(e.target.value)}
            onPaste={onHexPaste}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (!addHexColors(hexText)) toast.error(t('brand.noHex'));
            }}
            placeholder={t('brand.pastePlaceholder')}
            spellCheck={false}
            className="font-mono"
          />
          {colors.length < MAX_BRAND_COLORS && (
            <Button variant="outline" size="icon" onClick={() => (hexText.trim() ? addHexColors(hexText) || toast.error(t('brand.noHex')) : save([...colors, '#7c5cff']))} aria-label={t('brand.addColor')}>
              <Plus />
            </Button>
          )}
        </div>
      </Field>
    </Section>
  );
}
