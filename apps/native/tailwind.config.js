/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
    "./navigation/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#7480ff",
        "primary-content": "#1d232a",
        secondary: "#ff52d9",
        "secondary-content": "#1d232a",
        accent: "#00cdb8",
        "accent-content": "#1d232a",
        "base-100": "#1d232a",
        "base-200": "#191e24",
        "base-300": "#15191e",
        "base-content": "#a6adbb",
        neutral: "#2a323c",
        "neutral-content": "#a6adbb",
        info: "#00b5ff",
        success: "#00a96e",
        warning: "#ffbe00",
        error: "#ff5861",
      },
    },
  },
  plugins: [],
};
