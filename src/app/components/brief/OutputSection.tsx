import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Field, Section } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { useSettings } from '../../stores/settings';
import { formatLine, OUTPUT_RATIOS } from '../../lib/prompt';
import { useT } from '../../i18n';
import type { OutputFormat, OutputRatio, SafetyLevel } from '../../lib/types';
import { cn } from '../../lib/utils';

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

export function OutputSection({ number }: { number: number }) {
  const t = useT();
  const s = useSettings();
  const [advanced, setAdvanced] = useState(false);

  return (
    <Section foldable title={`${number}. ${t('brief.settings')}`}>
      <FormatField />
      <Field label={t('brief.count')}>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={String(s.count)}
          onValueChange={(v) => v && s.set({ count: Number(v) as 1 | 2 | 4 })}
        >
          {['1', '2', '4'].map((n) => (
            <ToggleGroupItem key={n} value={n} className="flex-1">
              ×{n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {s.provider === 'replicate' && (
      <button
        type="button"
        onClick={() => setAdvanced(!advanced)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={advanced}
      >
        <ChevronRight className={cn('size-3.5 transition-transform', advanced && 'rotate-90')} />
        {t('brief.advanced')}
      </button>
      )}
      {advanced && s.provider === 'replicate' && (
        <div className="space-y-2.5">
          {(
            <Field label={t('brief.fileFormat')}>
              <ToggleGroup type="single" variant="outline" className="w-full" value={s.format} onValueChange={(v) => v && s.set({ format: v as OutputFormat })}>
                <ToggleGroupItem value="png" className="flex-1">PNG</ToggleGroupItem>
                <ToggleGroupItem value="jpg" className="flex-1">JPG</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          )}
          {s.model === 'nano-banana-pro' && (
            <Field label={t('brief.safety')} htmlFor="safety">
              <Select value={s.safety} onValueChange={(v) => s.set({ safety: v as SafetyLevel })}>
                <SelectTrigger id="safety" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block_only_high">{t('brief.safetyPermissive')}</SelectItem>
                  <SelectItem value="block_medium_and_above">{t('brief.safetyMedium')}</SelectItem>
                  <SelectItem value="block_low_and_above">{t('brief.safetyStrict')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      )}
    </Section>
  );
}
