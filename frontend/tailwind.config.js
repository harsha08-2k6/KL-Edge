/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.jsx",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12151f",
        paper: "#f7f4ee",
        mint: "#2f9d83",
        lime: "#b9d957",
        coral: "#ef6f61",
        amber: "#e3a72f",
        violet: "#7867d8",
      },
      boxShadow: {
        soft: "0 14px 36px rgba(18,21,31,0.10)",
      },
    },
  },
  plugins: [animate],
};