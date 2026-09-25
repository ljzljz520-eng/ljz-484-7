import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 开发时把 /api 转发到后端，避免跨域
      '/api': 'http://localhost:4000'
    }
  }
});
