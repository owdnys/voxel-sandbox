import { defineConfig } from 'vite';

// 部署用配置（不改变任何游戏逻辑）。
// base: './' 让构建产物使用相对路径（./assets/...），于是同一份 dist 既能放在
// 域名根路径（Cloudflare Pages、自定义域名），也能放在仓库子路径
// （GitHub Pages 的 https://<用户名>.github.io/<仓库名>/）而不会 404。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
