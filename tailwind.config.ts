import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#3e21f3",
          dark: "#3419d2",
          light: "#f1efff",
        },
        header: "#190e5d",
        surface: {
          DEFAULT: "#ffffff",
          muted: "#fbfbfb",
          subtle: "#f9f9fa",
        },
        divider: "#e7e7e7",
        success: "#1a832c",
        error: "#d21437",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(16, 24, 40, 0.04)",
        sm: "0 1px 2px 0 rgba(16, 24, 40, 0.06)",
      },
      borderRadius: {
        md: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
