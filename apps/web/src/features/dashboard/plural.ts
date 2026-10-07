import { useCallback } from 'react';
import { useT, type TKey } from '../../i18n';

/** Distributes over the key union (a bare alias in a conditional type does not). */
type Base<K> = K extends `${infer B}One` ? B : never;
export type PluralBase = Base<TKey>;

/**
 * Same contract as `tn` from useT: picks `${key}One` or `${key}Other` and passes {count}.
 * Local stand-in while the shared PluralKey type resolves to never.
 */
export function usePlural() {
  const { t, number } = useT();
  return useCallback(
    (key: PluralBase, count: number, vars?: Record<string, string | number>) =>
      t(`${key}${count === 1 ? 'One' : 'Other'}` as TKey, { count: number(count), ...vars }),
    [t, number],
  );
}
