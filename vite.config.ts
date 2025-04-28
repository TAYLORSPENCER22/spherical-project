import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({

  base: '/spherical-project/',
  
  plugins: [react()],
  server: {
    port:3000, //changed to local host 3000
  },
})
