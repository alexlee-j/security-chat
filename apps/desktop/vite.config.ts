import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：修复资源路径为相对路径
    {
      name: 'fix-relative-paths',
      closeBundle() {
        const indexPath = join(__dirname, 'dist', 'index.html');
        let content = readFileSync(indexPath, 'utf-8');
        // 替换绝对路径为相对路径
        content = content.replace(/src="\/assets\//g, 'src="./assets/');
        content = content.replace(/href="\/assets\//g, 'href="./assets/');
        content = content.replace(/href="\/favicon/g, 'href="./favicon');
        writeFileSync(indexPath, content);
        console.log('[fix-relative-paths] Fixed asset paths to relative');
      },
    },
  ],
  server: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
  },
});
