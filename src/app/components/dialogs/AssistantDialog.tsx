import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Field } from '../Section';
import { PromptCode } from '../brief/PromptCode';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { conceptIdea, conceptPoints, conceptsPrompt, suggestConcepts, type Concept, type ConceptsInput } from '../../lib/ai';
import { conceptStyles, findStyle } from '../../lib/styles';
import { explainError } from '../../lib/errors';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

/** A concept's preview: `undefined` while it is being generated. */
function ConceptImage({ blob, name, onOpen }: { blob?: Blob; name: string; onOpen: () => void }) {
  const t = useT();
  const url = useBlobUrl(blob);
  const vertical = useSettings((s) => s.aspectRatio === '9:16');
  if (!url) return <div className={cn('w-full animate-pulse rounded-md bg-muted', vertical ? 'aspect-[9/16]' : 'aspect-video')} />;
  return (
    <button type="button" onClick={onOpen} aria-label={`${t('assistant.enlarge')} : ${name}`} className="cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-90">
      <img src={url} alt="" className="w-full" />
    </button>
  );
}

function ViewerThumb({ blob, active, name, onClick }: { blob: Blob; active: boolean; name: string; onClick: () => void }) {
  const url = useBlobUrl(blob);
  return (
    <button type="button" onClick={onClick} aria-label={name} aria-pressed={active} className={cn('overflow-hidden rounded-md border transition-opacity', active ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100')}>
      <img src={url} alt="" className="h-16 w-auto" />
    </button>
  );
}

/** The concepts' images in large, one at a time with all of them in a strip below. */
function ConceptViewer({
  items,
  current,
  onChange,
  onClose,
  action,
}: {
  items: Array<{ index: number; blob: Blob; concept: Concept }>;
  current: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
  action: (index: number) => ReactNode;
}) {
  const t = useT();
  const position = items.findIndex((item) => item.index === current);
  const item = items[position];
  const url = useBlobUrl(item?.blob);
  const move = (by: number) => onChange(items[(position + by + items.length) % items.length].index);
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[95dvh] overflow-y-auto sm:max-w-[90vw]"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') move(-1);
          if (e.key === 'ArrowRight') move(1);
        }}
      >
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.concept.name}</DialogTitle>
              <DialogDescription>{item.concept.why}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label={t('assistant.previous')} disabled={items.length < 2}>
                <ChevronLeft />
              </Button>
              <img src={url} alt={item.concept.name} className="max-h-[65dvh] min-w-0 flex-1 rounded-md object-contain" />
              <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label={t('assistant.next')} disabled={items.length < 2}>
                <ChevronRight />
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {items.map(({ index, blob, concept }) => (
                <ViewerThumb key={index} blob={blob} active={index === current} name={concept.name} onClick={() => onChange(index)} />
              ))}
            </div>
            <div className="flex justify-center">{action(item.index)}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AssistantDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'assistant');
  const close = useUI((s) => s.close);
  const { brief, setBrief, customStyles, previewConcept, addConceptImage } = useWorkspace();
  const lang = useSettings((s) => s.lang);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [busy, setBusy] = useState(false);
  const [withImages, setWithImages] = useState(false);
  /** By concept: a blob, null while it is generated. A concept without an entry has no preview. */
  const [images, setImages] = useState<Record<number, Blob | null>>({});
  // The results of an earlier run must not land on newer concepts.
  const runId = useRef(0);
  /** By concept: how many copies of its image joined the project. */
  const [added, setAdded] = useState<Record<number, number>>({});
  const [viewing, setViewing] = useState<number | null>(null);
  const input: ConceptsInput = {
    videoTitle: brief.videoTitle,
    lang,
    styles: conceptStyles(customStyles),
  };

  async function preview(concept: Concept, index: number, id: number) {
    const done = (update: (all: Record<number, Blob | null>) => Record<number, Blob | null>) => {
      if (id === runId.current) setImages(update);
    };
    try {
      const blob = await previewConcept(concept);
      done((all) => ({ ...all, [index]: blob }));
    } catch (error) {
      done(({ [index]: _, ...others }) => others);
      const info = explainError(error);
      toast.error(t(info.key), { description: info.message });
    }
  }

  /** The brief a concept leaves in the panel: its points and the style its image was made with. */
  const applyConcept = (concept: Concept) =>
    setBrief({ brief: conceptIdea(concept), styleId: findStyle(concept.styleId ?? brief.styleId, customStyles)?.id ?? '' });

  /** The button that puts a concept's image in the project, a new thumbnail per click. */
  const addButton = (i: number, className?: string) => {
    const image = images[i];
    const count = added[i] ?? 0;
    return (
      <Button
        size="sm"
        variant="secondary"
        className={className}
        disabled={!image}
        onClick={async () => {
          if (!image) return;
          try {
            await addConceptImage(concepts[i], image);
            applyConcept(concepts[i]);
            setAdded((all) => ({ ...all, [i]: (all[i] ?? 0) + 1 }));
          } catch (error) {
            const info = explainError(error);
            toast.error(t(info.key), { description: info.message });
          }
        }}
      >
        {!image ? <Loader2 className="animate-spin" /> : count ? <Check /> : <Plus />}
        {t('assistant.add')}
        {count > 0 && <span className="tabular">×{count}</span>}
      </Button>
    );
  };
  const ready = concepts.flatMap((concept, index) => {
    const blob = images[index];
    return blob ? [{ index, blob, concept }] : [];
  });

  async function run() {
    if (!brief.videoTitle.trim()) return void toast.error(t('assistant.needTitle'));
    const settings = useSettings.getState();
    const apiKey = settings.apiKey();
    if (!apiKey) return void toast.error(t('brief.needKey'));
    setBusy(true);
    try {
      const id = ++runId.current;
      setImages({});
      setAdded({});
      setViewing(null);
      const result = await suggestConcepts({ provider: settings.provider, apiKey }, input);
      setConcepts(result);
      if (withImages) {
        setImages(Object.fromEntries(result.map((_, i) => [i, null])));
        result.forEach((concept, i) => void preview(concept, i, id));
      }
    } catch (error) {
      const info = explainError(error);
      toast.error(t(info.key), { description: info.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> {t('assistant.title')}
          </DialogTitle>
          <DialogDescription>{t('assistant.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <Field label={t('brief.videoTitle')} htmlFor="aTitle" required>
            <Input id="aTitle" required value={brief.videoTitle} onChange={(e) => setBrief({ videoTitle: e.target.value })} placeholder={t('brief.videoTitlePlaceholder')} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={withImages} onCheckedChange={(on) => setWithImages(on === true)} className="mt-0.5" />
            <span>
              {t('assistant.withImages')}
              <span className="block text-xs text-muted-foreground">{t('assistant.withImagesHint')}</span>
            </span>
          </label>
          <Button type="submit" disabled={busy || !brief.videoTitle.trim()} className="w-full">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? t('assistant.running') : t('assistant.run')}
          </Button>
        </form>

        {busy && concepts.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {concepts.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {concepts.map((c, i) => {
              const style = findStyle(c.styleId, customStyles);
              return (
                <div key={i} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  {i in images && <ConceptImage blob={images[i] ?? undefined} name={c.name} onOpen={() => setViewing(i)} />}
                  <p className="font-medium">{c.name}</p>
                  {style && <Badge variant="secondary" className="w-fit">{style.name[lang]}</Badge>}
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {conceptPoints(c).map((point, j) => (
                      <li key={j}>{point}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground italic">{c.why}</p>
                  {i in images ? (
                    addButton(i, 'mt-auto')
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-auto"
                      onClick={() => {
                        applyConcept(c);
                        close();
                      }}
                    >
                      {t('assistant.use')} <ArrowRight />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <PromptCode text={conceptsPrompt(input)} heading={t('assistant.promptSent')} />
      </DialogContent>
      <ConceptViewer items={ready} current={viewing} onChange={setViewing} onClose={() => setViewing(null)} action={(i) => addButton(i)} />
    </Dialog>
  );
}
