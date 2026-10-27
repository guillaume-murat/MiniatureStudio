import { Grid2x2, ImageIcon, PanelsTopLeft, Tv } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { selectedGeneration, useWorkspace, type ViewMode } from '../../stores/workspace';
import { useT } from '../../i18n';

/** Image / feed preview / channel preview / compare: in the top bar on desktop, above the canvas on mobile. */
export function ViewSwitcher({ className }: { className?: string }) {
  const t = useT();
  const view = useWorkspace((s) => s.view);
  const setView = useWorkspace((s) => s.setView);
  const picked = useWorkspace((s) => s.pickedIds.length);
  const gen = useWorkspace(selectedGeneration);
  return (
    <ToggleGroup type="single" size="sm" value={view} onValueChange={(v) => v && setView(v as ViewMode)} className={className}>
      <ToggleGroupItem value="image" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewImage')} aria-label={t('canvas.viewImage')}>
        <ImageIcon /> <span className="hidden sm:inline">{t('canvas.viewImage')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="feed" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewFeed')} aria-label={t('canvas.viewFeed')} disabled={!gen}>
        <Tv /> <span className="hidden sm:inline">{t('canvas.viewFeed')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="channel" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewChannel')} aria-label={t('canvas.viewChannel')}>
        <PanelsTopLeft /> <span className="hidden sm:inline">{t('canvas.viewChannel')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="compare" className="gap-1.5 px-2.5 text-xs" title={t('canvas.viewCompare')} aria-label={t('canvas.viewCompare')}>
        <Grid2x2 /> <span className="hidden sm:inline">{t('canvas.viewCompare')}</span>
        {picked > 0 && <span className="tabular text-muted-foreground">{picked}</span>}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
