import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#080808",
          surface: "#111111",
          input: "#181818",
        },
        accent: {
          DEFAULT: "#FF6B35",
          hover: "#FF8555",
        },
        text: {
          primary: "#F0EDE8",
          secondary: "#666666",
          muted: "#444444",
        },
        border: {
          subtle: "rgba(255,255,255,0.06)",
          hover: "rgba(255,255,255,0.12)",
        },
        status: {
          queued: "#666666",
          processing: "#FF6B35",
          complete: "#4ADE80",
          failed: "#EF4444",
        },
      },
      fontFamily: {
        display: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        panel: "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
        glow: "0 0 20px rgba(255,107,53,0.15)",
      },
      backdropBlur: {
        header: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
