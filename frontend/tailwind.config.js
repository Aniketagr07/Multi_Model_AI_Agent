/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          main: 'var(--bg-main)',
          sidebar: 'var(--bg-sidebar)',
          panel: 'var(--bg-panel)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          border: 'var(--border-color)',
          accent: 'var(--accent)',
          'accent-hover': 'var(--accent-hover)',
          success: 'var(--success)',
          error: 'var(--error)',
        },
        charcoal: {
          950: '#0B0D12',
          900: '#10131A',
          850: '#151923',
          800: '#1E2330',
          700: '#282D38',
          600: '#3D4454',
          500: '#525B6F',
        },
      },
    },
  },
  plugins: [],
}
