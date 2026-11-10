import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Field } from '../Section';
import { useSettings, type KeyPersistence } from '../../stores/settings';
import { useT } from '../../i18n';
import type { Provider } from '../../lib/types';

const KEY_LINKS: Record<Provider, string> = {
  replicate: 'https://replicate.com/account/api-tokens',
  gemini: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/settings/keys',
  mammouth: 'https://mammouth.ai/app/account/settings/api',
  vertex: 'https://console.cloud.google.com/vertex-ai',
  openai: 'https://platform.openai.com/api-keys',
};

const KEY_PLACEHOLDERS: Record<Provider, string> = {
  replicate: 'r8_…',
  gemini: 'AIza…',
  openrouter: 'sk-or-…',
  mammouth: 'sk-…',
  vertex: '',
  openai: 'sk-…',
};

type VertexStatus = { ok: true; project: string; location: string } | { ok: false; error?: string } | null;

/** Asks the local helper (local/vertex.ts) whether gcloud is ready. */
function useVertexStatus(enabled: boolean): VertexStatus {
  const [status, setStatus] = useState<VertexStatus>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setStatus(null);
    fetch('/vertex/status', { signal: controller.signal, cache: 'no-store' })
      .then((res) => (res.headers.get('content-type')?.includes('json') ? res.json() : { ok: false }))
      .then(setStatus, () => !controller.signal.aborted && setStatus({ ok: false }));
    return () => controller.abort();
  }, [enabled]);
  return status;
}

/**
 * The provider, its key and where the key is kept: at the top of the advanced options,
 * above the model (whose list depends on the provider).
 */
export function ProviderFields() {
  const t = useT();
  const s = useSettings();
  const [reveal, setReveal] = useState(false);
  const vertex = useVertexStatus(s.provider === 'vertex');
  return (
    <>
      <Field label={t('settings.provider')}>
        <ToggleGroup type="single" variant="outline" spacing={1.5} className="w-full flex-wrap" value={s.provider} onValueChange={(v) => v && s.set({ provider: v as Provider })}>
          <ToggleGroupItem value="replicate" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.replicate')}
          </ToggleGroupItem>
          <ToggleGroupItem value="gemini" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.gemini')}
          </ToggleGroupItem>
          <ToggleGroupItem value="openrouter" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.openrouter')}
          </ToggleGroupItem>
          <ToggleGroupItem value="mammouth" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.mammouth')}
          </ToggleGroupItem>
          <ToggleGroupItem value="vertex" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.vertex')}
          </ToggleGroupItem>
          <ToggleGroupItem value="openai" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.openai')}
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{t(`settings.${s.provider}Hint`)}</p>
        {s.provider === 'vertex' && (
          <p className="flex items-start gap-1.5 text-xs">
            {!vertex ? (
              <Loader2 className="mt-px size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : vertex.ok ? (
              <>
                <CircleCheck className="mt-px size-3.5 shrink-0 text-success" />
                {t('settings.vertexReady', { project: vertex.project, location: vertex.location })}
              </>
            ) : (
              <>
                <CircleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
                {vertex.error ? t('settings.vertexError', { error: vertex.error }) : t('settings.vertexMissing')}
              </>
            )}
          </p>
        )}
      </Field>

      <Field
        label={
          <span className="flex items-center justify-between">
            {t('settings.apiKey')}
            <a href={KEY_LINKS[s.provider]} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-normal text-primary hover:underline">
              {t('settings.getKey')} <ExternalLink className="size-3" />
            </a>
          </span>
        }
        htmlFor="apiKey"
      >
        <div className="relative">
          <Input
            id="apiKey"
            type={reveal ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={s.keys[s.provider]}
            onChange={(e) => s.setKey(s.provider, e.target.value)}
            placeholder={s.provider === 'vertex' ? t('settings.vertexKeyPlaceholder') : KEY_PLACEHOLDERS[s.provider]}
            className="pr-10 font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setReveal(!reveal)}
            aria-label={reveal ? 'Hide' : 'Show'}
          >
            {reveal ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </Field>

      <Field label={t('settings.keyStorage')} hint={s.keyPersistence === 'session' ? t('settings.keySessionHint') : undefined}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={s.keyPersistence}
          onValueChange={(v) => v && s.set({ keyPersistence: v as KeyPersistence })}
        >
          <ToggleGroupItem value="local" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.keyLocal')}
          </ToggleGroupItem>
          <ToggleGroupItem value="session" className="h-auto min-h-9 min-w-0 flex-1 basis-[30%] leading-tight whitespace-normal">
            {t('settings.keySession')}
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </>
  );
}
