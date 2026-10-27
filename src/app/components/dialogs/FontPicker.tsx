import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { findBundledFont, FONT_CATEGORIES, FontNotFoundError, GOOGLE_FONTS, loadFontPreview, loadGoogleFont, normaliseFamily } from '../../lib/fonts';
import { cn } from '../../lib/utils';
import { useT } from '../../i18n';

/**
 * One Google Fonts family at most: searchable list, any other family can be typed in.
 * `compact` (text tool toolbar): just the picker, no clear button nor preview.
 */
export function FontPicker({
  value,
  onChange,
  sample = '',
  compact = false,
  className,
}: {
  value: string;
  onChange: (family: string) => void;
  sample?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ family: string; heavy: number } | 'loading' | null>(null);

  useEffect(() => {
    if (!value) return setState(null);
    let alive = true;
    setState('loading');
    loadGoogleFont(value).then(
      ({ heavy }) => alive && setState({ family: value, heavy }),
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
  const ready = state && state !== 'loading' && state.family === value ? state : null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              role="combobox"
              aria-expanded={open}
              aria-label={t('brand.font')}
              className="min-w-0 flex-1 justify-between font-normal"
            >
              <span className={cn('truncate', !value && 'text-muted-foreground')} style={ready ? { fontFamily: `"${value}"` } : undefined}>
                {value || t('brand.fontPlaceholder')}
              </span>
              {state === 'loading' ? <Loader2 className="animate-spin opacity-50" /> : <ChevronsUpDown className="opacity-50" />}
            </Button>
          </PopoverTrigger>
          {/* The list is portaled outside the dialog, whose scroll lock cancels wheel and touch
              scrolling there; stopping the events here keeps them from reaching that lock. */}
          <PopoverContent
            className="w-(--radix-popover-trigger-width) min-w-64 p-0"
            align="start"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <Command>
              <CommandInput value={query} onValueChange={setQuery} placeholder={t('brand.fontSearch')} />
              <CommandList>
                <CommandEmpty>{t('commands.empty')}</CommandEmpty>
                {FONT_CATEGORIES.map((category) => (
                  <CommandGroup key={category} heading={t(`brand.fontCategories.${category}`)}>
                    {GOOGLE_FONTS.filter((f) => f.category === category).map((f) => (
                      <CommandItem key={f.family} value={f.family} onSelect={() => choose(f.family)} className="text-base">
                        <span style={{ fontFamily: `"${f.family}", var(--font-sans)` }}>{f.family}</span>
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
        {value && !compact && (
          <Button variant="ghost" size="icon" onClick={() => onChange('')} aria-label={t('common.remove')}>
            <X />
          </Button>
        )}
      </div>

      {ready && !compact && (
        <div className="overflow-hidden rounded-md border bg-muted/40 px-3 py-2" style={{ fontFamily: `"${value}"` }}>
          <p className="truncate text-3xl leading-tight uppercase" style={{ fontWeight: ready.heavy }}>
            {sample}
          </p>
          <p className="truncate text-sm text-muted-foreground">Aa Bb Cc 0123456789 — {value}</p>
        </div>
      )}
    </div>
  );
}
