/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        ocean: {
          950: '#060e1e',
          900: '#0a1628',
          800: '#0d2040',
          700: '#0f2d52',
          600: '#134068',
          500: '#1a5480',
          400: '#2272a8',
          300: '#4a9fc5',
          200: '#80c4dc',
          100: '#b8dff0',
          50: '#e0f2fa',
        },
      },
      keyframes: {
        waveMove: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(100vh) scale(0.8)', opacity: '0' },
          '10%': { opacity: '0.7' },
          '90%': { opacity: '0.3' },
          '100%': { transform: 'translateY(-60px) scale(1.1)', opacity: '0' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' },
        },
        scanLine: {
          '0%': { top: '0%', opacity: '0' },
          '5%': { opacity: '1' },
          '95%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        waveMove: 'waveMove 14s linear infinite',
        waveMoveSlow: 'waveMove 22s linear infinite reverse',
        floatUp: 'floatUp linear infinite',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        scanLine: 'scanLine 2.8s ease-in-out infinite',
        fadeSlideUp: 'fadeSlideUp 0.5s ease forwards',
      },
    },
  },
  plugins: [],
}
