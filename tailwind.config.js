/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        titan: {
          gold: '#D4A02A',
          goldLight: '#F0C75E',
          dark: '#1A1A1A',
          charcoal: '#2A2A2A',
          steel: '#3F4650',
          steelLight: '#5A6572',
        },
      },
    },
  },
  plugins: [],
}
