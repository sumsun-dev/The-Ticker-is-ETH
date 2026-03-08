import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react()]

  if (process.env.ANALYZE) {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
      }) as PluginOption,
    )
  }

  return {
    plugins,
    build: {
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
            thirdweb: ['thirdweb'],
            editor: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
            vendor: ['clsx', 'tailwind-merge', 'class-variance-authority'],
          },
        },
      },
    },
  }
})
