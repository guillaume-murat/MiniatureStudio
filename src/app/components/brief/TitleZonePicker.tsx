import { Field } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { titleZoneLine } from '../../lib/prompt';
import { useSettings } from '../../stores/settings';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { TitleZone } from '../../lib/types';
import { cn } from '../../lib/utils';

type Zone = Exclude<TitleZone, 'none'>;

const ZONES: Zone[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
/** Where the room goes until another zone is chosen. */
const FIRST_ZONE: Zone = 'top-left';

/** A placeholder thumbnail under the zones: a person in a landscape, whatever the theme. */
function PlaceholderScene() {
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="zone-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f5c45" />
          <stop offset="0.65" stopColor="#7fb069" />
          <stop offset="1" stopColor="#f2d15a" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="url(#zone-sky)" />
      <circle cx="118" cy="34" r="11" fill="#fff0a8" />
      <path d="M0 66 Q30 48 62 62 T124 58 T160 64 V90 H0 Z" fill="#14513c" />
      <path d="M0 78 Q44 66 90 76 T160 74 V90 H0 Z" fill="#0c3a2a" />
      <circle cx="80" cy="42" r="12" fill="#06170f" />
      <path d="M54 90 C54 66 66 52 80 52 S106 66 106 90 Z" fill="#06170f" />
    </svg>
  );
}

/** Where the image keeps room for the text added afterwards with the text tool. */
export function TitleZonePicker() {
  const t = useT();
  const sketchView = useWorkspace((s) => s.view === 'sketch');
  const lang = useSettings((s) => s.lang);
  const { brief, setBrief, promptOptions } = useWorkspace();
  const current = promptOptions().titleZone;
  const choose = (titleZone: TitleZone) => setBrief({ options: { ...brief.options, titleZone } });

  return (
    <Field label={t('promptOptions.titleZone')} disabledReason={sketchView ? t('sketch.greyed') : undefined} htmlFor="titleZone" prompt={titleZoneLine(lang, current)} hint={current === 'bottom-right' ? t('promptOptions.zoneDuration') : undefined}>
      <Select value={current === 'none' ? 'none' : 'room'} onValueChange={(v) => choose(v === 'none' ? 'none' : FIRST_ZONE)}>
        <SelectTrigger id="titleZone" className="w-full gap-1 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('promptOptions.zones.none')}</SelectItem>
          <SelectItem value="room">{t('promptOptions.zoneRoom')}</SelectItem>
        </SelectContent>
      </Select>
      {current !== 'none' && (
      <div className="relative aspect-video overflow-hidden rounded-md border">
        <PlaceholderScene />
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {ZONES.map((zone) => {
            const active = current === zone;
            return (
              <button
                key={zone}
                type="button"
                aria-pressed={active}
                aria-label={t(`promptOptions.zones.${zone}`)}
                onClick={() => choose(zone)}
                className={cn(
                  'flex items-center justify-center border border-dashed border-white/35 px-0.5 text-[11px] leading-tight text-white transition-colors [text-shadow:0_1px_2px_rgb(0_0_0/0.8)] hover:bg-white/20',
                  // The room kept in the image, with the text it is for.
                  active && 'border-solid border-white bg-white/85 [text-shadow:none] hover:bg-white/85',
                )}
              >
                {active ? <span className="rounded-sm bg-black px-1.5 py-0.5 text-xs font-bold text-white">{t('promptOptions.zoneSample')}</span> : t(`promptOptions.zones.${zone}`)}
              </button>
            );
          })}
        </div>
      </div>
      )}
    </Field>
  );
}
