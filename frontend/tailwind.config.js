import typography from '@tailwindcss/typography'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // "night desk": ink surfaces + a warm lamp accent
        ink: { 950: '#07080d', 900: '#0b0d13', 800: '#12151e', 700: '#1a1e2b', 600: '#252a3a' },
        brand: { 300: '#ffd89a', 400: '#ffc46b', 500: '#f6ac3c', 600: '#e0922a', 700: '#b87318' },
        violet: { 400: '#ffa866', 500: '#f58a3a', 600: '#e06f22' }, // old gradients (brand -> violet) now read amber -> orange
      },
      boxShadow: { glow: '0 0 0 1px rgba(246,172,60,.28), 0 10px 30px -10px rgba(246,172,60,.35)' },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: { fadeUp: 'fadeUp .3s ease both', shimmer: 'shimmer 2s linear infinite' },
    },
  },
  plugins: [typography],
}
