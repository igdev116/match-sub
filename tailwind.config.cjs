/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f4',
          100: '#ffe6e4',
          200: '#ffd2ce',
          300: '#ffb1a9',
          400: '#ff8274',
          500: '#eb4e43',
          600: '#d9372c',
          700: '#b72a20',
          800: '#97261e',
          900: '#7d251f',
          950: '#440e0a',
        },
        dark: {
          sidebar: '#0f172a',
          surface: '#1e293b',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },
    },
  },
  plugins: [],
}

