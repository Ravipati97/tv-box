import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// base is set to the repo name so assets resolve correctly on GitHub Pages
// (https://<username>.github.io/tv-box/). Change this if the repo is renamed.
export default defineConfig({
  base: '/tv-box/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor libs into their own chunks so
        // browsers cache them independently of app code -- a route or copy
        // change no longer invalidates react/framer-motion/supabase-js too.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react-router')) return 'vendor-react'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
  },
})
