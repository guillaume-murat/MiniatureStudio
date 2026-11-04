import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Bandage,
  Blend,
  Check,
  ChevronRight,
  Crop,
  GitBranch,
  GitFork,
  ImageUp,
  Maximize2,
  Sparkles,
  Trash2,
  SquareDashedMousePointer,
  Type,
  Wand2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { Section } from '../Section';
import { RemoveVersionDialog } from './RemoveVersionDialog';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { displayedBranch, forkBranches, historyRows, versionCount, versionStep, type Branch, type HistoryRow, type VersionStep } from '../../lib/versions';
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
  arrow: ArrowUpRight,
} as const;

/** A version's picture, for the lists of the history. */
function VersionImage({ gen, className }: { gen: Generation; className?: string }) {
  const url = useBlobUrl(gen.blob);
  return <img src={url} alt="" className={cn('aspect-video shrink-0 rounded object-cover ring-1 ring-border', className)} />;
}

/** The mark of a fork: how many branches leave this version, and a menu to go to one of them. */
function ForkMenu({ branches, shown, onChoose }: { branches: Array<Branch<Generation>>; shown: Generation[]; onChoose: (id: string) => void }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="shrink-0 text-muted-foreground" aria-label={t('versions.branchesOpen', { n: branches.length })}>
          <GitFork /> {t('versions.branches', { n: branches.length })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {branches.map(({ first, last, count }) => {
          const step = versionStep(first);
          const current = shown.includes(first);
          return (
            <DropdownMenuItem key={first.id} onSelect={() => onChoose(last.id)}>
              <VersionImage gen={last} className="w-12" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t(`versions.steps.${step}`)}</span>
                <span className="block text-xs text-muted-foreground">{t('versions.branchCount', { n: count })}</span>
              </span>
              {current && <Check aria-label={t('versions.branchShown')} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Brings the row of the selected version into view when it becomes selected. */
function useScrollIntoViewWhen(active: boolean) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) row.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return row;
}

const ROW = 'flex items-center gap-1 rounded-md pr-1.5 transition-colors hover:bg-accent';
const ROW_BUTTON = 'flex min-w-0 flex-1 items-center gap-3 rounded-md p-1.5 text-left';

/** One step of the branch shown: choosing it makes it the version the next edit starts from. */
function VersionRow({ gen, original, active, fork, onSelect }: { gen: Generation; original: boolean; active: boolean; fork?: ReactNode; onSelect: (id: string) => void }) {
  const t = useT();
  const row = useScrollIntoViewWhen(active);
  const [removing, setRemoving] = useState(false);
  const step = versionStep(gen);
  const Icon = STEP_ICONS[step];
  const label = original ? t('iterate.original') : t(`versions.steps.${step}`);
  // Tools name their versions after themselves: only an instruction or a brief adds something.
  const detail = gen.prompt && gen.prompt !== t(`versions.steps.${step}`) && !gen.action ? gen.prompt : '';

  return (
    <div ref={row} className={cn(ROW, active && 'bg-accent')}>
      <button type="button" onClick={() => onSelect(gen.id)} aria-current={active || undefined} className={ROW_BUTTON}>
        <VersionImage gen={gen} className="w-16" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-medium">
            <Icon className="size-3 shrink-0 text-muted-foreground" /> {label}
          </span>
          {detail && <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>}
        </span>
      </button>
      {fork}
      <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground" aria-label={t('versions.remove')} title={t('versions.remove')} onClick={() => setRemoving(true)}>
        <Trash2 />
      </Button>
      <RemoveVersionDialog gen={gen} open={removing} onOpenChange={setRemoving} />
    </div>
  );
}

/** Consecutive steps of one tool: its last step, then all of them once unfolded (always when the selected one is in the middle). */
function GroupRow({ step, row, selectedId, onSelect }: { step: VersionStep; row: HistoryRow<Generation>; selectedId: string; onSelect: (id: string) => void }) {
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
          <VersionImage gen={last} className="w-16" />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-xs font-medium">
            <Icon className="size-3 shrink-0 text-muted-foreground" /> {t('versions.groupName', { step: name, n: row.versions.length })}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
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
            <VersionRow key={item.id} gen={item} original={false} active={item.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ gen }: { gen: Generation }) {
  const t = useT();
  const { generations, select } = useWorkspace();
  // The branch shown so far: it stays shown as long as the selected version belongs to it.
  const kept = useRef<string[]>([]);
  const branch = displayedBranch(generations, gen.id, kept.current);
  kept.current = branch.map((g) => g.id);
  const total = versionCount(generations, gen.id);

  const forkOf = (id: string) => {
    const branches = forkBranches(generations, id);
    return branches.length > 0 ? <ForkMenu branches={branches} shown={branch} onChoose={select} /> : undefined;
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Always shown: with no edit yet, it holds the original, selected. */}
        <Section
          title={
            <span className="flex items-center gap-1.5">
              <GitBranch className="size-3.5" /> {t('iterate.versions')} <span className="tabular font-normal">· {total}</span>
            </span>
          }
        >
          <p className="-mt-1 text-xs text-muted-foreground">{total > 1 ? t('versions.hint') : t('versions.first')}</p>
          <div className="space-y-0.5">
            {historyRows(generations, branch, gen.id).map((row) =>
              row.group ? (
                <GroupRow key={row.versions[0].id} step={row.group} row={row} selectedId={gen.id} onSelect={select} />
              ) : (
                <VersionRow key={row.versions[0].id} gen={row.versions[0]} original={row.versions[0] === branch[0]} active={row.versions[0].id === gen.id} fork={forkOf(row.versions[0].id)} onSelect={select} />
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
