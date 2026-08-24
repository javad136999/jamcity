/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        vazir: ["Vazirmatn", "sans-serif"],
      },
      colors: {
        jam: {
          green: "#12b981",
          darkgreen: "#0b6e4f",
          navy: "#0a1128",
          black: "#0b0d10",
          white: "#f8faf9",
        },
      },
      boxShadow: {
        soft: "0 8px 28px -10px rgba(15,23,42,0.12)",
        glow: "0 0 0 1px rgba(18,185,129,0.18), 0 8px 24px -10px rgba(18,185,129,0.28)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
