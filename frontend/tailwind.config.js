/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0084ff", // Modern Messenger Blue
        secondary: "#00b2ff",
        dark: "#0b141a",
        paper: "#e9edef",
        "chat-bg": "#efeae2",
      }
    },
  },
  plugins: [],
}
