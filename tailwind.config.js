/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#c9a96e',
        'accent-glow': 'rgba(201, 169, 110, 0.3)',
        surface: '#1a1a2e',
        'surface-light': '#252540',
      },
      fontFamily: {
        sans: ['"Microsoft YaHei"', '"PingFang SC"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease',
        'fade-in-down': 'fadeInDown 0.8s ease',
        'fade-in-up': 'fadeInUp 0.8s ease',
        blink: 'blink 0.8s infinite',
        pulse: 'pulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
