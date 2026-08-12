/**
 * AURA CLEAN ERP — central visual design tokens.
 * ThemeContext applies these as CSS variables on <html>.
 * Prefer var(--aura-*) / Tailwind `aura.*` — do not hardcode hex in components.
 */

/** Night-mode chrome — keep these values unchanged. */
export const AURA_SHELL_DARK = {
  sidebarFrom: '#0B1220',
  sidebarTo: '#111827',
  sidebarSection: '#64748B',
  sidebarNav: '#94A3B8',
  sidebarNavHover: '#F8FAFC',
  sidebarBorder: 'rgba(255, 255, 255, 0.08)',
  sidebarHoverBg: 'rgba(255, 255, 255, 0.06)',
  sidebarActive: '#2563EB',
  sidebarLogoutBg: '#FFFFFF',
  sidebarLogoutText: '#0B1220',
  tooltipText: '#F8FAFC',
  sidebarShadow: 'none',
  quickAdd: '#2563EB',
  quickAddHover: '#1D4ED8',
};

/** Day-mode chrome — white/slate sidebar that matches the light dashboard. */
export const AURA_SHELL_LIGHT = {
  sidebarFrom: '#FFFFFF',
  sidebarTo: '#F8FAFC',
  sidebarSection: '#94A3B8',
  sidebarNav: '#475569',
  sidebarNavHover: '#0F172A',
  sidebarBorder: 'rgba(15, 23, 42, 0.08)',
  sidebarHoverBg: 'rgba(37, 99, 235, 0.08)',
  sidebarActive: '#2563EB',
  sidebarLogoutBg: '#0B1220',
  sidebarLogoutText: '#FFFFFF',
  tooltipText: '#0F172A',
  sidebarShadow: '4px 0 24px rgba(15, 23, 42, 0.05)',
  quickAdd: '#2563EB',
  quickAddHover: '#1D4ED8',
};

/** @deprecated Use AURA_SHELL_DARK / AURA_SHELL_LIGHT — alias kept for night-mode values. */
export const AURA_SHELL = AURA_SHELL_DARK;

/**
 * Light content theme — brand blues/purples on light surfaces.
 */
export const AURA_LIGHT = {
  bg: '#F8FAFC',
  sidebar: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#F1F5F9',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  secondary: '#7C3AED',
  accent: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  text: '#0F172A',
  textSecondary: '#64748B',
  muted: '#94A3B8',
};

/**
 * Dark content theme — design-system palette.
 */
export const AURA_DARK = {
  bg: '#0B1220',
  sidebar: '#111827',
  surface: '#111827',
  card: '#1A2235',
  elevated: '#1F2A40',
  border: 'rgba(255, 255, 255, 0.08)',
  primary: '#2563EB',
  primaryHover: '#3B82F6',
  secondary: '#7C3AED',
  accent: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  muted: '#64748B',
};

/** small 10 · medium 16 · large 20 · extra 28 */
export const AURA_RADIUS = {
  small: '10px',
  medium: '16px',
  large: '20px',
  extra: '28px',
  button: '10px',
  card: '16px',
  input: '10px',
  table: '16px',
  dialog: '20px',
  dropdown: '10px',
};

/** Soft floating shadows — subtle depth, no harsh blobs */
export const AURA_SHADOW = {
  soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  medium: '0 4px 12px rgba(15, 23, 42, 0.08), 0 12px 28px rgba(37, 99, 235, 0.06)',
  floating: '0 8px 24px rgba(15, 23, 42, 0.1), 0 20px 48px rgba(37, 99, 235, 0.08)',
};

export const AURA_SHADOW_DARK = {
  soft: '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 4px 18px rgba(0, 0, 0, 0.28)',
  medium:
    '0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 8px 28px rgba(0, 0, 0, 0.36), 0 0 0 1px rgba(37, 99, 235, 0.12)',
  floating:
    '0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(124, 58, 237, 0.1)',
};

export const AURA_GLASS_LIGHT = {
  surface: 'rgba(255, 255, 255, 0.78)',
  elevated: 'rgba(255, 255, 255, 0.92)',
  border: 'rgba(255, 255, 255, 0.6)',
  borderEdge: 'rgba(15, 23, 42, 0.08)',
  blur: '14px',
  saturate: '1.2',
};

export const AURA_GLASS_DARK = {
  surface: 'rgba(26, 34, 53, 0.72)',
  elevated: 'rgba(31, 42, 64, 0.82)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderEdge: 'rgba(255, 255, 255, 0.08)',
  blur: '16px',
  saturate: '1.25',
};

/** ERP-dense type scale */
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

/** 8-point spacing scale (px) */
export const AURA_SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

/** Shell chrome follows day/night — night values stay the original dark navy. */
export function shellToCssVars(dark = false) {
  const shell = dark ? AURA_SHELL_DARK : AURA_SHELL_LIGHT;
  return {
    '--aura-shell-sidebar-from': shell.sidebarFrom,
    '--aura-shell-sidebar-to': shell.sidebarTo,
    '--aura-shell-sidebar-section': shell.sidebarSection,
    '--aura-shell-sidebar-nav': shell.sidebarNav,
    '--aura-shell-sidebar-nav-hover': shell.sidebarNavHover,
    '--aura-shell-sidebar-border': shell.sidebarBorder,
    '--aura-shell-sidebar-hover-bg': shell.sidebarHoverBg,
    '--aura-shell-sidebar-active': shell.sidebarActive,
    '--aura-shell-sidebar-shadow': shell.sidebarShadow,
    '--aura-shell-logout-bg': shell.sidebarLogoutBg,
    '--aura-shell-logout-text': shell.sidebarLogoutText,
    '--aura-shell-tooltip-text': shell.tooltipText,
    '--aura-shell-quick-add': shell.quickAdd,
    '--aura-shell-quick-add-hover': shell.quickAddHover,
  };
}

/** Map token object → CSS custom properties for documentElement */
export function tokensToCssVars(palette, { dark = false } = {}) {
  const shadows = dark ? AURA_SHADOW_DARK : AURA_SHADOW;
  const glass = dark ? AURA_GLASS_DARK : AURA_GLASS_LIGHT;
  return {
    '--aura-bg': palette.bg,
    '--aura-sidebar': palette.sidebar,
    '--aura-surface': palette.surface || palette.card,
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
    '--aura-info': palette.info || '#06B6D4',
    '--aura-text': palette.text,
    '--aura-text-secondary': palette.textSecondary,
    '--aura-muted': palette.muted,
    '--aura-glass-surface': glass.surface,
    '--aura-glass-elevated': glass.elevated,
    '--aura-glass-border': glass.border,
    '--aura-glass-border-edge': glass.borderEdge,
    '--aura-glass-blur': glass.blur,
    '--aura-glass-saturate': glass.saturate,
    '--aura-radius-small': AURA_RADIUS.small,
    '--aura-radius-medium': AURA_RADIUS.medium,
    '--aura-radius-large': AURA_RADIUS.large,
    '--aura-radius-extra': AURA_RADIUS.extra,
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
    ...shellToCssVars(dark),
  };
}
