import { useState } from 'react';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Section } from '../Section';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useWorkspace } from '../../stores/workspace';
import { normaliseUpload } from '../../lib/images';
import { fetchChannel } from '../../lib/youtube';
import { useT } from '../../i18n';
import type { BrandKit } from '../../lib/types';

/**
 * The channel name and picture, shown with the thumbnail in the feed preview.
 * Typed and uploaded, or read from a pasted channel or video URL.
 */
export function ChannelSection() {
  const t = useT();
  const { brand, saveBrand } = useWorkspace();
  const logo = useBlobUrl(brand.logo);
  const [url, setUrl] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
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
    await save({ channelName: channel.name, ...(channel.logo ? { logo: channel.logo } : {}) });
    setUrl('');
    setName(null);
    toast.success(t('brand.channelLoaded', { name: channel.name }));
  }

  return (
    <Section title={t('brand.channel')}>
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
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
        <Input
          value={name ?? brand.channelName}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== null && save({ channelName: name.trim() })}
          placeholder={t('brand.channelName')}
          aria-label={t('brand.channelName')}
        />
      </div>
      <div className="flex gap-2">
        <Input
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
          className="text-xs"
          aria-label={t('brand.channelUrlPlaceholder')}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => fromUrl()} disabled={fetching || !url.trim()} aria-label={t('brand.channelFetch')}>
              {fetching ? <Loader2 className="animate-spin" /> : <Link2 />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('brand.channelFetch')}</TooltipContent>
        </Tooltip>
      </div>
    </Section>
  );
}
