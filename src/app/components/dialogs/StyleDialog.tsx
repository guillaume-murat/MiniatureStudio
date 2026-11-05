import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Pencil, Plus, RemoveFormatting, Trash2, Type } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Field } from '../Section';
import { PromptCode } from '../brief/PromptCode';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { deleteStyle, putStyle, uid } from '../../lib/db';
import { NO_STYLE_EMOJI, STYLES, STYLE_EMOJIS, allStyles, lastGrapheme } from '../../lib/styles';
import { styleLine } from '../../lib/prompt';
import { useT } from '../../i18n';
import type { CustomStyle } from '../../lib/types';
import { cn } from '../../lib/utils';

function Editor({ initial, onDone }: { initial?: CustomStyle; onDone: () => void }) {
  const t = useT();
  const { reloadStyles, setBrief } = useWorkspace();
  const [emoji, setEmoji] = useState(initial?.emoji ?? STYLE_EMOJIS[0]);
  const [name, setName] = useState(initial?.name ?? '');
  const [hint, setHint] = useState(initial?.hint ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [addsText, setAddsText] = useState(initial?.addsText ?? false);

  async function save() {
    if (!name.trim()) return void toast.error(t('styles.needName'));
    if (!prompt.trim()) return void toast.error(t('styles.needPrompt'));
    const id = initial?.id ?? uid('st_');
    await putStyle({
      id,
      name: name.trim(),
      hint: hint.trim() || undefined,
      emoji: emoji || STYLE_EMOJIS[0],
      prompt: prompt.trim(),
      addsText,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    await reloadStyles();
    // A style just written is the one the user wants here.
    if (!initial) setBrief({ styleId: id });
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Field label={t('styles.emoji')} htmlFor="styleEmoji" className="w-16 shrink-0">
          <Input id="styleEmoji" value={emoji} onChange={(e) => setEmoji(lastGrapheme(e.target.value))} className="text-center" />
        </Field>
        <Field label={t('styles.name')} htmlFor="styleName" className="min-w-0 flex-1">
          <Input id="styleName" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('styles.namePlaceholder')} autoFocus />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1">
        {STYLE_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            aria-pressed={e === emoji}
            className={cn('flex size-8 items-center justify-center rounded-md hover:bg-accent', e === emoji && 'bg-accent ring-1 ring-primary/40')}
          >
            {e}
          </button>
        ))}
      </div>
      <Field label={<>{t('styles.hint')} <span className="font-normal text-muted-foreground">({t('common.optional')})</span></>} htmlFor="styleHint">
        <Input id="styleHint" value={hint} onChange={(e) => setHint(e.target.value)} placeholder={t('styles.hintPlaceholder')} />
      </Field>
      <Field label={t('styles.prompt')} htmlFor="stylePrompt" hint={t('styles.promptHint')}>
        <Textarea id="stylePrompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('styles.promptPlaceholder')} className="min-h-32 resize-y" />
      </Field>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor="styleAddsText" className="text-sm font-medium">
          {t('styles.addsText')}
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t('styles.addsTextHint')}</span>
        </label>
        <Switch id="styleAddsText" checked={addsText} onCheckedChange={setAddsText} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button onClick={save}>{t('common.save')}</Button>
      </DialogFooter>
    </div>
  );
}

/** Whether the style itself puts text in the image. */
function TextBadge({ addsText }: { addsText: boolean }) {
  const t = useT();
  const Icon = addsText ? Type : RemoveFormatting;
  return (
    <span className={cn('flex w-fit items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none', addsText ? 'border-primary/40 bg-primary/10 text-foreground' : 'text-muted-foreground')}>
      <Icon className="size-3 shrink-0" />
      {addsText ? t('styles.withText') : t('styles.withoutText')}
    </span>
  );
}

function StyleOption({
  active,
  emoji,
  title,
  hint,
  addsText = false,
  prompt = '',
  actions,
  onClick,
}: {
  active: boolean;
  emoji: string;
  title: string;
  hint: string;
  addsText?: boolean;
  prompt?: string;
  actions?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={cn('group relative rounded-lg border transition-colors hover:bg-accent', active && 'border-primary bg-accent')}>
      <button type="button" onClick={onClick} className="flex size-full flex-col gap-1.5 rounded-lg p-2.5 text-left">
        <span className="flex w-full items-start gap-2">
          <span className="text-lg leading-tight" aria-hidden>
            {emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
          {active && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
        </span>
        <TextBadge addsText={addsText} />
        <PromptCode text={prompt} />
      </button>
      {actions && <div className="absolute top-1.5 right-7 flex gap-0.5 rounded-md bg-card opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">{actions}</div>}
    </div>
  );
}

function CustomStyleOption({ style, active, onChoose, onEdit }: { style: CustomStyle; active: boolean; onChoose: () => void; onEdit: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const reloadStyles = useWorkspace((s) => s.reloadStyles);
  const [confirming, setConfirming] = useState(false);
  return (
    <StyleOption
      active={active}
      emoji={style.emoji}
      title={style.name}
      hint={style.hint ?? ''}
      addsText={style.addsText}
      prompt={styleLine(lang, style.prompt)}
      onClick={onChoose}
      actions={
        confirming ? (
          <>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={async () => {
                await deleteStyle(style.id);
                await reloadStyles();
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        ) : (
          <>
            <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={t('styles.edit')}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={t('common.delete')}>
              <Trash2 />
            </Button>
          </>
        )
      }
    />
  );
}

/** The style library: the user's own styles, shared by every project, and the presets. */
export function StyleDialog() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const dialog = useUI((s) => s.dialog);
  const close = useUI((s) => s.close);
  const styleId = useWorkspace((s) => s.brief.styleId);
  const customStyles = useWorkspace((s) => s.customStyles);
  const setBrief = useWorkspace((s) => s.setBrief);
  const [editing, setEditing] = useState<CustomStyle | 'new' | null>(null);
  const hasStyle = allStyles(customStyles).some((s) => s.id === styleId);

  const choose = (id: string) => {
    setBrief({ styleId: id });
    close();
  };

  return (
    <Dialog
      open={dialog === 'styles'}
      onOpenChange={(o) => {
        if (!o) {
          close();
          setEditing(null);
        }
      }}
    >
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto', editing ? 'max-w-xl' : 'max-w-4xl')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing && (
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(null)} aria-label={t('common.back')}>
                <ArrowLeft />
              </Button>
            )}
            {editing === 'new' ? t('styles.new') : editing ? editing.name : t('styles.title')}
          </DialogTitle>
          {!editing && <DialogDescription>{t('styles.description')}</DialogDescription>}
        </DialogHeader>

        {editing ? (
          <Editor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t('styles.mine')}</h3>
                <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
                  <Plus /> {t('styles.new')}
                </Button>
              </div>
              {customStyles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('styles.empty')}</p>
              ) : (
                <div className="grid gap-2 grid-cols-2">
                  {customStyles.map((s) => (
                    <CustomStyleOption key={s.id} style={s} active={s.id === styleId} onChoose={() => choose(s.id)} onEdit={() => setEditing(s)} />
                  ))}
                </div>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('styles.presets')}</h3>
              <div className="grid gap-2 grid-cols-2">
                <StyleOption active={!hasStyle} emoji={NO_STYLE_EMOJI} title={t('brief.styleNone')} hint="—" prompt={styleLine(lang)} onClick={() => choose('')} />
                {STYLES.map((s) => (
                  <StyleOption key={s.id} active={s.id === styleId} emoji={s.emoji} title={s.name[lang]} hint={s.hint[lang]} addsText={s.preset?.text === 'style'} prompt={styleLine(lang, s.prompt[lang])} onClick={() => choose(s.id)} />
                ))}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
