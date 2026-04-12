import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：修复资源路径为相对路径
    {
      name: 'fix-relative-paths',
      closeBundle() {
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        let htmlContent = readFileSync(indexPath, 'utf-8');
        // 替换 HTML 中的绝对路径为相对路径
        htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
        htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
        htmlContent = htmlContent.replace(/href="\/favicon/g, 'href="./favicon');
        writeFileSync(indexPath, htmlContent);

        // 修复 CSS 中的 url() 路径
        const assetsDir = path.join(__dirname, 'dist', 'assets');
        if (!existsSync(assetsDir)) {
          console.warn('[fix-relative-paths] assets directory not found, skipping CSS path fixes');
        } else {
          const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith('.css'));
          for (const cssFile of cssFiles) {
            const cssPath = path.join(assetsDir, cssFile);
            let cssContent = readFileSync(cssPath, 'utf-8');
            const before = cssContent;
            // 修复 /assets/ 开头和 ./assets/ 的字体路径
            cssContent = cssContent.replace(/url\(\/assets\//g, 'url(./');
            cssContent = cssContent.replace(/url\(\.\/assets\//g, 'url(./');
            if (cssContent !== before) {
              writeFileSync(cssPath, cssContent);
              console.log(`[fix-relative-paths] Fixed asset paths in ${cssFile}`);
            }
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
  },
});
