/**
 * Design tokens, the single source of truth for web and mobile.
 * Values mirror docs/DESIGN_SYSTEM.md section 2. `toCss()` generates
 * src/tokens.css, and tokens.test.ts asserts contrast for every pairing.
 */

export type ThemeName = 'light' | 'dark';

export const themes = {
  light: {
    canvas: '#F3F5F9',
    surface: '#FFFFFF',
    'surface-2': '#F8F9FC',
    sunken: '#E9EDF4',
    border: '#DCE1EA',
    'border-strong': '#7F8AA3',
    ink: '#0E1A33',
    'ink-2': '#3A4660',
    'ink-3': '#5B6784',
    'ink-disabled': '#9AA3B8',
    brand: '#2B44C6',
    'brand-hover': '#1F34A0',
    'brand-solid': '#2B44C6',
    'brand-solid-hover': '#1F34A0',
    'brand-solid-pressed': '#182A82',
    'brand-tint': '#E8ECFB',
    'on-brand': '#FFFFFF',
    critical: '#C0262D',
    'critical-tint': '#FDECEC',
    'critical-ink': '#A3141B',
    high: '#C2540A',
    'high-tint': '#FDEFE2',
    'high-ink': '#9A4300',
    medium: '#946B00',
    'medium-tint': '#FAF1D6',
    'medium-ink': '#7A5800',
    low: '#52627A',
    'low-tint': '#E9EEF5',
    'low-ink': '#3F4E66',
    success: '#11704A',
    'success-tint': '#E2F4EA',
    'success-ink': '#0B5A3A',
    scrim: 'rgba(14, 26, 51, 0.40)',
    'shadow-1': '0 1px 2px rgba(14, 26, 51, 0.06), 0 8px 24px rgba(14, 26, 51, 0.10)',
    'shadow-2': '0 2px 4px rgba(14, 26, 51, 0.06), 0 24px 56px rgba(14, 26, 51, 0.20)',
  },
  dark: {
    canvas: '#0D1424',
    surface: '#141C2F',
    'surface-2': '#1A2339',
    sunken: '#0A101D',
    border: '#26314A',
    'border-strong': '#5A6A8C',
    ink: '#E8ECF6',
    'ink-2': '#B4BDD2',
    'ink-3': '#8D98B3',
    'ink-disabled': '#5A6685',
    brand: '#9BADFF',
    'brand-hover': '#B5C2FF',
    'brand-solid': '#4A62E0',
    'brand-solid-hover': '#3F57D6',
    'brand-solid-pressed': '#3448BC',
    'brand-tint': '#1B2550',
    'on-brand': '#FFFFFF',
    critical: '#FF8F94',
    'critical-tint': '#3A1A21',
    'critical-ink': '#FF8F94',
    high: '#FFA562',
    'high-tint': '#3A2616',
    'high-ink': '#FFA562',
    medium: '#E6BE55',
    'medium-tint': '#35290E',
    'medium-ink': '#E6BE55',
    low: '#A9B7CE',
    'low-tint': '#222C3E',
    'low-ink': '#A9B7CE',
    success: '#5CD39B',
    'success-tint': '#12301F',
    'success-ink': '#5CD39B',
    scrim: 'rgba(0, 0, 0, 0.60)',
    'shadow-1': '0 1px 2px rgba(0, 0, 0, 0.30), 0 8px 24px rgba(0, 0, 0, 0.40)',
    'shadow-2': '0 2px 4px rgba(0, 0, 0, 0.30), 0 24px 56px rgba(0, 0, 0, 0.55)',
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type ColorToken = keyof (typeof themes)['light'];

/** Tokens that are real colours (the rest are shadows). Used for the Tailwind mapping. */
export const colorTokens = (Object.keys(themes.light) as ColorToken[]).filter(
  (k) => !k.startsWith('shadow-'),
);

export const fonts = {
  ui: '"Atkinson Hyperlegible Next", "Segoe UI", system-ui, sans-serif',
  display: '"Bricolage Grotesque Variable", "Segoe UI", system-ui, sans-serif',
} as const;

/** size / line-height in px. `title-*` and `figure` use the display face. */
export const typeScale = {
  xs: [12, 16],
  sm: [13, 20],
  base: [14, 20],
  md: [16, 24],
  lg: [18, 26],
  'title-md': [20, 26],
  'title-lg': [24, 30],
  'title-xl': [32, 38],
  figure: [36, 40],
} as const;

export const radius = { control: 8, panel: 12, sheet: 16, pill: 9999 } as const;

export const motion = {
  easeOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  durPress: 90,
  durSmall: 140,
  durOverlay: 200,
  durSwap: 280,
} as const;

export const layout = {
  railExpanded: 232,
  railCollapsed: 64,
  topBar: 52,
  caseFileMin: 520,
  caseFileMax: 640,
  breakpoints: { sm: 640, md: 1024, lg: 1280, xl: 1536 },
} as const;

/**
 * Pairs that must meet WCAG contrast in every theme.
 * min 4.5 for text, 3 for meaningful UI (borders of controls, glyphs).
 */
export const contrastPairs: ReadonlyArray<{
  fg: ColorToken;
  bg: ColorToken;
  min: 3 | 4.5;
  label: string;
}> = [
  { fg: 'ink', bg: 'surface', min: 4.5, label: 'primary text on surface' },
  { fg: 'ink', bg: 'canvas', min: 4.5, label: 'primary text on canvas' },
  { fg: 'ink-2', bg: 'surface', min: 4.5, label: 'secondary text on surface' },
  { fg: 'ink-2', bg: 'sunken', min: 4.5, label: 'secondary text on sunken' },
  { fg: 'ink-3', bg: 'surface', min: 4.5, label: 'metadata on surface' },
  { fg: 'ink-3', bg: 'canvas', min: 4.5, label: 'metadata on canvas' },
  { fg: 'ink-3', bg: 'surface-2', min: 4.5, label: 'metadata on surface-2' },
  { fg: 'brand', bg: 'surface', min: 4.5, label: 'brand text on surface' },
  { fg: 'brand', bg: 'brand-tint', min: 4.5, label: 'brand text on tint' },
  { fg: 'on-brand', bg: 'brand-solid', min: 4.5, label: 'label on primary button' },
  { fg: 'on-brand', bg: 'brand-solid-hover', min: 4.5, label: 'label on primary hover' },
  { fg: 'on-brand', bg: 'brand-solid-pressed', min: 4.5, label: 'label on primary pressed' },
  { fg: 'border-strong', bg: 'surface', min: 3, label: 'control outline on surface' },
  ...(['critical', 'high', 'medium', 'low', 'success'] as const).flatMap((k) => [
    { fg: k, bg: 'surface' as const, min: 4.5 as const, label: `${k} on surface` },
    { fg: `${k}-ink` as ColorToken, bg: `${k}-tint` as ColorToken, min: 4.5 as const, label: `${k} ink on tint` },
    { fg: k, bg: `${k}-tint` as ColorToken, min: 3 as const, label: `${k} glyph on tint` },
  ]),
];

const cssVars = (theme: Record<string, string>) =>
  Object.entries(theme)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');

/** Generates src/tokens.css: runtime variables per theme plus the Tailwind v4 `@theme` mapping. */
export function toCss(): string {
  const colorMap = colorTokens.map((k) => `  --color-${k}: var(--${k});`).join('\n');
  const type = Object.entries(typeScale)
    .map(([k, [size, line]]) => `  --text-${k}: ${size / 16}rem;\n  --text-${k}--line-height: ${line / size};`)
    .join('\n');
  const radii = Object.entries(radius)
    .map(([k, v]) => `  --radius-${k}: ${v}px;`)
    .join('\n');

  return `/* Generated by scripts/build-tokens.ts from src/tokens.ts. Do not edit by hand. */

:root,
[data-theme='light'] {
  color-scheme: light;
${cssVars(themes.light)}
}

[data-theme='dark'] {
  color-scheme: dark;
${cssVars(themes.dark)}
}

:root {
  --ease-out: ${motion.easeOut};
  --ease-in-out: ${motion.easeInOut};
  --dur-press: ${motion.durPress}ms;
  --dur-small: ${motion.durSmall}ms;
  --dur-overlay: ${motion.durOverlay}ms;
  --dur-swap: ${motion.durSwap}ms;
}

/* Theme-aware colours and shadows resolve through the variables above. */
@theme inline {
  --color-*: initial;
${colorMap}
  --shadow-*: initial;
  --shadow-1: var(--shadow-1);
  --shadow-2: var(--shadow-2);
}

@theme {
  --font-sans: ${fonts.ui};
  --font-display: ${fonts.display};
  --text-*: initial;
${type}
  --radius-*: initial;
${radii}
  --ease-out: ${motion.easeOut};
  --ease-in-out: ${motion.easeInOut};
  --breakpoint-*: initial;
${Object.entries(layout.breakpoints)
  .map(([k, v]) => `  --breakpoint-${k}: ${v}px;`)
  .join('\n')}
}
`;
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
