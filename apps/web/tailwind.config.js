/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        board: "#0E1916",
        "board-raised": "#14231F",
        track: "#2F4A41",
        "track-dim": "#223630",
        paper: "#E9E4D2",
        "paper-dim": "#A8A592",
        "lamp-amber": "#FFB000",
        "lamp-green": "#7DF0B0",
        "lamp-red": "#FF4D2E",
        "ink-on-paper": "#1B1A14",
        tape: "#EFE9D6",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        DEFAULT: "2px",
      },
    },
  },
  plugins: [],
};
