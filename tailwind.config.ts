import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 30px rgba(231,76,60,0.15)'
      }
    }
  },
  plugins: []
} satisfies Config;
