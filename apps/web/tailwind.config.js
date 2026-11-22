/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Digita: deep forest teal for trust, warm harvest amber for warmth —
        // a palette that sits naturally with cafés, farms and food businesses
        // without looking like a toy.
        ink: { DEFAULT: '#0B1B2B', soft: '#3B4A5A', mute: '#6B7A8A' },
        brand: {
          50: '#ECFDF7', 100: '#D1FAEC', 200: '#A6F2D9', 300: '#6EE3C1',
          400: '#34C9A3', 500: '#14A085', 600: '#0E7C66', 700: '#0A6352',
          800: '#0A4F43', 900: '#0A4038',
        },
        harvest: { 300: '#F8C66B', 400: '#F6B544', 500: '#F4A62A', 600: '#D98A12' },
        paper: '#F7F6F2',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,27,43,.04), 0 8px 24px rgba(11,27,43,.06)',
        lift: '0 2px 4px rgba(11,27,43,.05), 0 18px 40px rgba(11,27,43,.10)',
      },
    },
  },
  plugins: [],
};
