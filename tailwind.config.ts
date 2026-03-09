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
        card: "6px",
        input: "4px",
      },
      backdropBlur: {
        header: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
