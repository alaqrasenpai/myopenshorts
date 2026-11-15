/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stream: {
          dark: "#0b0e14",
          card: "#121722",
          border: "#1f293d",
          twitch: "#9146FF",
          kick: "#53FC18",
          youtube: "#FF0000",
          accent: "#6366f1",
          gold: "#F59E0B"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
