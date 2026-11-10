import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bandage,
  ScanFace,
  Blend,
  ChevronRight,
  Copy,
  Crop,
  History,
  ImageUp,
  Maximize2,
  Sparkles,
  Undo2,
  SquareDashedMousePointer,
  Type,
  Wand2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Section } from '../Section';
import { DuplicateDialog, RevertDialog } from './VersionDialogs';
import { runningJobs } from '../canvas/BlockingJob';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { historyOf, historyRows, versionStep, type HistoryRow, type VersionStep } from '../../lib/versions';
import { useT } from '../../i18n';
import type { Generation } from '../../lib/types';
import { cn } from '../../lib/utils';

const STEP_ICONS = {
  generate: Sparkles,
  import: ImageUp,
  edit: Wand2,
  region: SquareDashedMousePointer,
  text: Type,
  upscale: Maximize2,
  reframe: Crop,
  smooth: Blend,
  heal: Bandage,
  face: ScanFace,
  arrow: ArrowUpRight,
} as const;

/** A version's picture, for the lists of the history. */
function VersionImage({ gen }: { gen: Generation }) {
  const url = useBlobUrl(gen.blob);
  return <img src={url} alt="" className="aspect-video w-16 shrink-0 rounded object-cover ring-1 ring-border" />;
}

/** Over the line's text when it is hovered or reached by keyboard, always there on a touch screen. */
function RowActions({ gen, canRevert, className }: { gen: Generation; canRevert: boolean; className?: string }) {
  const t = useT();
  const [reverting, setReverting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  // The overlay only stops the pointer: Tab still reaches these during a call.
  const running = useWorkspace((s) => runningJobs(s.jobs).length > 0);
  return (
    <>
      <div className={cn('absolute inset-y-0 right-2 flex items-center gap-2 bg-gradient-to-l from-accent from-75% to-transparent pl-5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-events-none [&_button]:pointer-events-auto [@media(pointer:coarse)]:opacity-100', className)}>
        {canRevert && (
          <Button variant="ghost" size="icon-xs" disabled={running} aria-label={t('versions.revert')} title={t('versions.revert')} onClick={() => setReverting(true)}>
            <Undo2 />
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" disabled={running} aria-label={t('versions.duplicate')} title={t('versions.duplicate')} onClick={() => setDuplicating(true)}>
          <Copy />
        </Button>
      </div>
      <RevertDialog gen={gen} open={reverting} onOpenChange={setReverting} />
      <DuplicateDialog gen={gen} open={duplicating} onOpenChange={setDuplicating} />
    </>
  );
}

/** Brings the line of the version shown into view when it becomes the one shown. */
function useScrollIntoViewWhen(active: boolean) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) row.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return row;
}

const ROW = 'group relative rounded-md transition-colors hover:bg-accent';
const ROW_BUTTON = 'flex w-full min-w-0 items-center gap-3 rounded-md p-1.5 text-left';

/** One step of the history: choosing it shows that version, without changing anything. */
function VersionRow({ gen, original, latest, active, onSelect }: { gen: Generation; original: boolean; latest: boolean; active: boolean; onSelect: (id: string) => void }) {
  const t = useT();
  const row = useScrollIntoViewWhen(active);
  const step = versionStep(gen);
  const Icon = STEP_ICONS[step];
  const label = original ? t('iterate.original') : t(`versions.steps.${step}`);
  // Tools name their versions after themselves: only an instruction or a brief adds something.
  const detail = gen.prompt && gen.prompt !== t(`versions.steps.${step}`) && !gen.action ? gen.prompt : '';

  return (
    <div ref={row} className={cn(ROW, active && 'bg-accent')}>
      <button type="button" onClick={() => onSelect(gen.id)} aria-current={active || undefined} className={ROW_BUTTON}>
        <VersionImage gen={gen} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-medium">
            <Icon className="size-3 shrink-0 text-muted-foreground" /> {label}
          </span>
          {detail && <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>}
        </span>
      </button>
      <RowActions gen={gen} canRevert={!latest} />
    </div>
  );
}

/** Consecutive steps of one tool: its last step, then all of them once unfolded (always when the one shown is in the middle). */
function GroupRow({ step, row, selectedId, latestId, onSelect }: { step: VersionStep; row: HistoryRow<Generation>; selectedId: string; latestId: string; onSelect: (id: string) => void }) {
  const t = useT();
  const [unfolded, setUnfolded] = useState(false);
  const open = unfolded || row.holdsSelection;
  const last = row.versions[row.versions.length - 1];
  const active = !open && last.id === selectedId;
  const line = useScrollIntoViewWhen(active);
  const Icon = STEP_ICONS[step];
  const name = t(`versions.steps.${step}`);
  return (
    <div>
      <div ref={line} className={cn(ROW, active && 'bg-accent')}>
        <button type="button" onClick={() => onSelect(last.id)} aria-current={active || undefined} className={ROW_BUTTON}>
          <VersionImage gen={last} />
          <span className="flex min-w-0 flex-1 items-center gap-1 pr-7 text-xs font-medium">
            <Icon className="size-3 shrink-0 text-muted-foreground" /> {t('versions.groupName', { step: name, n: row.versions.length })}
          </span>
        </button>
        {!open && <RowActions gen={last} canRevert={last.id !== latestId} className="right-8" />}
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          disabled={row.holdsSelection}
          aria-expanded={open}
          aria-label={t(open ? 'versions.fold' : 'versions.unfold', { step: name })}
          title={t(open ? 'versions.fold' : 'versions.unfold', { step: name })}
          onClick={() => setUnfolded(!unfolded)}
        >
          <ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
        </Button>
      </div>
      {open && (
        <div className="mt-0.5 ml-3 space-y-0.5 border-l pl-1.5">
          {row.versions.map((item) => (
            <VersionRow key={item.id} gen={item} original={false} latest={item.id === latestId} active={item.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ gen }: { gen: Generation }) {
  const t = useT();
  const { generations, select } = useWorkspace();
  const history = historyOf(generations, gen.id);
  const latestId = history[history.length - 1].id;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Always shown: with no edit yet, it holds the original. */}
        <Section
          title={
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" /> {t('iterate.versions')} <span className="tabular font-normal">· {history.length}</span>
            </span>
          }
        >
          <p className="-mt-1 text-xs text-muted-foreground">{history.length > 1 ? t('versions.hint') : t('versions.first')}</p>
          <div className="space-y-0.5">
            {historyRows(history, gen.id).map((row) =>
              row.group ? (
                <GroupRow key={row.versions[0].id} step={row.group} row={row} selectedId={gen.id} latestId={latestId} onSelect={select} />
              ) : (
                <VersionRow key={row.versions[0].id} gen={row.versions[0]} original={row.versions[0] === history[0]} latest={row.versions[0].id === latestId} active={row.versions[0].id === gen.id} onSelect={select} />
              ),
            )}
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

export function IteratePanel() {
  const t = useT();
  const gen = useWorkspace(selectedGeneration);

  if (!gen) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">{t('iterate.noImage')}</div>;
  }

  return <HistoryTab gen={gen} />;
}
