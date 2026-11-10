import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { useWorkspace, type Job } from '../../stores/workspace';
import { useT, type TKey } from '../../i18n';
import { waitProgress } from '../../lib/waitProgress';

/** The image calls under way: while there is one, the studio is locked. */
export function runningJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.status === 'running');
}

function busyLabel(job: Job): TKey {
  if (job.action === 'reframe' || job.action === 'heal' || job.action === 'face') return `busy.${job.action}`;
  if (job.kind === 'generate' || job.kind === 'upscale' || job.kind === 'region') return `busy.${job.kind}`;
  return 'busy.edit';
}

/**
 * While the model works (a generation, an edit, a reframe, an upscale…), everything is
 * locked and the central panel blurred (CanvasArea): another click would act on an image
 * about to change. The card shows the logo painting and a bar that fills in about the
 * time a call takes (`waitProgress`). Cancel stops every call.
 */
export function BlockingJobOverlay() {
  const t = useT();
  // Select the list itself: a filtered copy is a new array every time, which loops React.
  const jobs = runningJobs(useWorkspace((s) => s.jobs));
  const cancelAll = useWorkspace((s) => s.cancelAll);
  const startedAt = jobs.length ? Math.min(...jobs.map((j) => j.startedAt)) : 0;
  const now = useNow(jobs.length > 0);
  if (!jobs.length) return null;
  const label = t(busyLabel(jobs[0]));
  const progress = waitProgress(now - startedAt);
  return (
    <div className="fixed inset-0 z-50 flex cursor-wait items-center justify-center" role="alertdialog" aria-busy="true" aria-label={label}>
      <div className="flex w-72 cursor-default flex-col items-center gap-3 rounded-[20px] border-2 border-ink bg-background px-6 pt-6 pb-4 text-sm shadow-pop-lg">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={64} height={64} className="logo-paint size-16 rounded-xl border-2 border-ink" draggable={false} />
        <p className="font-heading text-base font-semibold">
          {label}
          {jobs.length > 1 && <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">{t('busy.images', { n: jobs.length })}</span>}
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
        <Button variant="ghost" size="sm" onClick={cancelAll}>
          <X /> {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

/** The time, every 200 ms while `on`: the bar follows it. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}
