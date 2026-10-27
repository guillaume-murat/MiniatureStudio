import { useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Bandage,
  Blend,
  CornerDownRight,
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Section } from '../Section';
import { Toggle } from '../ui/toggle';
import { Kbd } from '../ui/kbd';
import { toggleReframe } from '../canvas/ReframeTextDialog';
import { MergeTextButton } from '../canvas/TextLayer';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { selectedGeneration, useWorkspace } from '../../stores/workspace';
import { rootOf, versionTree } from '../../lib/versions';
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
} as const;

/** One step of the thumbnail's history, indented under the version it was made from. */
function VersionRow({ gen, depth, active, onClick }: { gen: Generation; depth: number; active: boolean; onClick: () => void }) {
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
      className={cn('flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-accent', active && 'bg-accent')}
      style={{ paddingLeft: 6 + Math.min(depth, 4) * 14 }}
    >
      {depth > 0 && <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />}
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
  const tools = [
    {
      key: 'text',
      icon: Type,
      label: gen?.textLayer ? t('canvas.textEdit') : t('canvas.textTool'),
      shortcut: 'T',
      pressed: ws.textMode,
      run: () => ws.setTextMode(!ws.textMode),
    },
    {
      key: 'arrow',
      icon: ArrowUpRight,
      label: t('arrow.addTool'),
      shortcut: 'A',
      pressed: false,
      run: ws.addArrow,
    },
    {
      key: 'mask',
      icon: Paintbrush,
      label: t('canvas.maskTool'),
      shortcut: 'M',
      pressed: ws.maskMode,
      run: () => ws.setMaskMode(!ws.maskMode),
    },
    {
      key: 'reframe',
      icon: Crop,
      label: t('canvas.reframeTool'),
      shortcut: 'R',
      pressed: ws.reframeMode,
      run: toggleReframe,
    },
  ];
  return (
    <>
      <div className="mb-2 grid gap-1.5">
        {tools.map(({ key, icon: Icon, label, shortcut, pressed, run }) => (
          <Toggle key={key} variant="outline" size="sm" pressed={pressed} onPressedChange={use(run)} className="justify-start gap-2 px-2.5 text-xs">
            <Icon /> <span className="truncate">{label}</span>
            {shortcut && <Kbd className="ml-auto hidden sm:inline-flex">{shortcut}</Kbd>}
          </Toggle>
        ))}
      </div>
      {gen?.textLayer && !ws.textMode && (
        <div className="mb-2 [&>button]:w-full">
          <MergeTextButton onMerge={() => ws.mergeText(gen.id)} />
        </div>
      )}
    </>
  );
}

function EditTab({ gen, onEdited }: { gen: Generation; onEdited?: () => void }) {
  const t = useT();
  const { generations, select, edit, maskMode, hasMask, jobs } = useWorkspace();
  const [instruction, setInstruction] = useState('');
  const root = rootOf(generations, gen.id) ?? gen;
  const versions = versionTree(generations, root.id);
  const editing = jobs.some((j) => j.status === 'running' && j.parentId === gen.id);
  const region = maskMode && hasMask;

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
          {versions.length > 1 && (
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <GitBranch className="size-3.5" /> {t('iterate.versions')} <span className="tabular font-normal">· {versions.length}</span>
                </span>
              }
            >
              <p className="-mt-1 text-xs text-muted-foreground">{t('versions.hint')}</p>
              <div className="space-y-0.5">
                {versions.map(({ item, depth }) => (
                  <VersionRow key={item.id} gen={item} depth={depth} active={item.id === gen.id} onClick={() => select(item.id)} />
                ))}
              </div>
            </Section>
          )}

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
            className="min-h-20 resize-none pr-11"
            aria-label={t('iterate.edit')}
          />
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
