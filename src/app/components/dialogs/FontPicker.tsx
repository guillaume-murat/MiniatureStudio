import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { FONT_CATEGORIES, FontNotFoundError, GOOGLE_FONTS, loadGoogleFont, normaliseFamily } from '../../lib/fonts';
import { cn } from '../../lib/utils';
import { useT } from '../../i18n';

/** One Google Fonts family at most: searchable list, any other family can be typed in. */
export function FontPicker({ value, onChange, sample }: { value: string; onChange: (family: string) => void; sample: string }) {
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

  async function choose(family: string) {
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="min-w-0 flex-1 justify-between font-normal">
              <span className={cn('truncate', !value && 'text-muted-foreground')} style={ready ? { fontFamily: `"${value}"` } : undefined}>
                {value || t('brand.fontPlaceholder')}
              </span>
              {state === 'loading' ? <Loader2 className="animate-spin opacity-50" /> : <ChevronsUpDown className="opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command>
              <CommandInput value={query} onValueChange={setQuery} placeholder={t('brand.fontSearch')} />
              <CommandList>
                <CommandEmpty>{t('commands.empty')}</CommandEmpty>
                {custom && !isListed && (
                  <CommandGroup>
                    <CommandItem value={`custom ${custom}`} onSelect={() => choose(custom)}>
                      {t('brand.fontUseCustom', { font: custom })}
                    </CommandItem>
                  </CommandGroup>
                )}
                {FONT_CATEGORIES.map((category) => (
                  <CommandGroup key={category} heading={t(`brand.fontCategories.${category}`)}>
                    {GOOGLE_FONTS.filter((f) => f.category === category).map((f) => (
                      <CommandItem key={f.family} value={f.family} onSelect={() => choose(f.family)}>
                        {f.family}
                        <Check className={cn('ml-auto', f.family === value ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button variant="ghost" size="icon" onClick={() => onChange('')} aria-label={t('common.remove')}>
            <X />
          </Button>
        )}
      </div>

      {ready && (
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
