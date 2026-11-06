export function Placeholder({ title, phase, items }: { title: string; phase: number; items: string[] }) {
  return (
    <div className="space-y-4">
      <h1 className="h1">{title}</h1>
      <div className="card">
        <p className="font-bold text-accent">Coming in phase {phase}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
