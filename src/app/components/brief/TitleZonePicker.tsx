import { Field } from '../Section';
import { PromptCode } from './PromptCode';
import { titleZoneLine } from '../../lib/prompt';
import { useWorkspace } from '../../stores/workspace';
import { useT } from '../../i18n';
import type { TitleZone } from '../../lib/types';
import { cn } from '../../lib/utils';

const ZONES: Exclude<TitleZone, 'none'>[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

function ZoneButton({ zone, active, onClick, className }: { zone: TitleZone; active: boolean; onClick: () => void; className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-sm border bg-background px-0.5 text-[11px] leading-tight transition-colors hover:bg-accent',
        active && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
        className,
      )}
    >
      {t(`promptOptions.zones.${zone}`)}
    </button>
  );
}

/** Where the image keeps room for the text added afterwards with the text tool. */
export function TitleZonePicker() {
  const t = useT();
  const { brief, setBrief, promptOptions } = useWorkspace();
  const current = promptOptions().titleZone;
  const choose = (titleZone: TitleZone) => setBrief({ options: { ...brief.options, titleZone } });

  return (
    <Field label={t('promptOptions.titleZone')} hint={current === 'bottom-right' ? t('promptOptions.zoneDuration') : undefined}>
      <div className="grid aspect-video grid-cols-3 grid-rows-3 gap-1 rounded-md border bg-muted/40 p-1">
        {ZONES.map((zone) => (
          <ZoneButton key={zone} zone={zone} active={current === zone} onClick={() => choose(zone)} />
        ))}
      </div>
      <ZoneButton zone="none" active={current === 'none'} onClick={() => choose('none')} className="h-8 w-full" />
      <PromptCode text={titleZoneLine(current)} />
    </Field>
  );
}
