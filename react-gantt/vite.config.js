import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'gantt-assets',
    rollupOptions: {
      output: {
        entryFileNames: 'gantt-assets/[name]-[hash].js',
        chunkFileNames: 'gantt-assets/[name]-[hash].js',
        assetFileNames: 'gantt-assets/[name]-[hash].[ext]',
      }
    }
  }
})
