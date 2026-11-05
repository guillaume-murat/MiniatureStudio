import { Eye, Loader2, Plus, Sparkles, Square, Users, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Kbd } from '../ui/kbd';
import { ScrollArea } from '../ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Field, Section } from '../Section';
import { ReferencesSection } from './ReferencesSection';
import { StylePicker } from './StylePicker';
import { GeneratedTextField } from './GeneratedTextField';
import { TitleZonePicker } from './TitleZonePicker';
import { OutputSection } from './OutputSection';
import { ChannelSection } from './ChannelSection';
import { AdvancedOptions } from './AdvancedOptions';
import { BrandColors } from './BrandColors';
import { PersonaChip } from './PersonaChip';
import { MOD } from '../TopBar';
import { MAX_PERSONAS, useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { useUI } from '../../stores/ui';
import { formatLine, OUTPUT_RATIOS, sceneLine, styleLine, titlePreviewLine } from '../../lib/prompt';
import { findStyle } from '../../lib/styles';
import { useT } from '../../i18n';
import type { OutputRatio } from '../../lib/types';

function PeopleSection({ number }: { number: number }) {
  const t = useT();
  const { personas, personaIds, togglePersona, previewImageLines } = useWorkspace();
  const open = useUI((s) => s.open);
  return (
    <Section
      foldable
      title={
        <span className="flex items-center gap-2">
          {number}. {t('brief.personas')}
          {personaIds.length > 0 && <span className="tabular font-normal">{personaIds.length}/{MAX_PERSONAS}</span>}
        </span>
      }
      action={
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => open('personas')}>
          <Users /> {t('brief.managePersonas')}
        </Button>
      }
    >
      <Field label={t('brief.peopleSelect')} prompt={previewImageLines().people}>
        {personas.length === 0 ? (
          <button
            type="button"
            onClick={() => open('newPersona')}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/50"
          >
            <Plus className="size-4" /> {t('persona.new')}
          </button>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {personas.map((p) => (
              <PersonaChip key={p.id} persona={p} active={personaIds.includes(p.id)} onToggle={() => togglePersona(p.id)} />
            ))}
          </div>
        )}
      </Field>
    </Section>
  );
}

function FormatField() {
  const t = useT();
  const aspectRatio = useSettings((s) => s.aspectRatio);
  const lang = useSettings((s) => s.lang);
  const set = useSettings((s) => s.set);
  return (
    <Field label={t('brief.ratio')} prompt={formatLine(lang, aspectRatio)}>
      <ToggleGroup type="single" variant="outline" className="w-full" value={aspectRatio} onValueChange={(v) => v && set({ aspectRatio: v as OutputRatio })}>
        {OUTPUT_RATIOS.map((r) => (
          <ToggleGroupItem key={r} value={r} className="tabular flex-1">
            {r}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

export function BriefPanel({ onGenerated }: { onGenerated?: () => void }) {
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const { brief, setBrief, generate, jobs, cancelAll, customStyles, personaIds } = useWorkspace();
  const open = useUI((s) => s.open);
  const running = jobs.filter((j) => j.status === 'running' && j.kind === 'generate').length;

  return (
    <div className="neutral-panel flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y [&>section]:px-4 [&>section]:py-5">
          <ChannelSection />
          <Section
            foldable
            title={`1. ${t('brief.title')}`}
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="xs" className="text-primary" onClick={() => open('assistant')}>
                    <Sparkles /> {t('brief.assistant')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-60">{t('brief.assistantHint')}</TooltipContent>
              </Tooltip>
            }
          >
            <FormatField />
            <Field label={t('brief.videoTitle')} htmlFor="videoTitle" prompt={titlePreviewLine(lang, brief.videoTitle)}>
              <Input
                id="videoTitle"
                value={brief.videoTitle}
                onChange={(e) => setBrief({ videoTitle: e.target.value })}
                placeholder={t('brief.videoTitlePlaceholder')}
              />
            </Field>
            <Field label={t('brief.brief')} htmlFor="brief" required prompt={sceneLine(lang, brief.brief)}>
              <Textarea
                id="brief"
                required
                value={brief.brief}
                onChange={(e) => setBrief({ brief: e.target.value })}
                placeholder={t('brief.briefPlaceholder')}
                className="min-h-28 resize-y"
              />
            </Field>
            <Field label={t('brief.style')} prompt={styleLine(lang, findStyle(brief.styleId, customStyles)?.prompt[lang], personaIds.length)}>
              <StylePicker />
            </Field>
            <GeneratedTextField />
            <TitleZonePicker />
          </Section>

          <PeopleSection number={2} />
          <ReferencesSection number={3} />
          <BrandColors number={4} />
          <OutputSection number={5} />
          <AdvancedOptions number={6} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 border-t bg-sidebar p-3">
        <Button
          size="lg"
          className="flex-1 gap-2"
          disabled={!brief.brief.trim()}
          onClick={() => {
            generate();
            onGenerated?.();
          }}
        >
          {running ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {running ? t('brief.generating') : t('brief.generate')}
          <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">{MOD} ↵</Kbd>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-lg" variant="ghost" className="border border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/15 dark:hover:bg-yellow-500/15" onClick={() => open('prompt')} aria-label={t('prompt.open')}>
              <Eye />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('prompt.open')}</TooltipContent>
        </Tooltip>
        {running > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-lg" variant="outline" onClick={cancelAll} aria-label={t('brief.stop')}>
                <Square className="fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('brief.stop')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
