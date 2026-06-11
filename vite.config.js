import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // heic2any は動的 import で別チャンクに分離されるため、サイズ警告のしきい値を調整
    chunkSizeWarningLimit: 1500,
  },
})
