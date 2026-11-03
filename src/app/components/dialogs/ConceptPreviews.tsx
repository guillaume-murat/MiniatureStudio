import { useState } from 'react';
import { Image as ImageIcon, LayoutTemplate, Loader2, Type } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useBlobUrl } from '../../hooks/use-blob-url';
import { useSettings } from '../../stores/settings';
import { useWorkspace } from '../../stores/workspace';
import { conceptAscii, conceptLayout, type Concept, type ConceptLayout } from '../../lib/ai';
import { explainError } from '../../lib/errors';
import { useT } from '../../i18n';

type Kind = 'lite' | 'schema' | 'ascii';

function LayoutSketch({ layout }: { layout: ConceptLayout }) {
  const vertical = useSettings((s) => s.aspectRatio === '9:16');
  const [width, height] = vertical ? [56.25, 100] : [100, 56.25];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" className="w-full rounded-md border">
      <rect width={width} height={height} fill={layout.background} />
      {layout.elements.map((e, i) => {
        const [x, y, w, h] = [(e.x * width) / 100, (e.y * height) / 100, (e.w * width) / 100, (e.h * height) / 100];
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={e.kind === 'person' ? Math.min(w, h) / 2 : 1} fill={e.color} stroke="#ffffff" strokeWidth={0.3} />
            <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={3} fill="#ffffff" stroke="#000000" strokeWidth={0.5} paintOrder="stroke">
              {e.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Three ways to picture a concept, to compare them: nothing here is saved in the project. */
export function ConceptPreviews({ concept }: { concept: Concept }) {
  const t = useT();
  const previewConcept = useWorkspace((s) => s.previewConcept);
  const [image, setImage] = useState<Blob>();
  const [layout, setLayout] = useState<ConceptLayout>();
  const [ascii, setAscii] = useState('');
  const [busy, setBusy] = useState<Kind[]>([]);
  const url = useBlobUrl(image);

  async function run(kind: Kind) {
    const { provider, apiKey } = useSettings.getState();
    const key = apiKey();
    if (!key) return void toast.error(t('brief.needKey'));
    setBusy((b) => [...b, kind]);
    try {
      const auth = { provider, apiKey: key };
      if (kind === 'lite') setImage(await previewConcept(concept));
      if (kind === 'schema') setLayout(await conceptLayout(auth, concept));
      if (kind === 'ascii') setAscii(await conceptAscii(auth, concept));
    } catch (error) {
      const info = explainError(error);
      toast.error(t(info.key), { description: info.message });
    } finally {
      setBusy((b) => b.filter((k) => k !== kind));
    }
  }

  const button = (kind: Kind, Icon: typeof Type, label: string) => (
    <Button type="button" size="xs" variant="outline" className="w-full" disabled={busy.includes(kind)} onClick={() => run(kind)}>
      {busy.includes(kind) ? <Loader2 className="animate-spin" /> : <Icon />}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {button('lite', ImageIcon, t('assistant.previewLite'))}
      {button('schema', LayoutTemplate, t('assistant.previewSchema'))}
      {button('ascii', Type, t('assistant.previewAscii'))}
      {url && <img src={url} alt={concept.name} className="w-full rounded-md border" />}
      {layout && <LayoutSketch layout={layout} />}
      {ascii && <pre className="overflow-x-auto rounded-md border bg-muted p-1.5 font-mono text-[7px] leading-[1.1]">{ascii}</pre>}
    </div>
  );
}
