#!/usr/bin/env node
/**
 * 零依赖截图工具：直接用 Chrome DevTools Protocol 控制无头 Chrome。
 * 用法：
 *   node tools/shot.mjs --url "http://127.0.0.1:5180/" --out docs/screenshots/01-title.png --wait 2000
 *   node tools/shot.mjs --url ".../?level=classroom-1&mode=campaign&auto=1" --out play.png --wait 3000 \
 *        --eval "__sungame.session.run.player.hp=3"
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { randomInt } from 'node:crypto';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function findChrome() {
  const root = 'D:/DevTools/puppeteer/chrome';
  if (existsSync(root)) {
    for (const dir of readdirSync(root)) {
      const candidate = join(root, dir, 'chrome-win64', 'chrome.exe');
      if (existsSync(candidate)) return candidate;
    }
  }
  const fallback = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  return existsSync(fallback) ? fallback : null;
}

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? 'http://127.0.0.1:5180/';
const out = resolve(args.out ?? 'shot.png');
const wait = Number(args.wait ?? 2000);
const width = Number(args.width ?? 1440);
const height = Number(args.height ?? 900);
const evalScript = args.eval ?? null;
const touch = args.touch === 'true';
const chrome = args.chrome ?? findChrome();
if (!chrome) {
  console.error('找不到 chrome.exe');
  process.exit(2);
}

const port = randomInt(9400, 9800);
const profile = join(tmpdir(), `sungame-shot-${port}`);
const child = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws = null;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej, method });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rej(new Error(`${method} 超时`));
      }
    }, 30000);
  });
}

async function findTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(100);
  }
  throw new Error('Chrome 调试端口未就绪');
}

async function main() {
  const wsUrl = await findTarget();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${method}: ${msg.error.message}`));
      else res(msg.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  if (touch) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  await send('Page.navigate', { url });
  await sleep(wait);

  if (evalScript) {
    const result = await send('Runtime.evaluate', {
      expression: evalScript,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result?.exceptionDetails) {
      console.error('页面脚本出错：', JSON.stringify(result.exceptionDetails.exception ?? result.exceptionDetails));
    }
    await sleep(600);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({ success: true, out, url, width, height }));
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ success: false, error: String(err) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    child.kill();
    await sleep(150);
  });
