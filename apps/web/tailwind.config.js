/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        board: "var(--board)",
        "board-raised": "var(--board-raised)",
        track: "var(--track)",
        "track-dim": "var(--track-dim)",
        paper: "var(--paper)",
        "paper-dim": "var(--paper-dim)",
        "lamp-amber": "var(--lamp-amber)",
        "lamp-green": "var(--lamp-green)",
        "lamp-red": "var(--lamp-red)",
        "ink-on-paper": "var(--ink-on-paper)",
        tape: "var(--tape)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [],
};
