/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors')

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class', // or 'media' or boolean
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['Sora', 'sans-serif'],
      },
      colors: {
        // UF CSU brand palette (mirrors csu-frontpage/tailwind.config.js)
        'accent-1': '#0f44cd',
        'accent-2': '#FA4618',
        url: '#4A82EA',
      },
      keyframes: {
        'zoom-in': {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        'zoom-out': {
          '0%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(0.95)', opacity: 0 },
        },
      },
      animation: {
        'zoom-in': 'zoom-in 0.3s',
        'zoom-out': 'zoom-out 0.3s', 
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};
