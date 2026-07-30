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

        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',

        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',

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

      },

      animation: {

        'fade-in': 'fade-in 0.25s ease-out',

        'scale-in': 'scale-in 0.2s ease-out',

      },

    },

  },

  plugins: [],

};

