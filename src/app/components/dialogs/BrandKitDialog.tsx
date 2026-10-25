import { useEffect, useState, type ClipboardEvent } from 'react';
import { ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Field } from '../Section';
import { Thumb } from '../Thumb';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { analyseChannelStyle } from '../../lib/ai';
import { extractVideoId, fetchThumbnail } from '../../lib/youtube';
import { normaliseUpload } from '../../lib/images';
import { explainError } from '../../lib/errors';
import { renderFontSpecimen } from '../../lib/fonts';
import { FontPicker } from './FontPicker';
import { BRAND_PALETTES, MAX_BRAND_COLORS, mergeColors, normaliseHex, parseHexColors } from '../../lib/colors';
import { useT } from '../../i18n';
import type { BrandKit } from '../../lib/types';

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
      className="h-9 w-[5.5rem] px-2 font-mono text-xs uppercase"
      aria-label={label}
    />
  );
}

export function BrandKitDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'brand');
  const close = useUI((s) => s.close);
  const { brand, saveBrand } = useWorkspace();
  const [draft, setDraft] = useState<BrandKit>(brand);
  const [urls, setUrls] = useState('');
  const [hexText, setHexText] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const overlayText = useWorkspace((s) => s.brief.overlayText);

  useEffect(() => {
    if (open) setDraft(brand);
  }, [open, brand]);

  const patch = (p: Partial<BrandKit>) => setDraft((d) => ({ ...d, ...p }));
  const setColor = (i: number, hex: string) => patch({ colors: draft.colors.map((x, j) => (j === i ? hex : x)) });

  /** Adds the hex codes found in pasted or typed text. Returns false when there were none. */
  function addHexColors(text: string): boolean {
    const found = parseHexColors(text);
    if (!found.length) return false;
    const colors = mergeColors(draft.colors, found);
    if (colors.length < new Set([...draft.colors, ...found]).size) toast.warning(t('brand.colorLimit', { n: MAX_BRAND_COLORS }));
    patch({ colors });
    setHexText('');
    return true;
  }

  function onHexPaste(e: ClipboardEvent<HTMLInputElement>) {
    if (addHexColors(e.clipboardData.getData('text'))) e.preventDefault();
  }

  const preset = BRAND_PALETTES.find((p) => p.colors.join() === draft.colors.join())?.id ?? '';

  async function analyse() {
    const ids = urls
      .split(/\s+/)
      .map(extractVideoId)
      .filter((x): x is string => !!x)
      .slice(0, 5);
    const settings = useSettings.getState();
    const apiKey = settings.apiKey();
    if (!apiKey) return void toast.error(t('brief.needKey'));
    if (ids.length === 0 && draft.styleRefs.length === 0) return void toast.error(t('brief.youtubeError'));

    setAnalysing(true);
    try {
      const fetched = (await Promise.all(ids.map(fetchThumbnail))).filter((b): b is Blob => !!b);
      const refs = [...draft.styleRefs, ...fetched].slice(-5);
      const profile = await analyseChannelStyle({ provider: settings.provider, apiKey }, refs);
      patch({ styleRefs: refs, styleProfile: profile });
      setUrls('');
    } catch (error) {
      toast.error(t(explainError(error).key), { description: explainError(error).message });
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('brand.title')}</DialogTitle>
          <DialogDescription>{t('brand.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label={t('brand.channelName')} htmlFor="channel">
            <Input id="channel" value={draft.channelName} onChange={(e) => patch({ channelName: e.target.value })} />
          </Field>

          <Field label={t('brand.colors')} hint={t('brand.colorsHint', { n: MAX_BRAND_COLORS })}>
            <Select value={preset} onValueChange={(id) => patch({ colors: [...BRAND_PALETTES.find((p) => p.id === id)!.colors] })}>
              <SelectTrigger className="w-full" aria-label={t('brand.presets')}>
                <SelectValue placeholder={t('brand.presets')} />
              </SelectTrigger>
              <SelectContent>
                {BRAND_PALETTES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <Swatches colors={p.colors} />
                    {t(`brand.palettes.${p.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-2">
              {draft.colors.map((c, i) => (
                <div key={i} className="group relative flex items-center gap-1">
                  <label className="block size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: c }}>
                    <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="size-full cursor-pointer opacity-0" aria-label={c} />
                  </label>
                  <HexInput value={c} onChange={(hex) => setColor(i, hex)} label={`${t('brand.colors')} ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => patch({ colors: draft.colors.filter((_, j) => j !== i) })}
                    className="absolute -top-1.5 left-6 hidden rounded-full bg-foreground p-0.5 text-background group-hover:block [@media(pointer:coarse)]:block"
                    aria-label={t('common.remove')}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {draft.colors.length < MAX_BRAND_COLORS && (
                <Button variant="outline" size="icon" onClick={() => patch({ colors: [...draft.colors, '#7c5cff'] })} aria-label={t('brand.addColor')}>
                  <Plus />
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Input
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
                className="font-mono text-xs"
                aria-label={t('brand.pastePlaceholder')}
              />
              <Button variant="outline" onClick={() => addHexColors(hexText) || toast.error(t('brand.noHex'))} disabled={!hexText.trim()}>
                {t('common.add')}
              </Button>
            </div>
          </Field>

          <Field label={t('brand.font')} hint={t('brand.fontHint')}>
            <FontPicker value={draft.font} onChange={(font) => patch({ font })} sample={overlayText.trim() || draft.channelName.trim() || 'Thumbnail'} />
          </Field>

          <Field label={t('brand.fontStyle')} htmlFor="font">
            <Input id="font" value={draft.fontStyle} onChange={(e) => patch({ fontStyle: e.target.value })} placeholder={t('brand.fontStylePlaceholder')} />
          </Field>

          <Field label={t('brand.notes')} htmlFor="notes">
            <Input id="notes" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder={t('brand.notesPlaceholder')} />
          </Field>

          <Field label={t('brand.logo')}>
            <div className="flex items-center gap-2">
              {draft.logo && <Thumb blob={draft.logo} className="size-12" onRemove={() => patch({ logo: undefined })} removeLabel={t('common.remove')} />}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async () => input.files?.[0] && patch({ logo: await normaliseUpload(input.files[0], 1024) });
                  input.click();
                }}
              >
                <ImagePlus /> {t('common.add')}
              </Button>
            </div>
          </Field>

          <Separator />

          <Field label={t('brand.styleProfile')} hint={t('brand.styleProfileHint')}>
            <Textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={t('brand.styleUrlsPlaceholder')}
              className="min-h-16 font-mono text-xs"
            />
            <Button variant="secondary" size="sm" className="mt-2" onClick={analyse} disabled={analysing}>
              {analysing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {analysing ? t('brand.analysing') : t('brand.analyse')}
            </Button>
          </Field>

          {draft.styleRefs.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-1.5">
                {draft.styleRefs.map((b, i) => (
                  <Thumb
                    key={i}
                    blob={b}
                    className="aspect-video"
                    onRemove={() => patch({ styleRefs: draft.styleRefs.filter((_, j) => j !== i) })}
                    removeLabel={t('common.remove')}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                {t('brand.sendStyleRefs')}
                <Switch checked={draft.sendStyleRefs} onCheckedChange={(v) => patch({ sendStyleRefs: v })} />
              </label>
            </div>
          )}

          <Textarea
            value={draft.styleProfile}
            onChange={(e) => patch({ styleProfile: e.target.value })}
            placeholder={t('brand.profilePlaceholder')}
            className="min-h-28 text-sm"
            aria-label={t('brand.styleProfile')}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              let { fontSpecimen } = draft;
              if (!draft.font) fontSpecimen = undefined;
              else if (draft.font !== brand.font || !fontSpecimen) {
                // The image model can't load the font: it gets a rendered specimen instead.
                fontSpecimen = await renderFontSpecimen(draft.font).catch(() => {
                  toast.warning(t('brand.fontSpecimenFailed'));
                  return undefined;
                });
              }
              const configured = !!(draft.styleProfile || draft.colors.length || draft.font || draft.fontStyle || draft.logo);
              await saveBrand({ ...draft, fontSpecimen, enabled: draft.enabled || (configured && !brand.updatedAt) });
              setSaving(false);
              close();
            }}
          >
            {saving && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
