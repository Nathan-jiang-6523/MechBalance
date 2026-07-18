import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: {
    target: 'chrome120',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    sourcemap: false,
  },
})
