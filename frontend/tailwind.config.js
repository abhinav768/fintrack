/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0A0B",
          900: "#111113",
          850: "#161618",
          800: "#1C1C1F",
          700: "#2A2A2E",
          600: "#3A3A3F",
        },
        paper: "#EDEBE4",
        muted: "#8E8C85",
        faint: "#5E5D59",
        lime: { DEFAULT: "#D4FF3A", soft: "#E3FF7A" },
        coral: "#FF7A59",
        amber: { DEFAULT: "#F2B33D" },
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};
