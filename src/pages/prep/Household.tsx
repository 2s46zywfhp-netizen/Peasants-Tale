import { DURATIONS, type AgeBand, type Plan, type Person, type Pet } from '../../calc/plan';
import { personKcal } from '../../calc/food';
import { energyNeeds, fuels } from '../../calc/ref';
import { savePlan, usePlan } from '../../lib/store';
import { BackLink, Chips, Field, NumberInput, Select, Toggle } from '../../components/ui';

const uid = () => Math.random().toString(36).slice(2, 9);

export function HouseholdPage() {
  const { plan, loading } = usePlan();
  if (loading) return null;
  const set = (patch: Partial<Plan>) => void savePlan({ ...plan, ...patch });
  const setPerson = (id: string, patch: Partial<Person>) => set({ people: plan.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const setPet = (id: string, patch: Partial<Pet>) => set({ pets: plan.pets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <div className="space-y-4">
      <BackLink />
      <h1 className="h1">Household &amp; plan</h1>
      <p className="text-muted">Changes save automatically.</p>

      <section className="card space-y-3">
        <h2 className="h2">People ({plan.people.length})</h2>
        {plan.people.map((p, i) => (
          <div key={p.id} className="space-y-2 rounded-lg border-2 border-line p-3">
            <div className="flex gap-2">
              <input className="field" aria-label={`Person ${i + 1} name`} value={p.name} onChange={(e) => setPerson(p.id, { name: e.target.value })} />
              <button type="button" className="btn-danger" aria-label={`Remove ${p.name}`} onClick={() => set({ people: plan.people.filter((x) => x.id !== p.id) })}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Age" value={p.age} onChange={(v) => setPerson(p.id, { age: v as AgeBand })} options={energyNeeds.map((e) => ({ value: e.id, label: e.label }))} />
              <Select label="Sex" value={p.sex} onChange={(v) => setPerson(p.id, { sex: v })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            </div>
            <Chips label="Activity" value={p.activity} onChange={(v) => setPerson(p.id, { activity: v })} options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }]} />
            <Field label="Daily kcal" hint={`Calculated: ${personKcal({ ...p, kcalOverride: undefined }, plan)} kcal/day. Enter a number to override (e.g. pregnancy, illness).`}>
              <input
                className="field"
                inputMode="numeric"
                placeholder="auto"
                value={p.kcalOverride ?? ''}
                onChange={(e) => setPerson(p.id, { kcalOverride: e.target.value ? Number(e.target.value) || undefined : undefined })}
              />
            </Field>
          </div>
        ))}
        <button type="button" className="btn w-full" onClick={() => set({ people: [...plan.people, { id: uid(), name: `Person ${plan.people.length + 1}`, age: 'adult19-50', sex: 'female', activity: 'moderate' }] })}>
          + Add person
        </button>
        <Toggle checked={plan.coldLabour} onChange={(v) => set({ coldLabour: v })} label="Heavy cold-weather labour (+25 % calories)" hint="Cutting wood, hauling water, snowshoeing in winter." />
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Pets ({plan.pets.length})</h2>
        {plan.pets.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border-2 border-line p-3">
            <input className="field" aria-label="Pet name" value={p.name} onChange={(e) => setPet(p.id, { name: e.target.value })} />
            <button type="button" className="btn-danger" aria-label={`Remove ${p.name}`} onClick={() => set({ pets: plan.pets.filter((x) => x.id !== p.id) })}>
              ✕
            </button>
            <Select label="Species" value={p.species} onChange={(v) => setPet(p.id, { species: v })} options={[{ value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'other', label: 'Other' }]} />
            <NumberInput label="Weight" value={p.weightKg} min={0.1} step={0.5} onChange={(n) => setPet(p.id, { weightKg: n })} suffix="kg" />
          </div>
        ))}
        <button type="button" className="btn w-full" onClick={() => set({ pets: [...plan.pets, { id: uid(), name: 'Dog', species: 'dog', weightKg: 25 }] })}>
          + Add pet
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Duration</h2>
        <Chips label="Duration" value={plan.durationPreset} onChange={(v) => set({ durationPreset: v })} options={DURATIONS.map((d) => ({ value: d.id, label: d.label }))} />
        {plan.durationPreset === 'custom' && <NumberInput label="Custom days" value={plan.customDays} min={1} onChange={(n) => set({ customDays: n })} suffix="days" />}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Budget &amp; storage</h2>
        <Field label="Budget">
          <Chips label="Budget" value={plan.budget} onChange={(v) => set({ budget: v })} options={[{ value: 'budget', label: 'Budget' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }]} />
        </Field>
        <Field label="Where food and water are stored">
          <Select
            label="Storage location"
            value={plan.storageLocation}
            onChange={(v) => set({ storageLocation: v })}
            options={[
              { value: 'heated', label: 'Heated living space' },
              { value: 'basement', label: 'Basement (stays above 0 °C)' },
              { value: 'cold-room', label: 'Cold room / root cellar' },
              { value: 'unheated', label: 'Unheated garage / shed / cabin' },
            ]}
          />
        </Field>
        <Field label="Storage floor space">
          <NumberInput label="Storage floor space" value={plan.storageFloorM2} min={0} step={0.5} onChange={(n) => set({ storageFloorM2: n })} suffix="m²" />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Heat &amp; cooking</h2>
        <Field label="Main heat source">
          <Select label="Heat source" value={plan.heatSource} onChange={(v) => set({ heatSource: v })} options={fuels.filter((f) => f.heatingEff > 0).map((f) => ({ value: f.id as Plan['heatSource'], label: f.name }))} />
        </Field>
        <Field label="Cooking / boiling fuel (grid-down)">
          <Select label="Cooking fuel" value={plan.cookFuel} onChange={(v) => set({ cookFuel: v })} options={fuels.filter((f) => f.cookingEff > 0).map((f) => ({ value: f.id as Plan['cookFuel'], label: f.name }))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Heated area">
            <NumberInput label="Heated area" value={plan.heatedAreaM2} min={5} step={5} onChange={(n) => set({ heatedAreaM2: n })} suffix="m²" />
          </Field>
          <Field label="Insulation">
            <Select label="Insulation" value={plan.insulation} onChange={(v) => set({ insulation: v })} options={[{ value: 'poor', label: 'Poor / old' }, { value: 'average', label: 'Average' }, { value: 'good', label: 'Good / new' }]} />
          </Field>
        </div>
        <p className="text-sm text-muted">Tip: grid-down, heat one or two rooms. Enter that smaller area to see the difference in firewood.</p>
      </section>

      <section className="card space-y-1">
        <h2 className="h2">Optional modules</h2>
        <Toggle checked={plan.huntingEnabled} onChange={(v) => set({ huntingEnabled: v })} label="Hunting, fishing, firearms & defence" hint="Adds the module to your prep lists." />
        {plan.huntingEnabled && (
          <Toggle
            checked={plan.collapseMode}
            onChange={(v) => set({ collapseMode: v })}
            label="Collapse Mode"
            hint="Ranks by survival use only, ignoring legal class and seasons, and adds harvest-sustainability notes. Legal labels stay visible."
          />
        )}
      </section>
    </div>
  );
}
