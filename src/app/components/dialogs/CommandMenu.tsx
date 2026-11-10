import { Bot, Folder, Palette, Plus, Settings, Sparkles, SunMoon, Users, Wand2 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../ui/command';
import { MOD } from '../TopBar';
import { COMMANDS, isAvailable, type Command } from '../../commands';
import { useUI } from '../../stores/ui';
import { isMakingView, useWorkspace } from '../../stores/workspace';
import { useSettings } from '../../stores/settings';
import { useResolvedTheme } from '../../hooks/use-theme';
import { useT } from '../../i18n';

export function CommandMenu() {
  const t = useT();
  const open = useUI((s) => s.dialog === 'commands');
  const { close, open: openDialog } = useUI();
  const ws = useWorkspace();
  const resolved = useResolvedTheme();
  const setSettings = useSettings((s) => s.set);

  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const item = (c: Command) => (
    <CommandItem key={c.id} onSelect={run(() => c.run(useWorkspace.getState()))} disabled={!isAvailable(c, ws)}>
      <c.icon /> {t(c.label(ws))}
      <CommandShortcut>{c.key.toUpperCase()}</CommandShortcut>
    </CommandItem>
  );

  return (
    <CommandDialog open={open} onOpenChange={(o) => !o && close()} title={t('topbar.commands')} description={t('commands.placeholder')}>
      <CommandInput placeholder={t('commands.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('commands.empty')}</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={run(ws.generate)} disabled={!isMakingView(ws.view)}>
            <Wand2 /> {t('commands.generate')}
            <CommandShortcut>{MOD} ↵</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(() => openDialog('assistant'))} disabled={ws.view !== 'image'}>
            <Sparkles /> {t('commands.assistant')}
          </CommandItem>
          {COMMANDS.filter((c) => c.group === 'view').map(item)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          {COMMANDS.filter((c) => c.group === 'tool').map(item)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={run(() => openDialog('personas'))}>
            <Users /> {t('commands.personas')}
          </CommandItem>
          <CommandItem onSelect={run(() => openDialog('styles'))} disabled={ws.view !== 'image'}>
            <Palette /> {t('commands.styles')}
          </CommandItem>
          <CommandItem onSelect={run(() => openDialog('settings'))}>
            <Settings /> {t('commands.openSettings')}
          </CommandItem>
          <CommandItem onSelect={run(() => openDialog('agent'))}>
            <Bot /> {t('commands.agent')}
          </CommandItem>
          <CommandItem onSelect={run(() => setSettings({ theme: resolved === 'dark' ? 'light' : 'dark' }))}>
            <SunMoon /> {t('commands.toggleTheme')}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t('commands.switchProject')}>
          <CommandItem onSelect={run(() => openDialog('newProject'))}>
            <Plus /> {t('commands.newProject')}
          </CommandItem>
          {ws.projects.map((p) => (
            <CommandItem key={p.id} value={`project ${p.name} ${p.id}`} onSelect={run(() => ws.openProject(p.id))}>
              <Folder /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
