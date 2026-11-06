import { IconPrint } from './Icons';

/**
 * Opens the system print dialog; "Save as PDF" there makes the paper backup.
 * Print styles (styles/index.css) strip app chrome and force black on white.
 */
export function PrintButton({ label = 'Print / PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      <IconPrint /> {label}
    </button>
  );
}

/** Title block that appears only on paper. */
export function PrintHeader({ title }: { title: string }) {
  return (
    <div className="print-only mb-4 border-b-2 border-black pb-2">
      <div className="text-2xl font-extrabold">{title}</div>
      <div className="text-sm">NorthPrep — printed {new Date().toLocaleDateString('en-CA')}</div>
    </div>
  );
}
