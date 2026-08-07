/** @type {import('tailwindcss').Config} */

export default {

  darkMode: 'class',

  content: ['./index.html', './src/**/*.{js,jsx}'],

  theme: {

    extend: {

      fontFamily: {

        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],

      },

      borderRadius: {

        DEFAULT: '12px',

        xl: '12px',

        '2xl': '12px',

      },

      letterSpacing: {

        tight: '-0.025em',

        tighter: '-0.035em',

      },

      colors: {

        brand: {

          50: '#eff6ff',

          100: '#dbeafe',

          200: '#bfdbfe',

          300: '#93c5fd',

          400: '#60a5fa',

          500: '#3b82f6',

          600: '#2563eb',

          700: '#1d4ed8',

          800: '#1e40af',

          900: '#1e3a8a',

          950: '#172554',

        },

        sidebar: {

          DEFAULT: '#0f172a',

          hover: '#1e293b',

          active: '#1e3a5f',

          border: '#1e293b',

        },

      },

      boxShadow: {

        card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',

        'card-hover': '0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',

        header: '0 1px 0 0 rgb(15 23 42 / 0.06)',

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

        'fade-in': 'fade-in 0.25s ease-out',

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

