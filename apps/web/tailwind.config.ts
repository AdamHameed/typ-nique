import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#081120",
        cyan: {
          300: "#67e8f9",
          400: "#22d3ee"
        }
      },
      backgroundImage: {
        grid: "radial-gradient(circle at top, rgba(34,211,238,0.18), transparent 40%), linear-gradient(180deg, rgba(15,23,42,0.96), rgba(8,17,32,1))"
      }
    }
  },
  plugins: []
};

export default config;
