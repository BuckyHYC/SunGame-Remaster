import { defineConfig } from 'vite';

// GitHub Pages 下需要仓库名前缀；本地 dev/build 用相对路径
const base = process.env.GITHUB_ACTIONS ? '/SunGame-Remaster/' : './';

export default defineConfig({
  base,
  server: { port: 5180, host: '127.0.0.1' },
  build: {
    target: 'es2019',
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
