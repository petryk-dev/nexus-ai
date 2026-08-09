import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        foreground: "#ffffff",
        accent: "#3b82f6",
        panel: "#1a1a1a",
        border: "#27272a",
      },
    },
  },
  plugins: [],
};

export default config;
