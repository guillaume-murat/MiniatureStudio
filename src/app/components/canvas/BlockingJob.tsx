import { Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useWorkspace, type Job } from '../../stores/workspace';
import { useT } from '../../i18n';

/** The running job that locks the studio (a reframe), if any. */
export function blockingJob(jobs: Job[]): Job | undefined {
  return jobs.find((j) => j.status === 'running' && j.blocking);
}

/**
 * While a reframe runs, the image it starts from is about to be replaced:
 * everything is locked (the image itself is blurred in ImageView) until it
 * lands or is cancelled.
 */
export function BlockingJobOverlay() {
  const t = useT();
  const job = useWorkspace((s) => blockingJob(s.jobs));
  const cancelJob = useWorkspace((s) => s.cancelJob);
  if (!job) return null;
  return (
    <div className="fixed inset-0 z-50 flex cursor-wait items-center justify-center" role="alertdialog" aria-busy="true" aria-label={t('reframe.running')}>
      <div className="flex cursor-default items-center gap-3 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-4 text-sm shadow-xl">
        <Loader2 className="size-4 animate-spin text-primary" />
        {t('reframe.running')}
        <span className="tabular text-muted-foreground">{Math.round(job.elapsed / 1000)} s</span>
        <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)}>
          <X /> {t('reframe.cancel')}
        </Button>
      </div>
    </div>
  );
}
