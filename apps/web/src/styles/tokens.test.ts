import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * WCAG 2.2 contrast for every text and glyph pairing in both themes.
 * Text needs 4.5:1, glyphs and meaningful UI parts 3:1 (1.4.3 and 1.4.11).
 */

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1] as string, m[2] as string]),
  );
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(':root');
const dark = { ...light, ...block(":root[data-theme='dark']") };

const text = ['ink', 'ink-2', 'ink-3', 'accent', 'critical-ink', 'high-ink', 'medium-ink', 'low-ink', 'success-ink'];
const glyphs = ['critical', 'high', 'medium', 'low', 'success', 'accent'];
const backgrounds = ['bg', 'surface', 'subtle'];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, theme) => {
  it.each(text.flatMap((fg) => backgrounds.map((bg) => [fg, bg] as const)))(
    '%s text on %s is at least 4.5:1',
    (fg, bg) => {
      expect(ratio(theme[fg] as string, theme[bg] as string)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(glyphs.flatMap((fg) => backgrounds.map((bg) => [fg, bg] as const)))(
    '%s glyph on %s is at least 3:1',
    (fg, bg) => {
      expect(ratio(theme[fg] as string, theme[bg] as string)).toBeGreaterThanOrEqual(3);
    },
  );

  it('primary buttons are readable', () => {
    expect(ratio(theme['primary'] as string, theme['on-primary'] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('semantic text stays readable on its own tint', () => {
    for (const tone of ['critical', 'high', 'medium', 'low', 'success']) {
      expect(ratio(theme[`${tone}-ink`] as string, theme[`${tone}-subtle`] as string)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(theme['accent'] as string, theme['accent-subtle'] as string)).toBeGreaterThanOrEqual(4.5);
  });
});
