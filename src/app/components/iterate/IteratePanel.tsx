import {
  ArrowUpRight,
  Bandage,
  Blend,
  Crop,
  GitBranch,
  ImageUp,
  Maximize2,
  Sparkles,
  SquareDashedMousePointer,
  Type,
  Wand2,
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Section } from '../Section';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { rootOf, treeLines, versionTree } from '../../lib/versions';
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

/** Indent per tree level, and where a level's line runs: under the left part of its thumbnail. */
const TREE_INDENT = 20;
const TREE_PAD = 6;
const lineX = (depth: number) => TREE_PAD + depth * TREE_INDENT + 10;
const LINE = 'pointer-events-none absolute border-dashed border-muted-foreground/60';

/** One step of the thumbnail's history, under the version it was made from, linked to it by a dashed line. */
function VersionRow({
  gen,
  depth,
  lines,
  active,
  onClick,
}: {
  gen: Generation;
  depth: number;
  lines: ReturnType<typeof treeLines>[number];
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const url = useBlobUrl(gen.blob);
  const step = gen.action ?? gen.kind;
  const Icon = STEP_ICONS[step];
  const label = gen.parentId ? t(`versions.steps.${step}`) : t('iterate.original');
  // Tools name their versions after themselves: only an instruction or a brief adds something.
  const detail = gen.prompt && gen.prompt !== t(`versions.steps.${step}`) && !gen.action ? gen.prompt : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('relative flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-accent', active && 'bg-accent')}
      style={{ paddingLeft: TREE_PAD + depth * TREE_INDENT }}
    >
      {lines.through.map((on, k) =>
        k === depth - 1 ? (
          <span key={k}>
            {/* The elbow into this version's thumbnail, then on to its next sibling. */}
            <span className={cn(LINE, 'top-0 h-1/2 rounded-bl-md border-b border-l')} style={{ left: lineX(k), width: TREE_INDENT - 12 }} />
            {on && <span className={cn(LINE, 'top-1/2 bottom-0 border-l')} style={{ left: lineX(k) }} />}
          </span>
        ) : (
          on && <span key={k} className={cn(LINE, 'top-0 bottom-0 border-l')} style={{ left: lineX(k) }} />
        ),
      )}
      {/* Down from under the thumbnail (36 px high) to the first version made from it. */}
      {lines.hasChildren && <span className={cn(LINE, 'top-[calc(50%+18px)] bottom-0 border-l')} style={{ left: lineX(depth) }} />}
      <img src={url} alt="" className="aspect-video w-16 shrink-0 rounded object-cover ring-1 ring-border" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-medium">
          <Icon className="size-3 shrink-0 text-muted-foreground" /> {label}
        </span>
        {detail && <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>}
      </span>
    </button>
  );
}

function HistoryTab({ gen }: { gen: Generation }) {
  const t = useT();
  const { generations, select } = useWorkspace();
  const root = rootOf(generations, gen.id) ?? gen;
  const versions = versionTree(generations, root.id);
  const lines = treeLines(versions);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Always shown: with no edit yet, it holds the original, selected. */}
        <Section
          title={
            <span className="flex items-center gap-1.5">
              <GitBranch className="size-3.5" /> {t('iterate.versions')} <span className="tabular font-normal">· {versions.length}</span>
            </span>
          }
        >
          <p className="-mt-1 text-xs text-muted-foreground">{versions.length > 1 ? t('versions.hint') : t('versions.first')}</p>
          <div>
            {versions.map(({ item, depth }, i) => (
              <VersionRow key={item.id} gen={item} depth={depth} lines={lines[i]} active={item.id === gen.id} onClick={() => select(item.id)} />
            ))}
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
