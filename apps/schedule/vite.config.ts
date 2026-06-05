import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // LAN上の全インターフェースで待ち受ける（192.168.x.x でアクセス可能）
    port: 5173,
  },
})
