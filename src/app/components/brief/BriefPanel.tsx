import { Loader2, Plus, Sparkles, Square, Users, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Kbd } from '../ui/kbd';
import { ScrollArea } from '../ui/scroll-area';
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
import { PromptEye } from './PromptEye';
import { MOD } from '../TopBar';
import { MAX_PERSONAS, useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { useUI } from '../../stores/ui';
import { sceneLine, styleLine, titlePreviewLine } from '../../lib/prompt';
import { findStyle } from '../../lib/styles';
import { useT } from '../../i18n';

/** The prompt the next generation would send, on hover of an eye beside Generate (same code path as `generate`). */
function NextPromptEye() {
  const t = useT();
  const previewPrompt = useWorkspace((s) => s.previewPrompt);
  const scene = useWorkspace((s) => s.brief.brief);
  // Read on each render: the store changes as the brief does.
  useWorkspace();
  return (
    <PromptEye title={t('prompt.next')} side="top" large>
      {!scene.trim() && <p className="mb-1 font-sans not-italic">{t('prompt.emptyBrief')}</p>}
      <p className="whitespace-pre-wrap italic">{previewPrompt()}</p>
    </PromptEye>
  );
}

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
          <Button variant="outline" className="w-full" onClick={() => open('newPersona')}>
            <Plus /> {t('persona.new')}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {personas.map((p) => (
              <PersonaChip key={p.id} persona={p} active={personaIds.includes(p.id)} onToggle={() => togglePersona(p.id)} />
            ))}
          </div>
        )}
      </Field>
    </Section>
  );
}

export function BriefPanel() {
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

      <div className="flex items-center gap-2 border-t bg-sidebar p-3">
        <NextPromptEye />
        <Button
          size="lg"
          className="flex-1 gap-2"
          disabled={!brief.brief.trim()}
          onClick={() => {
            generate();
          }}
        >
          {running ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {running ? t('brief.generating') : t('brief.generate')}
          <Kbd className="ml-1 bg-on-brand/15 text-on-brand">{MOD} ↵</Kbd>
        </Button>
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
