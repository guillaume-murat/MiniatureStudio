import { useEffect, useState } from 'react';
import { ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Field, Section } from '../Section';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace } from '../../stores/workspace';
import { normaliseUpload } from '../../lib/images';
import { fetchChannel } from '../../lib/youtube';
import { useT } from '../../i18n';
import type { BrandKit } from '../../lib/types';
import { cn } from '../../lib/utils';

/**
 * The channel name and picture, shown with the thumbnail in the feed preview.
 * Typed and uploaded, or read from a pasted channel or video URL. Set once per
 * project and never sent to the model: folded to one line when a project opens
 * with it filled, or once loaded.
 */
export function ChannelSection() {
  const t = useT();
  const { brand, saveBrand, projectId } = useWorkspace();
  const logo = useBlobUrl(brand.logo);
  const [url, setUrl] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const filled = !!(brand.channelName.trim() || brand.logo);
  const [open, setOpen] = useState(!filled);
  useEffect(() => {
    setOpen(!filled);
    setName(null);
    // Only when another project opens: typing a name must not fold the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const save = (patch: Partial<BrandKit>) => saveBrand({ ...useWorkspace.getState().brand, ...patch });

  function pickLogo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      // A profile picture is shown tiny: 512 px is plenty.
      if (file) save({ logo: await normaliseUpload(file, 512) });
    };
    input.click();
  }

  async function fromUrl(value = url) {
    if (!value.trim()) return;
    setFetching(true);
    const channel = await fetchChannel(value);
    setFetching(false);
    if (!channel) return void toast.error(t('brand.channelError'));
    // The banner goes to the channel preview; a channel without one keeps the current banner.
    await save({ channelName: channel.name, ...(channel.logo ? { logo: channel.logo } : {}), ...(channel.banner ? { banner: channel.banner } : {}) });
    setUrl('');
    setName(null);
    setOpen(false);
    toast.success(t('brand.channelLoaded', { name: channel.name }));
  }

  const title = filled ? (
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 tracking-wide uppercase">
      <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
      {t('brand.channel')}
    </button>
  ) : (
    t('brand.channel')
  );

  if (filled && !open) {
    return (
      <Section title={title}>
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent">
          {logo && <img src={logo} alt="" className="size-6 shrink-0 rounded-full object-cover" />}
          <span className="truncate">{brand.channelName || t('brand.logoLabel')}</span>
        </button>
      </Section>
    );
  }

  return (
    <Section title={title}>
      <Field label={t('brand.channelUrl')} htmlFor="channelUrl" hint={t('brand.channelUrlHint')}>
        <div className="flex gap-2">
          <Input
            id="channelUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              // A pasted URL is fetched right away.
              const pasted = e.clipboardData.getData('text');
              if (/youtu/.test(pasted)) {
                e.preventDefault();
                setUrl(pasted);
                fromUrl(pasted);
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && fromUrl()}
            placeholder={t('brand.channelUrlPlaceholder')}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => fromUrl()} disabled={fetching || !url.trim()}>
                {fetching && <Loader2 className="animate-spin" />}
                {t('brand.channelLoad')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('brand.channelFetch')}</TooltipContent>
          </Tooltip>
        </div>
      </Field>
      <div className="flex gap-2">
        <Field label={t('brand.logoLabel')} className="shrink-0">
          <div className="relative w-fit">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={pickLogo}
                  className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-dashed bg-background text-muted-foreground hover:bg-accent"
                  aria-label={t('brand.logo')}
                >
                  {logo ? <img src={logo} alt="" className="size-full object-cover" /> : <ImagePlus className="size-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('brand.logoHint')}</TooltipContent>
            </Tooltip>
            {logo && (
              <button
                type="button"
                onClick={() => save({ logo: undefined })}
                className="absolute -top-1 -right-1 rounded-full bg-foreground p-0.5 text-background"
                aria-label={t('common.remove')}
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        </Field>
        <Field label={t('brand.channelName')} htmlFor="channelName" className="min-w-0 flex-1">
          <Input
            id="channelName"
            value={name ?? brand.channelName}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== null && save({ channelName: name.trim() })}
            placeholder={t('brand.channelNamePlaceholder')}
          />
        </Field>
      </div>
    </Section>
  );
}
