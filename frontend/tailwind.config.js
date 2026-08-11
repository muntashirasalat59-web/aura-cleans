/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '12px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      letterSpacing: {
        tight: '-0.01em',
        tighter: '-0.01em',
      },
      spacing: {
        4.5: '18px',
      },
      colors: {
        aura: {
          bg: 'var(--aura-bg)',
          sidebar: 'var(--aura-sidebar)',
          card: 'var(--aura-card)',
          elevated: 'var(--aura-elevated)',
          border: 'var(--aura-border)',
          primary: 'var(--aura-primary)',
          'primary-hover': 'var(--aura-primary-hover)',
          secondary: 'var(--aura-secondary)',
          accent: 'var(--aura-accent)',
          success: 'var(--aura-success)',
          warning: 'var(--aura-warning)',
          danger: 'var(--aura-danger)',
          text: 'var(--aura-text)',
          'text-secondary': 'var(--aura-text-secondary)',
          muted: 'var(--aura-muted)',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        sidebar: {
          DEFAULT: 'var(--aura-sidebar)',
          hover: 'color-mix(in srgb, var(--aura-sidebar) 92%, var(--aura-text) 8%)',
          active: 'color-mix(in srgb, var(--aura-primary) 18%, var(--aura-sidebar))',
          border: 'var(--aura-border)',
        },
      },
      boxShadow: {
        soft: 'var(--aura-shadow-soft)',
        medium: 'var(--aura-shadow-medium)',
        floating: 'var(--aura-shadow-floating)',
        card: 'var(--aura-shadow-soft)',
        'card-hover': 'var(--aura-shadow-medium)',
        header: '0 1px 0 0 var(--aura-border)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'login-blob': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(14px, -10px) scale(1.03)' },
          '66%': { transform: 'translate(-10px, 8px) scale(0.98)' },
        },
        'login-blob-alt': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-12px, 16px) scale(1.04)' },
        },
        'login-blob-breathe': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.85' },
          '50%': { transform: 'translate(8px, -12px) scale(1.05)', opacity: '1' },
        },
        'login-mesh-breathe': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.88' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'login-blob': 'login-blob 12s ease-in-out infinite',
        'login-blob-slow': 'login-blob-alt 15s ease-in-out infinite',
        'login-blob-drift': 'login-blob-breathe 10s ease-in-out infinite',
        'login-mesh-breathe': 'login-mesh-breathe 14s ease-in-out infinite',
        'login-glow-pulse': 'login-glow-pulse 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
