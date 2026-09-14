/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#144EB9',
          hover: '#3d6fe0',
        },
        ink: '#0A0A0A',
        canvas: '#F7F8FA',
        surface: '#FFFFFF',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(10, 10, 10, 0.04), 0 8px 24px rgba(20, 78, 185, 0.06)',
      },
    },
  },
  plugins: [],
};
