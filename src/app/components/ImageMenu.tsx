import type { ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { useT } from '../i18n';

/** The right-click menu of an image; `disabled` leaves the right click to the active tool. */
export function ImageMenu({ onDuplicate, disabled, children }: { onDuplicate: () => void; disabled?: boolean; children: ReactNode }) {
  const t = useT();
  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={disabled} className="contents">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy /> {t('filmstrip.duplicate')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
