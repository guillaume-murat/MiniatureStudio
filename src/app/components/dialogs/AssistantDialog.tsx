import { useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Field } from '../Section';
import { PromptCode } from '../brief/PromptCode';
import { ConceptPreviews } from './ConceptPreviews';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { conceptsPrompt, suggestConcepts, type Concept, type ConceptsInput } from '../../lib/ai';
import { conceptStyles, findStyle } from '../../lib/styles';
import { explainError } from '../../lib/errors';
import { useT } from '../../i18n';

export function AssistantDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'assistant');
  const close = useUI((s) => s.close);
  const { brief, setBrief, customStyles } = useWorkspace();
  const lang = useSettings((s) => s.lang);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [busy, setBusy] = useState(false);
  const input: ConceptsInput = {
    videoTitle: brief.videoTitle,
    idea: brief.brief,
    lang,
    styles: conceptStyles(customStyles),
  };

  async function run() {
    if (!brief.videoTitle.trim() && !brief.brief.trim()) return void toast.error(t('assistant.needTitle'));
    const settings = useSettings.getState();
    const apiKey = settings.apiKey();
    if (!apiKey) return void toast.error(t('brief.needKey'));
    setBusy(true);
    try {
      setConcepts(await suggestConcepts({ provider: settings.provider, apiKey }, input));
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
          <Field label={t('brief.videoTitle')} htmlFor="aTitle">
            <Input id="aTitle" value={brief.videoTitle} onChange={(e) => setBrief({ videoTitle: e.target.value })} placeholder={t('brief.videoTitlePlaceholder')} />
          </Field>
          <Field label={t('brief.brief')} htmlFor="aIdea">
            <Textarea id="aIdea" value={brief.brief} onChange={(e) => setBrief({ brief: e.target.value })} placeholder={t('brief.briefPlaceholder')} className="min-h-20 resize-y" />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
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
                  <p className="font-medium">{c.name}</p>
                  {style && <Badge variant="secondary" className="w-fit">{style.name[lang]}</Badge>}
                  <p className="text-sm text-muted-foreground">{c.brief}</p>
                  <p className="text-xs text-muted-foreground italic">{c.why}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-auto"
                    onClick={() => {
                      setBrief({ brief: c.brief, styleId: style?.id ?? brief.styleId });
                      close();
                    }}
                  >
                    {t('assistant.use')} <ArrowRight />
                  </Button>
                  <ConceptPreviews key={c.brief} concept={c} />
                </div>
              );
            })}
          </div>
        )}

        <PromptCode text={conceptsPrompt(input)} full heading={t('assistant.promptSent')} />
      </DialogContent>
    </Dialog>
  );
}
