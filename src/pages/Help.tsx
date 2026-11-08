import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui';
import { PrintButton, PrintHeader } from '../components/PrintButton';

const STEPS: [string, string[]][] = [
  ['1. Install it', ['Open the site once with signal and wait for "Saved for offline use".', 'Android Chrome: menu ⋮ → Install app / Add to Home screen. iPhone Safari: Share → Add to Home Screen.', 'Settings → Protect my data, so the phone does not clear it when storage runs low.']],
  ['2. Set up', ['Prep → Location: GPS, postal code or nearest town. Edit any value you know better.', 'Prep → Household: people, pets, duration, budget, storage, heat and cooking fuel.', 'Every list (food, water, seeds, supplies, hunting) updates automatically.']],
  ['3. Print paper backups', ['Every list and guide page has Print / PDF. Choose "Save as PDF" in the print dialog, or print directly.', 'Field guide → Print whole guide makes a complete book with one entry per page.', 'Keep a printed copy in a dry bag with your kit.']],
  ['4. Track stock', ['Stock → Add to stock: link each item to a list target, enter amount and best-before date.', 'Use this month shows what to eat or rotate next; FIFO tells you which lot to use first.']],
  ['5. Offline maps', ['With signal: Journal → Map, zoom to your area, tap "Save this area for offline". Repeat for each area you need.', 'Pins, GPS and saved areas work with no signal. Export GPX to share pins with other GPS apps.']],
  ['6. Journal and caches', ['Log finds, water sources, harvests and hunts with GPS, weather and photos.', 'Cache entries can be locked with a PIN. Forget the PIN and the location is gone.']],
  ['7. Back up', ['Settings → Save backup file. Copy it off the phone (USB, computer, another phone) monthly.', 'Restore on any device from Settings → Restore from file.']],
  ['8. Night use', ['Tap the moon/eye button at the top to switch to red Night mode, which protects your night vision.']],
];

export function HelpPage() {
  return (
    <div className="space-y-4">
      <BackLink to="/settings" label="Settings" />
      <PrintHeader title="How to use NorthPrep" />
      <h1 className="h1">How to use NorthPrep</h1>
      {STEPS.map(([title, items]) => (
        <section key={title} className="card">
          <h2 className="h2">{title}</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <p className="text-sm text-muted">
        Legal labels and some climate values need your verification. Field guide content is a memory aid, not training: take a first aid and survival course. <Link to="/guide" className="underline">Field guide</Link>
      </p>
      <PrintButton />
    </div>
  );
}
