/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        heading: ['"General Sans"', '"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        dut: {
          50: '#F0F6FC',
          100: '#E1EDF9',
          200: '#C2DBF2',
          300: '#91C0E9',
          400: '#549FDE',
          500: '#1D6FC2', // DUT Primary
          600: '#175A9E', // DUT Primary Hover
          700: '#12457A',
          800: '#0E345C',
          900: '#0A2542',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#FAFAFA',
          subtle: '#F4F4F6',
        },
        border: {
          subtle: '#E8E8EC',
          strong: '#D1D1D8',
        },
        text: {
          primary: '#0A0A0A',
          secondary: '#6B6B6B',
          muted: '#9C9C9C',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#1D6FC2',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
      },
      borderRadius: {
        card: '12px',
        panel: '8px',
        btn: '6px',
        input: '6px',
      },
      boxShadow: {
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.08)',
        'btn-glow': '0 4px 12px rgba(29, 111, 194, 0.25)',
        'focus-ring': '0 0 0 3px rgba(29, 111, 194, 0.15)',
      },
    },
  },
  plugins: [],
}
