import { useState } from 'react';
import { ArrowLeft, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Field } from '../Section';
import { Checkbox } from '../ui/checkbox';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useUI } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { deletePersona, putPersona, uid } from '../../lib/db';
import { normaliseUpload } from '../../lib/images';
import { useT } from '../../i18n';
import type { Persona, PersonaPhoto } from '../../lib/types';
import { canUse, MAX_PERSONA_PHOTOS, MAX_USED_PHOTOS, normalisePhotos, usedPhotos } from '../../lib/personaPhotos';
import { cn } from '../../lib/utils';

/** Picks one or more image files. */
function pickFiles(onFiles: (files: File[]) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => input.files?.length && onFiles([...input.files]);
  input.click();
}

/** One photo: its tick (sent to the model or not) and its remove button. */
function PhotoTile({ photo, index, canTick, onTick, onRemove }: { photo: PersonaPhoto; index: number; canTick: boolean; onTick: (used: boolean) => void; onRemove: () => void }) {
  const t = useT();
  const url = useBlobUrl(photo.blob);
  const label = canTick ? t('persona.use') : t('persona.useFull');
  return (
    <div className={cn('group relative aspect-[3/4] overflow-hidden rounded-lg border', !photo.used && 'border-dashed')}>
      {url && <img src={url} alt="" className={cn('size-full object-cover transition-opacity', !photo.used && 'opacity-50')} />}
      <label className="absolute top-1 left-1 flex size-6 items-center justify-center rounded-md bg-background/90" title={label}>
        <Checkbox checked={photo.used} disabled={!canTick} onCheckedChange={(v) => onTick(v === true)} aria-label={`${label} (${index + 1})`} />
      </label>
      <Button
        type="button"
        onClick={onRemove}
        variant="outline"
        size="icon-2xs"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
        aria-label={t('common.remove')}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}

/** Adds photos, by click or by dropping files, up to 10. */
function AddPhotos({ room, onAdd }: { room: number; onAdd: (files: File[]) => void }) {
  const t = useT();
  const [over, setOver] = useState(false);
  const add = (files: File[]) => onAdd(files.filter((f) => f.type.startsWith('image/')).slice(0, room));
  return (
    <button
      type="button"
      onClick={() => pickFiles(add)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add([...e.dataTransfer.files]);
      }}
      className={cn(
        'flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 p-1 text-center text-xs text-muted-foreground transition-colors hover:border-primary/50',
        over && 'border-primary bg-accent',
      )}
    >
      <ImagePlus className="size-6 text-muted-foreground/70" />
      {t('persona.addPhotos')}
    </button>
  );
}

function Editor({ initial, onDone }: { initial?: Persona; onDone: () => void }) {
  const t = useT();
  const reload = useWorkspace((s) => s.reloadPersonas);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photos, setPhotos] = useState<PersonaPhoto[]>(initial?.photos ?? []);

  const ticked = usedPhotos(photos).length;
  async function addFiles(files: File[]) {
    const blobs = await Promise.all(files.map((file) => normaliseUpload(file, 1536)));
    // A new photo is ticked while there is room for it.
    setPhotos((ps) => normalisePhotos([...ps, ...blobs.map((blob) => ({ id: uid('ph_'), blob, used: true }))]));
  }

  async function save() {
    if (!name.trim()) return void toast.error(t('persona.needName'));
    if (!ticked) return void toast.error(t('persona.needPhoto'));
    const id = initial?.id ?? uid('pe_');
    await putPersona({
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      photos,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    await reload();
    onDone();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-2">
        <Field label={t('persona.name')} htmlFor="pname">
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('persona.namePlaceholder')} autoFocus />
        </Field>
        <Field label={<>{t('persona.about')} <span className="font-normal text-muted-foreground">({t('common.optional')})</span></>} htmlFor="pdesc">
          <Input id="pdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('persona.aboutPlaceholder')} />
        </Field>
      </div>

      <Field label={t('persona.photosTitle')} hint={t('persona.photosHint')}>
        <div className="grid grid-cols-5 gap-2">
          {photos.map((photo, i) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={i}
              canTick={canUse(photos, photo.id)}
              onTick={(used) => setPhotos((ps) => ps.map((x) => (x.id === photo.id ? { ...x, used } : x)))}
              onRemove={() => setPhotos((ps) => ps.filter((x) => x.id !== photo.id))}
            />
          ))}
          {photos.length < MAX_PERSONA_PHOTOS && <AddPhotos room={MAX_PERSONA_PHOTOS - photos.length} onAdd={addFiles} />}
        </div>
        {photos.length > 0 && (
          // Visible, not only in a tooltip: on touch the disabled ticks need it.
          <p className="text-xs text-muted-foreground" role="status">
            {t('persona.ticked', { used: ticked, max: MAX_USED_PHOTOS })}
            {ticked >= MAX_USED_PHOTOS && photos.length > ticked && ` ${t('persona.useFull')}`}
          </p>
        )}
      </Field>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button onClick={save}>{t('common.save')}</Button>
      </DialogFooter>
    </div>
  );
}

function PersonaCard({ persona, onEdit }: { persona: Persona; onEdit: () => void }) {
  const t = useT();
  const reload = useWorkspace((s) => s.reloadPersonas);
  const cover = persona.photos[0];
  const url = useBlobUrl(cover?.blob);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2">
      {url ? <img src={url} alt="" className="size-12 rounded-md object-cover" /> : <div className="size-12 rounded-md bg-muted" />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{persona.name}</p>
        <p className="truncate text-xs text-muted-foreground">{persona.description || t('persona.photos', { used: usedPhotos(persona.photos).length, n: persona.photos.length })}</p>
      </div>
      {confirming ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await deletePersona(persona.id);
              reload();
            }}
          >
            {t('common.delete')}
          </Button>
        </>
      ) : (
        <>
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={t('persona.edit')}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={t('common.delete')}>
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}

export function PersonaDialog() {
  const t = useT();
  const dialog = useUI((s) => s.dialog);
  const close = useUI((s) => s.close);
  const personas = useWorkspace((s) => s.personas);
  const [chosen, setChosen] = useState<Persona | 'new' | null>(null);
  // « Nouvelle personne » opens the form directly; it closes when done instead of going back to the list.
  const direct = dialog === 'newPersona';
  const open = dialog === 'personas' || direct;
  const editing = chosen ?? (direct ? 'new' : null);
  const done = () => {
    setChosen(null);
    if (direct) close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          close();
          setChosen(null);
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing && !direct && (
              <Button variant="ghost" size="icon-sm" onClick={() => setChosen(null)} aria-label={t('common.back')}>
                <ArrowLeft />
              </Button>
            )}
            {editing === 'new' ? t('persona.new') : editing ? editing.name : t('persona.title')}
          </DialogTitle>
          {!editing && <DialogDescription>{t('persona.description')}</DialogDescription>}
        </DialogHeader>

        {editing ? (
          <Editor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} onDone={done} />
        ) : (
          <div className="space-y-2">
            {personas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('persona.empty')}</p>}
            {personas.map((p) => (
              <PersonaCard key={p.id} persona={p} onEdit={() => setChosen(p)} />
            ))}
            <Button className="w-full" variant="outline" onClick={() => setChosen('new')}>
              <Plus /> {t('persona.new')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
