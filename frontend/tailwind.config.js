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
          '0%':   { transform: 'translate3d(0px, -10px, 0) scale(0.9)',  opacity: '0.08' },
          '20%':  { transform: 'translate3d(10px, 6px, 0)  scale(0.96)', opacity: '0.22' },
          '40%':  { transform: 'translate3d(-8px, 14px, 0) scale(1.02)', opacity: '0.32' },
          '60%':  { transform: 'translate3d(6px, 4px, 0)   scale(1.05)', opacity: '0.26' },
          '80%':  { transform: 'translate3d(-6px, 12px, 0) scale(0.98)', opacity: '0.18' },
          '100%': { transform: 'translate3d(4px, -4px, 0)  scale(0.9)',  opacity: '0.08' },
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
