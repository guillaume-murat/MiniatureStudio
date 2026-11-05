import { useT } from '../../i18n';

/** A whole prompt block, for dialogs; nothing when it is empty. */
export function PromptCode({ text, heading }: { text: string; heading?: string }) {
  const t = useT();
  if (!text) return null;
  return (
    <code className="block w-full rounded-md border border-highlight/25 bg-highlight/10 px-2 py-1.5 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
      <span className="mb-1 block font-sans font-medium text-foreground not-italic">{heading ?? t('brief.promptAdded')}</span>
      <span className="block whitespace-pre-wrap italic">{text}</span>
    </code>
  );
}
