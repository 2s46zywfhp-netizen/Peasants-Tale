import { useEffect, useRef, useState } from 'react';

interface Detector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
declare global {
  interface Window { BarcodeDetector?: new (opts?: { formats?: string[] }) => Detector }
}

export const barcodeSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

/** Looks up a product name online (Open Food Facts). Returns null offline or on failure. */
export async function lookupBarcode(code: string): Promise<{ name: string; detail: string } | null> {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== 1 || !j.product?.product_name) return null;
    return { name: j.product.product_name, detail: [j.product.brands, j.product.quantity].filter(Boolean).join(' · ') };
  } catch {
    return null;
  }
}

export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        while (!stop) {
          const codes = await det.detect(video.current).catch(() => []);
          if (codes[0]) {
            onCode(codes[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <div className="space-y-2 rounded-lg border-2 border-accent p-2">
      <video ref={video} className="w-full rounded" muted playsInline />
      {err && <p className="text-danger">Camera error: {err}</p>}
      <button type="button" className="btn w-full" onClick={onClose}>
        Cancel scan
      </button>
    </div>
  );
}
