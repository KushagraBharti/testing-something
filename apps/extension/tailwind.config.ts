import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        panel: {
          surface: "#11161D",
          border: "#1F2A36",
        },
      },
    },
  },
  plugins: [],
};

export default config;
