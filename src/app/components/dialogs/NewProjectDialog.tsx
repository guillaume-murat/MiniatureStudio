import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Field } from '../Section';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { extractVideoId, fetchProjectStart } from '../../lib/youtube';
import { startName, type ProjectStart } from '../../lib/projectStart';
import { useT } from '../../i18n';

/** Looks like something to fetch: a YouTube URL, a video id or an @handle. */
const looksLikeYouTube = (value: string) => /youtu\.?be|^@[\w.-]+$/i.test(value.trim()) || !!extractVideoId(value);

/**
 * Names a new project before creating it. A YouTube video or channel URL, fetched as soon as it is
 * pasted, starts it with the channel (logo, name, banner) and, for a video, its title and thumbnail.
 */
export function NewProjectDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'newProject');
  const close = useUI((s) => s.close);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [start, setStart] = useState<ProjectStart | null>(null);
  const [fetching, setFetching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // The fetch under way, awaited by « Créer le projet »; the counter drops answers to an older URL.
  const pending = useRef<Promise<ProjectStart | null> | null>(null);
  const request = useRef(0);
  const loaded = useRef('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setUrl('');
    setStart(null);
    setFailed(false);
    setFetching(false);
    pending.current = null;
    loaded.current = '';
    request.current++;
  }, [open]);

  /** Fetches what the URL brings, for the preview; returns the fetch « Créer le projet » waits for. */
  function load(value: string): Promise<ProjectStart | null> {
    loaded.current = value.trim();
    const id = ++request.current;
    setStart(null);
    setFailed(false);
    if (!looksLikeYouTube(value)) {
      pending.current = null;
      setFetching(false);
      if (value.trim()) setFailed(true);
      return Promise.resolve(null);
    }
    setFetching(true);
    const promise = fetchProjectStart(value).then((found) => {
      if (id !== request.current) return found;
      setStart(found);
      setFailed(!found);
      setFetching(false);
      return found;
    });
    pending.current = promise;
    return promise;
  }

  async function create() {
    setBusy(true);
    try {
      // A fetch that failed counts as no URL: the project is created all the same.
      // A URL typed and not fetched yet (Enter in the field) is fetched now.
      const fetch = url.trim() !== loaded.current ? load(url) : pending.current;
      const found = fetch ? await fetch.catch(() => null) : start;
      await useWorkspace.getState().newProject(startName(name, found), found);
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className="max-w-lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('newProject.title')}</DialogTitle>
            <DialogDescription>{t('newProject.description')}</DialogDescription>
          </DialogHeader>

          <Field label={t('newProject.url')} htmlFor="newProjectUrl" hint={t('newProject.urlHint')}>
            <Input
              id="newProjectUrl"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={url}
              placeholder={t('newProject.urlPlaceholder')}
              onChange={(e) => {
                setUrl(e.target.value);
                // Emptied: the project starts empty again; changed: the preview no longer matches.
                if (!e.target.value.trim()) load('');
                else if (e.target.value.trim() !== loaded.current) {
                  request.current++;
                  pending.current = null;
                  setStart(null);
                  setFailed(false);
                  setFetching(false);
                }
              }}
              // A pasted URL is fetched right away; a typed one when the field is left.
              onPaste={(e) => {
                const input = e.currentTarget;
                setTimeout(() => load(input.value));
              }}
              onBlur={() => {
                if (url.trim() !== loaded.current) load(url);
              }}
            />
          </Field>

          {fetching && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" />
              {t('newProject.fetching')}
            </p>
          )}
          {failed && !fetching && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground" role="status">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {t('newProject.error')}
            </p>
          )}
          {start && !fetching && <StartPreview start={start} />}

          <Field label={t('newProject.name')} htmlFor="newProjectName">
            <Input
              id="newProjectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={startName('', start) ?? t('topbar.untitled')}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t('newProject.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What the URL brought: the channel (banner, logo, name) and, for a video, its thumbnail and title. */
function StartPreview({ start }: { start: ProjectStart }) {
  const t = useT();
  const banner = useBlobUrl(start.channel?.banner);
  const logo = useBlobUrl(start.channel?.logo);
  const thumbnail = useBlobUrl(start.video?.thumbnail);
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-sm">
      {banner && <img src={banner} alt="" className="h-14 w-full object-cover" />}
      <div className="space-y-3 p-3">
        {start.channel && (
          <div className="flex items-center gap-2.5">
            {logo ? <img src={logo} alt="" className="size-9 shrink-0 rounded-full object-cover" /> : <span className="size-9 shrink-0 rounded-full bg-muted" />}
            <span className="truncate font-medium">{start.channel.name}</span>
          </div>
        )}
        {start.video && (
          <div className="flex items-start gap-2.5">
            {thumbnail && <img src={thumbnail} alt="" className="aspect-video w-28 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0 space-y-1">
              {start.video.title && <p className="line-clamp-2 font-medium">{start.video.title}</p>}
              {thumbnail && <p className="text-xs text-muted-foreground">{t('newProject.thumbnailNote')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
