/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Thapal Core Palette
        primary: {
          DEFAULT: '#0B5D5B', // Deep Teal
          hover: '#084846',
          dark: '#063534',
          light: '#117b78',
        },
        coral: {
          DEFAULT: '#F26B4E', // Coral
          hover: '#e2593b',
          light: '#fdeee9',
        },
        sand: {
          DEFAULT: '#F6E7CB', // Sand
          dark: '#ebd6b0',
          light: '#fbf4e6',
        },
        leaf: {
          DEFAULT: '#3A9D5D', // Leaf
          hover: '#2e814c',
          light: '#eaf6ef',
        },
        amber: {
          DEFAULT: '#E0A100', // Amber
          light: '#fdf6e6',
        },
        brick: {
          DEFAULT: '#C93C3C', // Brick
          hover: '#b03232',
          light: '#faeded',
          dark: '#8b2020',
        },
        mist: '#F5F7F6', // Warm Mist
        surface: '#FFFFFF', // White
        night: '#10302F', // Night Teal
        sage: '#5E7371', // Sage Grey
        line: '#DCE5E3', // Line
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
