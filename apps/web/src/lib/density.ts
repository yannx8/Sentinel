import { useCallback, useState } from 'react';

export type Density = 'compact' | 'default' | 'comfortable';
export const densities: Density[] = ['compact', 'default', 'comfortable'];
const KEY = 'sentinel.density';

function read(): Density {
  try {
    const saved = localStorage.getItem(KEY);
    return densities.find((d) => d === saved) ?? 'default';
  } catch {
    return 'default';
  }
}

/** Row density for dense lists, remembered per browser. */
export function useDensity() {
  const [density, setState] = useState<Density>(read);
  const setDensity = useCallback((next: Density) => {
    setState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }, []);
  return [density, setDensity] as const;
}
