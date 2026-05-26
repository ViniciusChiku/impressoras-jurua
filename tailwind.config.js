/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        simpress: {
          blue: '#002D6F',       // Azul Meia-Noite Institucional
          dark: '#001944',       // Azul Escuro Profundo para fundos
          magenta: '#D000BB',    // Hollywood Cerise (cor de destaque e ação)
          gray: '#A9B8C3',       // Cadet Blue para bordas e tons secundários
          light: '#F4F7FC',      // Fundo leve e limpo premium
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}