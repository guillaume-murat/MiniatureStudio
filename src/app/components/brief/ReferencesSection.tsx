import { useRef, useState } from 'react';
import { ImagePlus, Library, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Field, Section } from '../Section';
import { Thumb } from '../Thumb';
import { PromptCode } from './PromptCode';
import { MAX_IMAGES, useWorkspace } from '../../stores/workspace';
import { deleteLibraryImage } from '../../lib/db';
import { extractVideoId, fetchThumbnail, fetchVideoTitle } from '../../lib/youtube';
import { useT } from '../../i18n';
import type { ReferenceUse } from '../../lib/types';
import { cn } from '../../lib/utils';

const REFERENCE_USES: ReferenceUse[] = ['free', 'composition', 'style', 'object', 'background'];

function YouTubeRemix() {
  const t = useT();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const { addRef, setBrief, brief } = useWorkspace();

  async function load() {
    const id = extractVideoId(url);
    if (!id) return void toast.error(t('brief.youtubeError'));
    setBusy(true);
    try {
      const [thumb, title] = await Promise.all([fetchThumbnail(id), fetchVideoTitle(id)]);
      if (!thumb) throw new Error('thumbnail');
      addRef(thumb, 'youtube', title ? `YouTube: ${title}` : 'YouTube thumbnail');
      if (title && !brief.videoTitle) setBrief({ videoTitle: title });
      setUrl('');
      toast.success(t('brief.youtubeLoaded'));
    } catch {
      toast.error(t('brief.youtubeError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        load();
      }}
    >
      <Input
        id="youtubeRemix"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t('brief.youtubePlaceholder')}
      />
      <Button type="submit" variant="outline" disabled={!url.trim() || busy}>
        {busy && <Loader2 className="animate-spin" />}
        {t('common.add')}
      </Button>
    </form>
  );
}

function LibraryPicker() {
  const t = useT();
  const { library, addRef, reloadLibrary } = useWorkspace();
  if (library.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" className="text-muted-foreground">
          <Library /> {library.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto">
          {library.map((img) => (
            <div
              key={img.id}
              role="button"
              tabIndex={0}
              onClick={() => addRef(img.blob, 'library')}
              onKeyDown={(e) => e.key === 'Enter' && addRef(img.blob, 'library')}
              className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Thumb
                blob={img.blob}
                removeLabel={t('common.delete')}
                onRemove={async () => {
                  await deleteLibraryImage(img.id);
                  reloadLibrary();
                }}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReferencesSection({ number }: { number: number }) {
  const t = useT();
  const { refs, addFiles, removeRef, setRefUse, clearRefs, previewImageLines } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          {number}. {t('brief.references')}
          <span className="tabular font-normal normal-case">{t('brief.refsCount', { n: refs.length })}</span>
        </span>
      }
      action={
        <div className="flex items-center">
          <LibraryPicker />
          {refs.length > 0 && (
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={clearRefs}>
              {t('brief.clearRefs')}
            </Button>
          )}
        </div>
      }
    >
      <Field label={t('brief.refImages')}>
        {refs.length > 0 && (
          <div className="space-y-1.5">
            {refs.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Thumb
                  blob={r.blob}
                  alt={r.label}
                  badge={r.source === 'youtube' ? 'YT' : undefined}
                  onRemove={() => removeRef(r.id)}
                  removeLabel={t('common.remove')}
                  className="size-11 shrink-0"
                />
                <Select value={r.use ?? 'free'} onValueChange={(v) => setRefUse(r.id, v as ReferenceUse)}>
                  <SelectTrigger className="min-w-0 flex-1" aria-label={t('brief.refUse')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_USES.map((use) => (
                      <SelectItem key={use} value={use}>
                        {t(`brief.refUses.${use}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {refs.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/50',
              dragging && 'border-primary bg-accent',
            )}
          >
            <ImagePlus className="size-4" />
            {t('brief.dropHere')}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <PromptCode text={previewImageLines().references} />
      </Field>
      <Field label={t('brief.youtube')} htmlFor="youtubeRemix">
        <YouTubeRemix />
      </Field>
    </Section>
  );
}
