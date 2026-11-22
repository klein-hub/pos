import type { TextStyle, ViewStyle } from 'react-native';

/**
 * The admin app's espresso palette, so the till and the dashboard read as one
 * product. Light only, like the admin.
 */
export const colors = {
  canvas: '#f6f4f1',
  surface: '#ffffff',
  sunken: '#efebe6',
  border: 'rgba(31, 26, 22, 0.10)',
  text: '#1f1a16',
  muted: '#6b625a',
  faint: '#9a9087',

  primary: '#946231',
  primaryPressed: '#7d5228',
  primarySoft: '#f5efe8',
  primaryLine: '#e6d5c3',
  onPrimary: '#ffffff',

  // Same meanings as the admin's margin colours: good, watch, bad.
  good: '#2f855a',
  goodSoft: '#e7f4ec',
  watch: '#b7791f',
  watchSoft: '#fbf2e0',
  bad: '#c53030',
  badSoft: '#fbe9e9',

  scrim: 'rgba(20, 16, 12, 0.45)',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Prices, totals and change line up in columns. */
export const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
};

export const text = {
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
  },
} satisfies Record<string, TextStyle>;
