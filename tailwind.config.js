/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          main: "#ffffff",
          400: "#bdbdbd",
          500: "#9e9e9e",
          600: "#757575",
          700: "#616161",
          contrast: "#000000",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Segoe UI"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "source-code-pro",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Courier New"',
          "monospace",
        ],
      },
      animation: {
        blink: "blink 0.8s step-end infinite",
        "pulse-custom": "pulse 1s infinite",
        fadeIn: "fadeIn 0.2s ease",
        "pop-in": "popIn 0.45s cubic-bezier(0.3, 1.4, 0.5, 1) both",
        "draw-check": "drawCheck 0.45s ease-out 0.3s both",
        "rise-in": "riseIn 0.4s ease both",
      },
      keyframes: {
        blink: {
          "50%": { opacity: "0" },
        },
        pulse: {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.1)", opacity: "0.3" },
          "100%": { transform: "scale(0.95)", opacity: "0.7" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        popIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        drawCheck: {
          from: { "stroke-dashoffset": "24" },
          to: { "stroke-dashoffset": "0" },
        },
        riseIn: {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
