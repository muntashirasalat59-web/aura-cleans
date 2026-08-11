/**
 * AURA CLEAN ERP — central visual design tokens.
 * ThemeContext applies these as CSS variables on <html>.
 * Prefer var(--aura-*) / Tailwind `aura.*` — do not hardcode hex in components.
 */

/** Fixed chrome — sidebar stays dark in both light and dark content themes. */
export const AURA_SHELL = {
  sidebarFrom: '#0C4A5F',
  sidebarTo: '#135F7A',
  sidebarSection: '#6B98A0',
  sidebarNav: '#A8C9D3',
  sidebarNavHover: '#D1EAF2',
  sidebarBorder: 'rgba(168, 201, 211, 0.16)',
  sidebarActive: '#38BDF8',
  sidebarLogoutBg: '#FFFFFF',
  sidebarLogoutText: '#0C4A5F',
  /* Match primary CTA — not near-black on light header */
  quickAdd: '#38BDF8',
  quickAddHover: '#0EA5E9',
};

export const AURA_LIGHT = {
  bg: '#F8FAFC',
  sidebar: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#F1F5F9',
  border: '#E5E7EB',
  primary: '#38BDF8',
  primaryHover: '#0EA5E9',
  secondary: '#14B8A6',
  accent: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#111827',
  textSecondary: '#6B7280',
  muted: '#9CA3AF',
};

/**
 * Premium dark — forest-ink (not generic slate).
 * Layered surfaces: canvas → card → elevated, soft green hairlines.
 */
export const AURA_DARK = {
  bg: '#0A1012',
  sidebar: '#0E2530',
  card: '#121C1F',
  elevated: '#182428',
  border: 'rgba(148, 180, 200, 0.14)',
  primary: '#38BDF8',
  primaryHover: '#7DD3FC',
  secondary: '#2DD4BF',
  accent: '#7DD3FC',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  text: '#F1F5F3',
  textSecondary: '#A8B9BF',
  muted: '#7A8A8F',
};

export const AURA_RADIUS = {
  button: '12px',
  card: '16px',
  input: '12px',
  table: '16px',
  dialog: '20px',
  dropdown: '12px',
};

export const AURA_SHADOW = {
  soft: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  medium: '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
  floating: '0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
};

/** Dark shadows — depth + faint sky-blue ambient (never heavy black blobs) */
export const AURA_SHADOW_DARK = {
  soft: '0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 4px 20px rgba(0, 0, 0, 0.28)',
  medium:
    '0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.08)',
  floating:
    '0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 20px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(56, 189, 248, 0.12)',
};

/** Glass fills — same brand colors, translucent surfaces + blur */
export const AURA_GLASS_LIGHT = {
  surface: 'rgba(255, 255, 255, 0.72)',
  elevated: 'rgba(255, 255, 255, 0.88)',
  border: 'rgba(255, 255, 255, 0.55)',
  borderEdge: 'rgba(15, 23, 42, 0.08)',
  blur: '14px',
  saturate: '1.2',
};

export const AURA_GLASS_DARK = {
  surface: 'rgba(18, 28, 31, 0.62)',
  elevated: 'rgba(24, 38, 42, 0.72)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderEdge: 'rgba(56, 189, 248, 0.12)',
  blur: '16px',
  saturate: '1.35',
};

/** ERP-dense scale (Stripe/Linear-like) — readable at 100% zoom without oversized UI */
export const AURA_TYPE = {
  h1: '28px',
  h2: '22px',
  h3: '18px',
  h4: '16px',
  h5: '15px',
  bodyLg: '14px',
  body: '13px',
  caption: '11px',
};

/** Fixed shell chrome (never toggles with light/dark content theme). */
export function shellToCssVars() {
  return {
    '--aura-shell-sidebar-from': AURA_SHELL.sidebarFrom,
    '--aura-shell-sidebar-to': AURA_SHELL.sidebarTo,
    '--aura-shell-sidebar-section': AURA_SHELL.sidebarSection,
    '--aura-shell-sidebar-nav': AURA_SHELL.sidebarNav,
    '--aura-shell-sidebar-nav-hover': AURA_SHELL.sidebarNavHover,
    '--aura-shell-sidebar-border': AURA_SHELL.sidebarBorder,
    '--aura-shell-sidebar-active': AURA_SHELL.sidebarActive,
    '--aura-shell-logout-bg': AURA_SHELL.sidebarLogoutBg,
    '--aura-shell-logout-text': AURA_SHELL.sidebarLogoutText,
    '--aura-shell-quick-add': AURA_SHELL.quickAdd,
    '--aura-shell-quick-add-hover': AURA_SHELL.quickAddHover,
  };
}

/** Map token object → CSS custom properties for documentElement */
export function tokensToCssVars(palette, { dark = false } = {}) {
  const shadows = dark ? AURA_SHADOW_DARK : AURA_SHADOW;
  const glass = dark ? AURA_GLASS_DARK : AURA_GLASS_LIGHT;
  return {
    '--aura-bg': palette.bg,
    '--aura-sidebar': palette.sidebar,
    '--aura-card': palette.card,
    '--aura-elevated': palette.elevated || palette.card,
    '--aura-border': palette.border,
    '--aura-primary': palette.primary,
    '--aura-primary-hover': palette.primaryHover,
    '--aura-secondary': palette.secondary,
    '--aura-accent': palette.accent,
    '--aura-success': palette.success,
    '--aura-warning': palette.warning,
    '--aura-danger': palette.danger,
    '--aura-text': palette.text,
    '--aura-text-secondary': palette.textSecondary,
    '--aura-muted': palette.muted,
    '--aura-glass-surface': glass.surface,
    '--aura-glass-elevated': glass.elevated,
    '--aura-glass-border': glass.border,
    '--aura-glass-border-edge': glass.borderEdge,
    '--aura-glass-blur': glass.blur,
    '--aura-glass-saturate': glass.saturate,
    '--aura-radius-button': AURA_RADIUS.button,
    '--aura-radius-card': AURA_RADIUS.card,
    '--aura-radius-input': AURA_RADIUS.input,
    '--aura-radius-table': AURA_RADIUS.table,
    '--aura-radius-dialog': AURA_RADIUS.dialog,
    '--aura-radius-dropdown': AURA_RADIUS.dropdown,
    '--aura-shadow-soft': shadows.soft,
    '--aura-shadow-medium': shadows.medium,
    '--aura-shadow-floating': shadows.floating,
    '--aura-type-h1': AURA_TYPE.h1,
    '--aura-type-h2': AURA_TYPE.h2,
    '--aura-type-h3': AURA_TYPE.h3,
    '--aura-type-h4': AURA_TYPE.h4,
    '--aura-type-h5': AURA_TYPE.h5,
    '--aura-type-body-lg': AURA_TYPE.bodyLg,
    '--aura-type-body': AURA_TYPE.body,
    '--aura-type-caption': AURA_TYPE.caption,
    ...shellToCssVars(),
  };
}