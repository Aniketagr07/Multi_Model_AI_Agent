/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          900: '#111215',
          850: '#16181D',
          800: '#1E2128',
          700: '#2A2E39',
          600: '#3E4452',
        },
        brand: {
          500: '#3B82F6',
          600: '#2563EB',
        }
      }
    },
  },
  plugins: [],
}
