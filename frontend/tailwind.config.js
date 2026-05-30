/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-primary': '#171717',
        'dark-secondary': '#1F1F1F',
      }
    },
  },
  plugins: [],
}