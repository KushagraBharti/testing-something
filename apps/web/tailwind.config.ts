import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1D9BF0",
          background: "#000000",
          surface: "#15202B",
        },
      },
    },
  },
  plugins: [],
};

export default config;
