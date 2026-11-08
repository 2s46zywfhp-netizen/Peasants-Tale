import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/** Shrinks a camera photo to at most `max` px on the long side as JPEG, to keep storage and backups small. */
export async function resizeImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

export async function addPhoto(ref: string, file: File): Promise<number> {
  const blob = await resizeImage(file);
  return db.attachments.add({ name: file.name || 'photo.jpg', type: blob.type || 'image/jpeg', blob, ref, createdAt: new Date().toISOString() });
}

export function usePhotos(ref: string) {
  return useLiveQuery(() => db.attachments.where('ref').equals(ref).toArray(), [ref]) ?? [];
}

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
