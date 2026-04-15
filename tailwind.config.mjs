/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08090b",
          900: "#0d0e11",
          800: "#131418",
          700: "#1c1e23",
          600: "#2a2d34",
          500: "#3b3f48",
          400: "#6b707c",
          300: "#9ea3ae",
          200: "#c9ccd3",
          100: "#e4e6ea",
          50: "#f3f4f6",
        },
        accent: {
          DEFAULT: "#d4a574",
          soft: "#c89968",
          muted: "#8a6d4c",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      maxWidth: {
        prose: "72ch",
        reading: "68ch",
      },
      letterSpacing: {
        tightish: "-0.015em",
      },
    },
  },
  plugins: [],
};
