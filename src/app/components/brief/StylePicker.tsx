import { Palette } from 'lucide-react';
import { Button } from '../ui/button';
import { useUI } from '../../stores/ui';
import { useT } from '../../i18n';

/** Opens the style library, which inserts a style's text into the scene: the project keeps no style of its own. */
export function StylePicker() {
  const t = useT();
  const open = useUI((s) => s.open);
  return (
    <Button variant="outline" className="w-full justify-start gap-2 font-normal" onClick={() => open('styles')}>
      <Palette />
      <span className="truncate">{t('brief.styleInsert')}</span>
    </Button>
  );
}
