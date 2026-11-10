import { useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { TopBar } from './components/TopBar';
import { runShortcut } from './commands';
import { BlockingJobOverlay, runningJobs } from './components/canvas/BlockingJob';
import { BriefPanel } from './components/brief/BriefPanel';
import { CanvasArea } from './components/canvas/CanvasArea';
import { Filmstrip } from './components/Filmstrip';
import { IteratePanel } from './components/iterate/IteratePanel';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { PersonaDialog } from './components/dialogs/PersonaDialog';
import { StyleDialog } from './components/dialogs/StyleDialog';
import { AssistantDialog } from './components/dialogs/AssistantDialog';
import { ErrorDialog } from './components/dialogs/ErrorDialog';
import { CommandMenu } from './components/dialogs/CommandMenu';
import { AgentDialog } from './components/dialogs/AgentDialog';
import { NewProjectDialog } from './components/dialogs/NewProjectDialog';
import { useAgent } from './agent/bridge';
import { useApplyTheme } from './hooks/use-theme';
import { isLayerTool, isMakingView, useWorkspace } from './stores/workspace';
import { useText } from './stores/text';
import { useUI } from './stores/ui';
import { useSettings } from './stores/settings';
import { requestPersistence } from './lib/db';
import { useT } from './i18n';

/** The brief panel, greyed and inert in the preview and compare views. */
function BriefArea() {
  const t = useT();
  const active = useWorkspace((s) => isMakingView(s.view));
  if (active) return <BriefPanel />;
  return (
    <div className="relative flex h-full flex-col">
      <p className="mx-4 mt-4 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">{t('brief.otherView')}</p>
      <div inert className="min-h-0 flex-1 opacity-50 select-none">
        <BriefPanel />
      </div>
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export default function App() {
  useApplyTheme();
  const t = useT();
  const ready = useWorkspace((s) => s.ready);

  useEffect(() => {
    (async () => {
      await useWorkspace.getState().init();
      requestPersistence();
      // After init: agent tools act on a loaded workspace.
      useAgent.getState().init();
      if (!useSettings.getState().apiKey()) useUI.getState().open('settings');
    })();

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }

    const onOpenSettings = () => useUI.getState().open('settings');
    window.addEventListener('nt:open-settings', onOpenSettings);
    return () => window.removeEventListener('nt:open-settings', onOpenSettings);
  }, []);

  // Language attribute for accessibility and hyphenation
  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Nano Banana is working: shortcuts would act on an image about to change.
      if (runningJobs(useWorkspace.getState().jobs).length) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        // The brief panel is off in the preview and compare views.
        if (isMakingView(useWorkspace.getState().view)) useWorkspace.getState().generate();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const ui = useUI.getState();
        ui.dialog === 'commands' ? ui.close() : ui.open('commands');
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && useWorkspace.getState().view === 'sketch' && !isTyping(e.target) && !useUI.getState().dialog) {
        // In the Gribouillis view: undo the last stroke of the sketch.
        e.preventDefault();
        useWorkspace.getState().undoSketchStroke();
      } else if (!mod && !isTyping(e.target) && !useUI.getState().dialog) {
        const ws = useWorkspace.getState();
        // Letters (any case) come from the command list, shared with the palette and the edit bar.
        if (e.key.length === 1) runShortcut(e.key);
        else if (e.key === 'Escape' && ws.tool) ws.setTool(null);
        else if ((e.key === 'Delete' || e.key === 'Backspace') && isLayerTool(ws.tool)) {
          const text = useText.getState();
          if (text.selectedId) text.remove(text.selectedId);
        }
      }
    };
    // Paste images anywhere to add them as references
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        useWorkspace.getState().addFiles(files);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh min-w-5xl flex-col overflow-hidden bg-background">
        <TopBar />
        {!ready ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize={340} minSize={290} maxSize={500} className="bg-sidebar">
              <BriefArea />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={420}>
              <div className="flex h-full min-w-0 flex-col">
                <CanvasArea />
                <Filmstrip />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={340} minSize={290} maxSize={500} className="bg-sidebar">
              <IteratePanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <SettingsDialog />
      <PersonaDialog />
      <StyleDialog />
      <AssistantDialog />
      <ErrorDialog />
      <CommandMenu />
      <AgentDialog />
      <NewProjectDialog />
      <BlockingJobOverlay />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
