/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F4EAD5",
          50: "#FBF6EC",
          100: "#F7EFDE",
          200: "#F0E2C6",
        },
        ink: "#2B2018",
        clay: {
          DEFAULT: "#E8731E",
          light: "#F08A24",
          deep: "#C9560F",
        },
        teal: {
          DEFAULT: "#3FB8C4",
          light: "#5BC0CC",
          deep: "#2A8C97",
        },
        gold: {
          DEFAULT: "#F2B705",
          light: "#FFD23F",
        },
      },
      fontFamily: {
        display: ['"Clash Display"', '"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightish: "-0.02em",
      },
    },
  },
  plugins: [],
};
