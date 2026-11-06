import { Grid2x2, ImageIcon, PanelsTopLeft, Tv } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { selectedGeneration, useWorkspace, type ViewMode } from '../../stores/workspace';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

/** A top bar button: its own outline, fill and small relief, so it stands out on the bar's green. */
export const TOP_BUTTON =
  'border-[1.5px] border-border bg-background text-foreground shadow-btn-sm hover:bg-accent hover:text-accent-foreground dark:bg-background dark:hover:bg-accent';

/** Image / feed preview / channel preview / compare: in the top bar. */
export function ViewSwitcher({ className }: { className?: string }) {
  const t = useT();
  const view = useWorkspace((s) => s.view);
  const setView = useWorkspace((s) => s.setView);
  const picked = useWorkspace((s) => s.pickedIds.length);
  const gen = useWorkspace(selectedGeneration);
  return (
    <ToggleGroup type="single" size="sm" spacing={1.5} value={view} onValueChange={(v) => v && setView(v as ViewMode)} className={className}>
      <ToggleGroupItem value="image" className={cn(TOP_BUTTON, 'gap-1.5 px-2.5 text-xs data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-on-ink')} title={t('canvas.viewImage')} aria-label={t('canvas.viewImage')}>
        <ImageIcon /> <span>{t('canvas.viewImage')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="feed" className={cn(TOP_BUTTON, 'gap-1.5 px-2.5 text-xs data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-on-ink')} title={t('canvas.viewFeed')} aria-label={t('canvas.viewFeed')} disabled={!gen}>
        <Tv /> <span>{t('canvas.viewFeed')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="channel" className={cn(TOP_BUTTON, 'gap-1.5 px-2.5 text-xs data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-on-ink')} title={t('canvas.viewChannel')} aria-label={t('canvas.viewChannel')}>
        <PanelsTopLeft /> <span>{t('canvas.viewChannel')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="compare" className={cn(TOP_BUTTON, 'gap-1.5 px-2.5 text-xs data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-on-ink')} title={t('canvas.viewCompare')} aria-label={t('canvas.viewCompare')}>
        <Grid2x2 /> <span>{t('canvas.viewCompare')}</span>
        {picked > 0 && <span className="tabular text-muted-foreground">{picked}</span>}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
