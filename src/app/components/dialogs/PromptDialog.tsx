import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';

export function PromptText({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-[55dvh] overflow-y-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
      <Button
        variant="outline"
        size="icon-sm"
        className="absolute top-2 right-2"
        aria-label={t('prompt.copy')}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error(t('prompt.copyFailed'));
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

/** Shows the prompt the next generation will send, and the one behind the selected image. */
export function PromptDialog() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'prompt');
  const close = useUI((s) => s.close);
  const previewPrompt = useWorkspace((s) => s.previewPrompt);
  const hasBrief = useWorkspace((s) => !!s.brief.brief.trim());
  const selected = useWorkspace((s) => s.generations.find((g) => g.id === s.selectedId));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('prompt.title')}</DialogTitle>
          <DialogDescription>{t('prompt.description')}</DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs defaultValue="next">
            <TabsList>
              <TabsTrigger value="next">{t('prompt.next')}</TabsTrigger>
              <TabsTrigger value="selected" disabled={!selected}>
                {t('prompt.selected')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="next" className="space-y-2">
              {!hasBrief && <p className="text-xs text-muted-foreground">{t('prompt.emptyBrief')}</p>}
              <PromptText text={previewPrompt()} />
            </TabsContent>
            {selected && (
              <TabsContent value="selected" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t(`prompt.kind.${selected.kind}`)} · {new Date(selected.createdAt).toLocaleString()}
                </p>
                <PromptText text={selected.fullPrompt || '—'} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
