import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Façade noire du restaurant
        ink: {
          DEFAULT: '#1c1814',
          800: '#25201b',
          700: '#2e2822',
          600: '#3b332b',
        },
        // Orange du logo (le nom « gold » est conservé pour ne rien casser)
        gold: {
          light: '#ffab73',
          DEFAULT: '#e8590c',
          dark: '#c44a08',
        },
        chaux: '#f5f3ee',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'Impact', 'sans-serif'],
        sans: ['"Familjen Grotesk"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 4s linear infinite',
        'fade-up': 'fade-up 0.8s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
