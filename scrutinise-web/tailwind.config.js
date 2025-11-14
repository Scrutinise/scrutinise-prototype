/** @type {import('tailwindcss').Config} */
module.exports = {
content: [
"./app/**/*.{js,ts,jsx,tsx}",
"./components/**/*.{js,ts,jsx,tsx}",
],
theme: {
extend: {
fontFamily: {
sans: ['Inter', 'system-ui', 'sans-serif'],
},
colors: {
revolutDark: '#0A0A0A',
revolutGray: '#6B7280',
revolutBlue: '#4D61FC',
},
backgroundImage: {
'fade-left': 'linear-gradient(to left, transparent 0%, black 100%)',
}
},
},
plugins: [],
};