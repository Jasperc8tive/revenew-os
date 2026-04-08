/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary: Indigo
        primary: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5', // Primary brand color
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Accent: Orange
        accent: {
          50: '#fff7ed',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#ff6b35', // Accent brand color
          700: '#ea580c',
          800: '#c2410c',
          900: '#7c2d12',
        },
        // Semantic colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#145231',
        },
        warning: {
          50: '#fefce8',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontSize: {
        // Heading scale
        'h1': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'h4': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'h5': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'h6': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        // Body scale
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        // Caption
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      spacing: {
        // 8px grid system
        0: '0',
        1: '4px',   // xs
        2: '8px',   // sm
        3: '12px',  // md-sm
        4: '16px',  // md
        5: '20px',  // md-lg
        6: '24px',  // lg
        7: '28px',  // lg-xl
        8: '32px',  // xl
        9: '36px',  // xl+
        10: '40px',  // 2xl
        12: '48px',  // 2xl+
        14: '56px',  // 3xl
        16: '64px',  // 4xl
        20: '80px',  // 5xl
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        'elevation-1': '0 2px 4px 0 rgba(0, 0, 0, 0.08)',
        'elevation-2': '0 4px 8px 0 rgba(0, 0, 0, 0.12)',
        'elevation-3': '0 8px 12px 0 rgba(0, 0, 0, 0.16)',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'base': '8px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'full': '9999px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
