import type { Attachment } from '../db/types';
import { db } from '../db/db';
import { addPhoto, useObjectUrl, usePhotos } from '../lib/photos';

export function BlobImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt={alt} className={className} /> : null;
}

function Thumb({ a, onDelete }: { a: Attachment; onDelete?: () => void }) {
  return (
    <figure className="relative">
      <BlobImage blob={a.blob} alt={a.name} className="aspect-square w-full rounded border-2 border-line object-cover print:h-32 print:w-auto" />
      {onDelete && (
        <button type="button" className="btn-danger no-print absolute right-1 top-1 min-h-0 min-w-0 bg-bg px-2 py-1 text-sm" onClick={onDelete} aria-label="Delete photo">
          ✕
        </button>
      )}
      <figcaption className="text-xs text-muted">{a.createdAt.slice(0, 10)}</figcaption>
    </figure>
  );
}

/** The user's own photos for a guide entry, journal entry, etc. Camera on phones; file picker elsewhere. */
export function UserPhotos({ refKey, title = 'My photos' }: { refKey: string; title?: string }) {
  const photos = usePhotos(refKey);
  return (
    <section className="space-y-2">
      <h2 className="h2">{title}</h2>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((a) => (
            <Thumb key={a.id} a={a} onDelete={() => window.confirm('Delete this photo?') && db.attachments.delete(a.id!)} />
          ))}
        </div>
      )}
      <label className="btn no-print w-full cursor-pointer">
        📷 Add photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          onChange={async (e) => {
            for (const f of Array.from(e.target.files ?? [])) await addPhoto(refKey, f);
            e.target.value = '';
          }}
        />
      </label>
    </section>
  );
}
