#!/usr/bin/env node
/**
 * 把 vite build 的产物压成单文件 HTML，方便直接发给同学双击打开（file:// 也能跑）。
 * 产物：dist/play.html
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const indexPath = resolve(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.error('找不到 dist/index.html，先跑 vite build');
  process.exit(1);
}

let html = readFileSync(indexPath, 'utf8');

const readAsset = (href) => {
  const clean = href.replace(/^\.?\//, '').replace(/^\/+/, '');
  const path = resolve(dist, clean);
  if (!existsSync(path)) throw new Error(`产物缺失: ${path}`);
  return readFileSync(path, 'utf8');
};

// CSS → <style>
const cssLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)];
for (const match of cssLinks) {
  const href = match[0].match(/href="([^"]+)"/)?.[1];
  if (!href) continue;
  const css = readAsset(href);
  html = html.replace(match[0], `<style>\n${css}\n</style>`);
}

// JS → 内联 module（内联模块在 file:// 下可以执行，只要没有外部 import）
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
for (const match of scripts) {
  const js = readAsset(match[1]).replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(match[0], `<script type="module">\n${js}\n</script>`);
}

// modulepreload 已经没有意义，去掉
html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');

const outPath = resolve(dist, 'play.html');
writeFileSync(outPath, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(JSON.stringify({ success: true, out: outPath, sizeKB: kb }));
