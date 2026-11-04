import { useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ChevronUp, Eye, Lightbulb, Loader2, SquareDashedMousePointer } from 'lucide-react';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { Textarea } from '../ui/textarea';
import { Toggle } from '../ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { EditPromptDialog } from '../dialogs/EditPromptDialog';
import { runningJobs } from './BlockingJob';
import { COMMANDS, isAvailable } from '../../commands';
import { useWorkspace } from '../../stores/workspace';
import { useT, type TKey } from '../../i18n';
import type { Generation } from '../../lib/types';

const SUGGESTIONS = ['emotion', 'contrast', 'background', 'zoom', 'text', 'noText'] as const;

const TOOLS = COMMANDS.filter((c) => c.group === 'tool');

/** Floating below the image on desktop, with room kept for it by the canvas; under it on mobile. */
export function EditBarShell({ children }: { children: ReactNode }) {
  return (
    <div className="@container shrink-0 border-t bg-background p-2 lg:absolute lg:bottom-2 lg:left-1/2 lg:z-10 lg:w-[min(42rem,calc(100%-1.5rem))] lg:-translate-x-1/2 lg:rounded-xl lg:border lg:shadow-lg">
      {children}
    </div>
  );
}

/** The image tools, with their names as long as the bar has room for them. */
function ToolButtons({ locked }: { locked: boolean }) {
  const t = useT();
  const ws = useWorkspace();
  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map((c) => (
        <Tooltip key={c.id}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={c.active?.(ws) ?? false}
              disabled={locked || !isAvailable(c, ws)}
              onPressedChange={() => c.run(useWorkspace.getState())}
              aria-label={t(c.label(ws))}
              // Not data-state: the tooltip's trigger replaces the toggle's.
              className="gap-1.5 px-2 text-xs aria-pressed:bg-primary/15 aria-pressed:text-primary"
            >
              <c.icon /> <span className="hidden @min-[34rem]:inline">{t(c.shortLabel!)}</span>
            </Toggle>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            {t(c.label(ws))} <Kbd className="[@media(pointer:coarse)]:hidden">{c.key.toUpperCase()}</Kbd>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * The edit bar under the image: the instruction, its suggestions, the tools, the prompt it would send.
 * The instruction is held by the canvas: the bar goes away with other views and tools.
 */
export function EditBar({
  gen,
  instruction,
  onInstruction,
  maskControls,
}: {
  gen: Generation;
  instruction: string;
  onInstruction: (text: string) => void;
  /** The area tool's controls, in place of the tools while it is on. */
  maskControls?: ReactNode;
}) {
  const t = useT();
  const { edit, tool, setTool, hasMask, jobs } = useWorkspace();
  const [showPrompt, setShowPrompt] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const refocusField = useRef(false);
  const editing = jobs.some((j) => j.status === 'running' && j.parentId === gen.id);
  const region = tool === 'mask' && hasMask;
  // The overlay only stops the pointer: Enter and Tab would still reach the bar during a call.
  const locked = runningJobs(jobs).length > 0;

  const submit = () => {
    if (locked || !instruction.trim()) return;
    edit(instruction);
    onInstruction('');
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={field}
        rows={1}
        readOnly={locked}
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        onKeyDown={(e) => {
          // The global Esc ignores a field being typed in, where the area tool is mostly used.
          if (e.key === 'Escape') setTool(null);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }
        }}
        placeholder={region ? t('iterate.regionPlaceholder') : t('iterate.editPlaceholder')}
        aria-label={t('iterate.instruction')}
        className="max-h-32 min-h-9 resize-none"
      />
      {maskControls}
      <div className="flex items-center gap-1">
        {!maskControls && <ToolButtons locked={locked} />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={locked} aria-label={t('iterate.suggestions')}>
              <Lightbulb /> <span className="hidden @md:inline">{t('iterate.suggestions')}</span> <ChevronUp />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            onCloseAutoFocus={(e) => {
              if (!refocusField.current) return;
              // Back in the field rather than on the menu's button, to complete or send.
              refocusField.current = false;
              e.preventDefault();
              field.current?.focus();
            }}
          >
            {SUGGESTIONS.map((key) => {
              const text = t(`iterate.quickEdits.${key}` as TKey);
              return (
                <DropdownMenuItem
                  key={key}
                  className="italic"
                  onSelect={() => {
                    refocusField.current = true;
                    onInstruction(text);
                  }}
                >
                  {text}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* In the row, so painting doesn't change the bar's height. */}
        {region && (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-primary" title={t('iterate.regionActive')}>
            <SquareDashedMousePointer className="size-3.5 shrink-0" /> <span className="truncate">{t('iterate.regionActive')}</span>
          </p>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-lg"
              variant="ghost"
              className="ml-auto border border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/15 dark:hover:bg-yellow-500/15"
              disabled={locked}
              onClick={() => setShowPrompt(true)}
              aria-label={t('editPrompt.open')}
            >
              <Eye />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('editPrompt.open')}</TooltipContent>
        </Tooltip>
        <Button size="icon-lg" onClick={submit} disabled={locked || !instruction.trim()} aria-label={t('iterate.send')}>
          {editing ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </div>
      <EditPromptDialog open={showPrompt} onOpenChange={setShowPrompt} instruction={instruction} />
    </div>
  );
}
