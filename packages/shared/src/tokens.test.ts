import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastPairs, contrastRatio, themes, toCss, type ThemeName } from './tokens';

const names: ThemeName[] = ['light', 'dark'];

describe.each(names)('%s theme contrast', (name) => {
  const theme = themes[name] as Record<string, string>;
  it.each(contrastPairs.map((p) => [p.label, p] as const))('%s', (_label, p) => {
    const ratio = contrastRatio(theme[p.fg] as string, theme[p.bg] as string);
    expect(ratio).toBeGreaterThanOrEqual(p.min);
  });
});

describe('tokens', () => {
  it('defines the same keys in both themes', () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it('keeps src/tokens.css in sync with tokens.ts (run `pnpm --filter @sentinel/shared tokens:build`)', () => {
    const onDisk = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    // Git may check files out with CRLF on Windows, so compare line-ending-insensitively.
    expect(onDisk.replace(/
/g, '
')).toBe(toCss());
  });
});
