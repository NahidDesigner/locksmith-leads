import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "rgb(15 17 21)",
        surface: "rgb(24 27 33)",
        border:  "rgb(40 44 52)",
        muted:   "rgb(148 163 184)",
        accent:  "rgb(59 130 246)",
        good:    "rgb(34 197 94)",
        warn:    "rgb(234 179 8)",
        bad:     "rgb(239 68 68)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      }
    }
  },
  plugins: [],
};

export default config;
