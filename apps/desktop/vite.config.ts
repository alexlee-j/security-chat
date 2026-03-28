import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    // 使用相对路径
    base: '././',
    // 确保所有资源都使用相对路径
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // 确保资源路径正确
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  // 修复资源路径问题
  css: {
    devSourcemap: false,
  },
});
