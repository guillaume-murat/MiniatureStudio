import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { findBundledFont, FONT_CATEGORIES, FontNotFoundError, GOOGLE_FONTS, loadFontPreview, loadGoogleFont, normaliseFamily } from '../../lib/fonts';
import { cn } from '../../lib/utils';
import { useT } from '../../i18n';

/** Google Fonts family of a text block: searchable list, any other family can be typed in. */
export function FontPicker({ value, onChange, className }: { value: string; onChange: (family: string) => void; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<string | 'loading' | null>(null);

  useEffect(() => {
    if (!value) return setState(null);
    let alive = true;
    setState('loading');
    loadGoogleFont(value).then(
      () => alive && setState(value),
      () => alive && setState(null),
    );
    return () => {
      alive = false;
    };
  }, [value]);

  // Bundled files, so previewing the whole list costs no request to Google.
  useEffect(() => {
    if (open) for (const f of GOOGLE_FONTS) loadFontPreview(f.family).catch(() => {});
  }, [open]);

  async function choose(name: string) {
    const family = findBundledFont(name)?.family ?? name;
    setOpen(false);
    setQuery('');
    if (family === value) return;
    try {
      await loadGoogleFont(family);
      onChange(family);
    } catch (error) {
      toast.error(error instanceof FontNotFoundError ? t('brand.fontNotFound', { font: family }) : t('errors.network'));
    }
  }

  const custom = normaliseFamily(query);
  const isListed = custom && GOOGLE_FONTS.some((f) => f.family.toLowerCase() === custom.toLowerCase());
  const ready = state === value;

  return (
    // The trigger fills the given width and truncates the name: on its own a long family pushed it past its box.
    <div className={cn('flex shrink-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label={t('brand.font')}
            className="w-full min-w-0 justify-between font-normal"
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')} style={ready ? { fontFamily: `"${value}"` } : undefined}>
              {value || t('brand.fontPlaceholder')}
            </span>
            {state === 'loading' ? <Loader2 className="animate-spin opacity-50" /> : <ChevronsUpDown className="opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command>
            <CommandInput value={query} onValueChange={setQuery} placeholder={t('brand.fontSearch')} />
            <CommandList>
              <CommandEmpty>{t('commands.empty')}</CommandEmpty>
              {FONT_CATEGORIES.map((category) => (
                <CommandGroup key={category} heading={t(`brand.fontCategories.${category}`)}>
                  {GOOGLE_FONTS.filter((f) => f.category === category).map((f) => (
                    <CommandItem key={f.family} value={f.family} onSelect={() => choose(f.family)} className="text-base">
                      <span
                        style={{
                          fontFamily: `"${f.family}", var(--font-sans)`,
                        }}
                      >
                        {f.family}
                      </span>
                      <Check className={cn('ml-auto', f.family === value ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {/* Last, so Enter picks a listed font that matches the search first. */}
              {custom && !isListed && (
                <CommandGroup>
                  <CommandItem value={`custom ${custom}`} onSelect={() => choose(custom)}>
                    {t('brand.fontUseCustom', { font: custom })}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
