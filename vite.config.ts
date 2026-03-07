import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          'framer-motion': ['framer-motion'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          markdown: ['react-markdown'],
          sanitize: ['dompurify'],
          icons: ['lucide-react'],
          router: ['react-router-dom'],
          privy: ['@privy-io/react-auth'],
        },
      },
    },
  },
})
