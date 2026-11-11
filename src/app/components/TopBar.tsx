import { useState } from 'react';
import { Check, ChevronsUpDown, Folder, KeyRound, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { TOP_BUTTON, ViewSwitcher } from './canvas/ViewSwitcher';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { useWorkspace } from '../stores/workspace';
import { useSettings } from '../stores/settings';
import { useUI } from '../stores/ui';
import { useAgent } from '../agent/bridge';
import { AgentStatusDot } from './dialogs/AgentDialog';
import { useT } from '../i18n';
import { cn } from '../lib/utils';
import { AUTHOR_URL, ORIGIN_REPO_URL } from '../lib/about';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

function ProjectSwitcher() {
  const t = useT();
  const { projects, projectId, openProject, renameProject, removeProject } = useWorkspace();
  const current = projects.find((p) => p.id === projectId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn(TOP_BUTTON, "max-w-40 gap-2 font-medium xl:max-w-48")}>
                <Folder />
                <span className="truncate">{current?.name ?? t('topbar.untitled')}</span>
                <ChevronsUpDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('topbar.projects')}</DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {projects.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => openProject(p.id)}>
                  <span className="truncate">{p.name}</span>
                  {p.id === projectId && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => useUI.getState().open('newProject')}>
              <Plus /> {t('topbar.newProject')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setName(current?.name ?? '');
                setRenaming(true);
              }}
            >
              <Pencil /> {t('topbar.renameProject')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> {t('topbar.deleteProject')}
            </DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('topbar.renameProject')}</DialogTitle>
          </DialogHeader>
          <form
            id="rename-project"
            onSubmit={(e) => {
              e.preventDefault();
              renameProject(name);
              setRenaming(false);
            }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={t('topbar.renameProject')} />
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="rename-project">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('topbar.deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>{t('topbar.deleteProjectConfirm', { name: current?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => current && removeProject(current.id)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


/** Who made it: the author's site, and the project it is forked from. Short names in a narrow window. */
function Credit() {
  const t = useT();
  const link = 'w-fit underline-offset-2 hover:underline focus-visible:underline';
  return (
    <span className="flex flex-col font-sans leading-tight font-normal whitespace-nowrap">
      <a href={AUTHOR_URL} target="_blank" rel="noreferrer" className={cn(link, 'underline text-xs text-[color-mix(in_oklab,var(--on-brand)_85%,var(--brand))]')}>
        {/* The whole line is underlined: it is a link. */}
        {t('credit.by')} <span className="hidden min-[1440px]:inline">Guillaume Murat</span>
        <span className="min-[1440px]:hidden">G. Murat</span>
      </a>
      <a href={ORIGIN_REPO_URL} target="_blank" rel="noreferrer" className={cn(link, 'text-[11px] text-[color-mix(in_oklab,var(--on-brand)_68%,var(--brand))]')}>
        <span className="hidden min-[1440px]:inline">{t('credit.fork')}</span>
        <span className="min-[1440px]:hidden">{t('credit.forkShort')}</span>
      </a>
    </span>
  );
}

export function TopBar() {
  const t = useT();
  const hasKey = useSettings((s) => !!s.apiKey());
  const open = useUI((s) => s.open);
  const agentOn = useAgent((s) => s.enabled);

  return (
    <header className="topbar relative flex h-13 shrink-0 items-center gap-1 border-b-2 border-(--brand-edge) bg-sidebar px-2">
      {/* Left and right take equal room, so the tabs stay centred on the window. */}
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-1 font-heading text-[15px] font-semibold">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={28} height={28} className="size-7 shrink-0 rounded-md border-2 border-ink" draggable={false} />
        <span className="hidden whitespace-nowrap xl:inline">Miniature Studio</span>
        <Credit />
      </div>
      <span className="mx-1 h-5 w-px bg-border" />
      <ProjectSwitcher />
      </div>
      <ViewSwitcher className="view-tabs relative shrink-0 self-end" />

      {/* Commands, the agent, theme and language live in Settings: the bar keeps room for the tabs. */}
      <div className="flex flex-1 basis-0 items-center justify-end gap-1.5">
        {!hasKey && (
          <Button size="sm" className="gap-2" onClick={() => useUI.getState().showKeySetup()}>
            <KeyRound /> <span className="hidden min-[1440px]:inline">{t('topbar.keyMissing')}</span>
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => open('settings')} aria-label={t('topbar.settings')} className={cn(TOP_BUTTON, 'relative')}>
              <Settings />
              {agentOn && <AgentStatusDot className="absolute top-1 right-1 size-1.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('topbar.settings')}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
