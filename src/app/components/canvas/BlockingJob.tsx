import { Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useWorkspace, type Job } from '../../stores/workspace';
import { useT, type TKey } from '../../i18n';

/** The image calls under way: while there is one, the studio is locked. */
export function runningJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.status === 'running');
}

function busyLabel(job: Job): TKey {
  if (job.action === 'reframe' || job.action === 'heal') return `busy.${job.action}`;
  if (job.kind === 'generate' || job.kind === 'upscale' || job.kind === 'region') return `busy.${job.kind}`;
  return 'busy.edit';
}

/**
 * While Nano Banana works (a generation, an edit, a reframe, an upscale…),
 * everything is locked and the central panel blurred (CanvasArea): another
 * click would act on an image about to change. Cancel stops every call.
 */
export function BlockingJobOverlay() {
  const t = useT();
  // Select the list itself: a filtered copy is a new array every time, which loops React.
  const jobs = runningJobs(useWorkspace((s) => s.jobs));
  const cancelAll = useWorkspace((s) => s.cancelAll);
  if (!jobs.length) return null;
  const label = t(busyLabel(jobs[0]));
  const elapsed = Math.max(...jobs.map((j) => j.elapsed));
  return (
    <div className="fixed inset-0 z-50 flex cursor-wait items-center justify-center" role="alertdialog" aria-busy="true" aria-label={label}>
      <div className="flex cursor-default items-center gap-3 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-4 text-sm shadow-xl">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}
        {jobs.length > 1 && <span className="text-muted-foreground">{t('busy.images', { n: jobs.length })}</span>}
        <span className="tabular text-muted-foreground">{Math.round(elapsed / 1000)} s</span>
        <Button variant="ghost" size="sm" onClick={cancelAll}>
          <X /> {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
