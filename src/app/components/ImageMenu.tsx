import { useState, type ReactNode } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { DuplicateDialog, RemoveThumbnailDialog } from './iterate/VersionDialogs';
import { useT } from '../i18n';
import type { Generation } from '../lib/types';

/** The right-click menu of an image; `disabled` leaves the right click to the active tool. */
export function ImageMenu({ gen, removable, disabled, children }: { gen: Generation; removable?: boolean; disabled?: boolean; children: ReactNode }) {
  const t = useT();
  const [duplicating, setDuplicating] = useState(false);
  const [removing, setRemoving] = useState(false);
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger disabled={disabled} className="contents">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setDuplicating(true)}>
            <Copy /> {t('versions.duplicate')}
          </ContextMenuItem>
          {removable && (
            <ContextMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => setRemoving(true)}>
              <Trash2 /> {t('canvas.deleteImage')}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <DuplicateDialog gen={gen} open={duplicating} onOpenChange={setDuplicating} />
      {removable && <RemoveThumbnailDialog gen={gen} open={removing} onOpenChange={setRemoving} />}
    </>
  );
}
