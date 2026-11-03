import { useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Bandage,
  Blend,
  Crop,
  GitBranch,
  ImageUp,
  Loader2,
  Maximize2,
  Paintbrush,
  Sparkles,
  SquareDashedMousePointer,
  Type,
  Wand2,
  Eye,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Section } from '../Section';
import { Toggle } from '../ui/toggle';
import { Kbd } from '../ui/kbd';
import { COMMANDS, isAvailable } from '../../commands';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { EditPromptDialog } from '../dialogs/EditPromptDialog';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { isLayerTool, selectedGeneration, useWorkspace } from '../../stores/workspace';
import { rootOf, treeLines, versionTree } from '../../lib/versions';
import { useT, type TKey } from '../../i18n';
import type { Generation } from '../../lib/types';
import { cn } from '../../lib/utils';

const QUICK_EDITS = ['emotion', 'contrast', 'background', 'zoom', 'text', 'noText'] as const;

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

/** The image tools (they work on the canvas), first in the edits panel. */
function EditTools({ onUse }: { onUse?: () => void }) {
  const t = useT();
  const ws = useWorkspace();
  const gen = useWorkspace(selectedGeneration);
  // Mobile: the tools work on the canvas, in another tab.
  const use = (action: () => void) => () => {
    action();
    onUse?.();
  };
  const tools = COMMANDS.filter((c) => c.group === 'tool');
  return (
    <>
      <div className="mb-2 grid gap-1.5">
        {tools.map((c) => (
          <Toggle
            key={c.id}
            variant="outline"
            size="sm"
            pressed={c.active?.(ws) ?? false}
            disabled={!isAvailable(c, ws)}
            onPressedChange={use(() => c.run(useWorkspace.getState()))}
            className="justify-start gap-2 px-2.5 text-xs"
          >
            <c.icon /> <span className="truncate">{t(c.label(ws))}</span>
            <Kbd className="ml-auto hidden sm:inline-flex">{c.key.toUpperCase()}</Kbd>
          </Toggle>
        ))}
      </div>
    </>
  );
}

function EditTab({ gen, onEdited }: { gen: Generation; onEdited?: () => void }) {
  const t = useT();
  const { generations, select, edit, tool, hasMask, jobs } = useWorkspace();
  const [instruction, setInstruction] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const root = rootOf(generations, gen.id) ?? gen;
  const versions = versionTree(generations, root.id);
  const lines = treeLines(versions);
  const editing = jobs.some((j) => j.status === 'running' && j.parentId === gen.id);
  const region = tool === 'mask' && hasMask;

  const submit = (text = instruction) => {
    if (!text.trim()) return;
    edit(text);
    setInstruction('');
    onEdited?.();
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
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

          <Section title={t('iterate.quick')}>
            <EditTools onUse={onEdited} />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EDITS.map((key) => {
                const text = t(`iterate.quickEdits.${key}` as TKey);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={editing}
                    onClick={() => submit(text)}
                    className="rounded-full border px-2.5 py-1 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t p-3">
        {region && (
          <p className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary">
            <SquareDashedMousePointer className="size-3.5" /> {t('iterate.regionActive')}
          </p>
        )}
        <div className="relative">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                submit();
              }
            }}
            placeholder={region ? t('iterate.regionPlaceholder') : t('iterate.editPlaceholder')}
            className="min-h-20 resize-none pr-20"
            aria-label={t('iterate.edit')}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="absolute right-11 bottom-2 rounded-full border border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/15 dark:hover:bg-yellow-500/15"
                onClick={() => setShowPrompt(true)}
                aria-label={t('editPrompt.open')}
              >
                <Eye />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('editPrompt.open')}</TooltipContent>
          </Tooltip>
          <Button
            size="icon-sm"
            className="absolute right-2 bottom-2 rounded-full"
            onClick={() => submit()}
            disabled={!instruction.trim()}
            aria-label={t('iterate.send')}
          >
            {editing ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </div>
      <EditPromptDialog open={showPrompt} onOpenChange={setShowPrompt} instruction={instruction} />
    </div>
  );
}

/** `onEdited` fires once an edit is launched (mobile: jump back to the image to follow it). */
export function IteratePanel({ onEdited }: { onEdited?: () => void }) {
  const t = useT();
  const gen = useWorkspace(selectedGeneration);

  if (!gen) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">{t('iterate.noImage')}</div>;
  }

  return <EditTab gen={gen} onEdited={onEdited} />;
}
