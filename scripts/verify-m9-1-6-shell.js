import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4173;
const CDP_PORT = 9225; // Use a fresh CDP port

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

let cdpMsgId = 1;
async function sendCdp(ws, method, params = {}) {
  const id = ++cdpMsgId;
  return new Promise((resolve, reject) => {
    const handleMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handleMsg);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handleMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result?.value;
}

async function captureScreenshot(ws, filepath) {
  const res = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buffer);
  console.log(`[Captured] -> ${filepath}`);
}

async function run() {
  console.log('=== Starting M9.1.6 Surveyor Shell Browser QA ===');

  // 1. Start preview server
  console.log('Starting vite preview server...');
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let serverReady = false;
  preview.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes(String(PORT))) serverReady = true;
  });

  let attempts = 0;
  while (!serverReady && attempts < 20) {
    await sleep(500);
    attempts++;
  }
  await sleep(1000);
  console.log(`Preview server running at http://localhost:${PORT}`);

  // 2. Launch Edge headless
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-m9-shell-'));
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${tmpUserData}`,
    'about:blank',
  ]);

  await sleep(2000);

  const targets = await fetchJson(`http://localhost:${CDP_PORT}/json`);
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve) => {
    ws.addEventListener('open', resolve);
  });

  await sendCdp(ws, 'Page.enable');
  await sendCdp(ws, 'DOM.enable');

  const evidenceDir = path.resolve('docs/evidence/m9');
  fs.mkdirSync(evidenceDir, { recursive: true });

  // --- MOBILE VIEWPORT (390 x 844, iPhone 14 / modern Android) ---
  console.log('\n--- Testing Mobile Viewport (390x844) ---');
  await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Mobile Home
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_mobile_home.png'));

  // Mobile Survey Form
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/survey` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_mobile_survey.png'));

  // Mobile Forms Catalog
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/forms` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_mobile_forms.png'));

  // Mobile Statistics
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/statistics` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_mobile_stats.png'));

  // Mobile Records List
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/records` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_mobile_records.png'));

  // --- DESKTOP VIEWPORT (1280 x 800) ---
  console.log('\n--- Testing Desktop Viewport (1280x800) ---');
  await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Desktop Home
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_desktop_home.png'));

  // Desktop Stats
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/statistics` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_desktop_stats.png'));

  // Desktop Records
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/records` });
  await sleep(1500);
  await captureScreenshot(ws, path.join(evidenceDir, 'm9_1_6_desktop_records.png'));

  console.log('\nAll browser evidence captures completed successfully!');

  // Cleanup
  ws.close();
  edge.kill();
  preview.kill();
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch {}
}

run().catch((e) => {
  console.error('Error during browser QA:', e);
  process.exit(1);
});
