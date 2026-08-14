import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// base is set to the repo name so assets resolve correctly on GitHub Pages
// (https://<username>.github.io/tv-box/). Change this if the repo is renamed.
export default defineConfig({
  base: '/tv-box/',
  plugins: [react(), tailwindcss()],
})
