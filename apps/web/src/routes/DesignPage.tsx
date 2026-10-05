import { colorTokens, priorities, incidentStatuses, themes, typeScale } from '@sentinel/shared';
import { Button } from '../components/ui/Button';
import { PriorityChip, StatusChip } from '../components/ui/Chip';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { useState } from 'react';

/** Internal review page: every token and primitive in the active theme. Not linked from the product. */
export function DesignPage() {
  const toast = useToast();
  const [on, setOn] = useState(true);
  const groups = [
    ['Surfaces', ['canvas', 'surface', 'surface-2', 'sunken', 'border', 'border-strong']],
    ['Text', ['ink', 'ink-2', 'ink-3', 'ink-disabled']],
    ['Brand', ['brand', 'brand-hover', 'brand-solid', 'brand-solid-hover', 'brand-solid-pressed', 'brand-tint']],
    ['Semantic', colorTokens.filter((t) => /^(critical|high|medium|low|success)/.test(t))],
  ] as const;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-8 py-8">
        <header>
          <h1 className="font-display text-title-xl font-semibold text-ink">Design review</h1>
          <p className="mt-1 max-w-[60ch] text-md text-ink-2">
            Every token and primitive in the current theme. Use the moon icon in the top bar to compare light and dark.
          </p>
        </header>

        <section aria-labelledby="d-color" className="grid gap-4">
          <h2 id="d-color" className="font-display text-title-md font-semibold text-ink">Colour</h2>
          {groups.map(([name, tokens]) => (
            <div key={name}>
              <h3 className="mb-2 text-sm font-semibold text-ink-2">{name}</h3>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {tokens.map((t) => (
                  <li key={t} className="overflow-hidden rounded-panel border border-border bg-surface">
                    <span className="block h-12 border-b border-border" style={{ background: `var(--${t})` }} />
                    <span className="block px-3 py-2">
                      <span className="block text-sm font-medium text-ink">{t}</span>
                      <span className="block text-xs text-ink-3">{themes.light[t as keyof typeof themes.light]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="d-type" className="grid gap-3">
          <h2 id="d-type" className="font-display text-title-md font-semibold text-ink">Type</h2>
          <div className="divide-y divide-border rounded-panel border border-border bg-surface px-5">
            {Object.entries(typeScale).map(([name, [size, line]]) => (
              <div key={name} className="grid grid-cols-[140px_1fr] items-baseline gap-4 py-3">
                <span className="text-xs text-ink-3">{name} {size}/{line}</span>
                <span
                  className={name.startsWith('title') || name === 'figure' ? 'font-display font-semibold text-ink' : 'text-ink'}
                  style={{ fontSize: size, lineHeight: `${line}px` }}
                >
                  {name === 'figure' ? '42 open, 6 h 20' : 'Water leak in corridor B3'}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[140px_1fr] items-baseline gap-4 py-3">
              <span className="text-xs text-ink-3">tabular figures</span>
              <span className="text-base text-ink" data-testid="tnum">
                <span className="block">1,111 and 1:11</span>
                <span className="block">8,888 and 8:88</span>
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="d-chips" className="grid gap-3">
          <h2 id="d-chips" className="font-display text-title-md font-semibold text-ink">Priority and status</h2>
          <div className="grid gap-3 rounded-panel border border-border bg-surface p-5">
            <div className="flex flex-wrap gap-2">
              {[...priorities].reverse().map((p) => <PriorityChip key={p} priority={p} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              {incidentStatuses.map((s) => <StatusChip key={s} status={s} />)}
              <StatusChip status="ASSIGNED" live />
            </div>
          </div>
        </section>

        <section aria-labelledby="d-controls" className="grid gap-3">
          <h2 id="d-controls" className="font-display text-title-md font-semibold text-ink">Controls</h2>
          <div className="grid gap-5 rounded-panel border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Assign</Button>
              <Button variant="secondary">Save changes</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Revoke</Button>
              <Button variant="primary" disabled>Assign</Button>
              <Button variant="primary" loading>Assigning</Button>
              <Button variant="primary" size="lg">Accept</Button>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Switch checked={on} onCheckedChange={setOn} label="Show internal notes" />
              <Button variant="secondary" onClick={() => toast({ message: 'Assigned to Karim B.', actionLabel: 'Undo' })}>
                Show a toast
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
