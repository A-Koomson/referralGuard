/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        rg: {
          bg: "#e9eef2",
          surface: "#ffffff",
          ink: "#0f1c24",
          muted: "#5a6d7a",
          border: "#c9d5de",
          accent: "#0a6b6f",
          "accent-soft": "#d9eef0",
          critical: "#b42318",
          warning: "#b54708",
          ok: "#067647",
          navy: "#0b2430",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Segoe UI", "sans-serif"],
        display: ['"IBM Plex Sans"', "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
