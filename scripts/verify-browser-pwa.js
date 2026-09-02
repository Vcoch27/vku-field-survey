import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4173;
const CDP_PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function sendCdp(ws, method, params = {}, id = 1) {
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

async function evaluate(ws, expression, id = 100) {
  const res = await sendCdp(
    ws,
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    id
  );
  return res.result?.value;
}

async function run() {
  console.log('--- Starting PWA Real Browser Verification ---');

  // 1. Start Vite preview server
  console.log('1. Starting Vite preview server on port', PORT);
  const preview = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  // Wait for preview server to be responsive
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await sleep(300);
    }
  }

  if (!serverReady) {
    preview.kill();
    throw new Error('Vite preview server failed to start');
  }
  console.log('Preview server is UP!');

  // 2. Launch Chromium Edge in headless mode
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-pwa-test-'));
  console.log('2. Launching headless Edge (Chromium) with profile:', tmpUserData);

  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpUserData}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  // Wait for CDP endpoint
  let version = null;
  for (let i = 0; i < 30; i++) {
    try {
      version = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (version) break;
    } catch {
      await sleep(300);
    }
  }

  if (!version) {
    edge.kill();
    preview.kill();
    throw new Error('Edge CDP failed to become ready');
  }
  console.log('Connected to Edge CDP:', version['Browser']);

  // Get or create page target
  const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  console.log('Connecting to page WebSocket:', pageTarget.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  await sendCdp(ws, 'Page.enable', {}, 10);
  await sendCdp(ws, 'Network.enable', {}, 11);
  await sendCdp(ws, 'Runtime.enable', {}, 12);

  // 3. Online Initial Navigation (PWA-01, PWA-02, PWA-03)
  console.log('3. Navigating to http://localhost:' + PORT);
  await sendCdp(ws, 'Page.navigate', { url: `http://localhost:${PORT}/` }, 20);
  await sleep(2500); // Allow React app to mount and SW to register

  const title = await evaluate(ws, 'document.title', 101);
  console.log('Page Title:', title);

  const manifestHref = await evaluate(
    ws,
    'document.querySelector("link[rel=manifest]")?.href',
    102
  );
  console.log('Manifest Link:', manifestHref);

  const themeColor = await evaluate(
    ws,
    'document.querySelector("meta[name=theme-color]")?.content',
    103
  );
  console.log('Theme Color:', themeColor);

  // Verify manifest JSON via browser fetch
  const manifestData = await evaluate(
    ws,
    'fetch("/manifest.webmanifest").then(r => r.json())',
    104
  );
  console.log('Manifest Display Mode:', manifestData.display);
  console.log('Manifest Icons Count:', manifestData.icons?.length);

  // 4. Service Worker Registration & App Shell Caching (PWA-04)
  console.log('4. Checking Service Worker registration and App Shell cache...');
  let swReady = false;
  for (let i = 0; i < 20; i++) {
    const swState = await evaluate(
      ws,
      `
      (async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? { scope: reg.scope, active: !!reg.active } : null;
      })()
    `,
      200 + i
    );
    if (swState?.active) {
      console.log('Service Worker ACTIVE with scope:', swState.scope);
      swReady = true;
      break;
    }
    await sleep(500);
  }

  // Inspect Cache Storage
  const cacheNames = await evaluate(ws, 'caches.keys()', 301);
  console.log('Cache Storage Names:', cacheNames);

  let cachedUrls = [];
  if (cacheNames && cacheNames.length > 0) {
    cachedUrls = await evaluate(
      ws,
      `
      (async () => {
        const cache = await caches.open("${cacheNames[0]}");
        const requests = await cache.keys();
        return requests.map(r => new URL(r.url).pathname);
      })()
    `,
      302
    );
    console.log('Precached App Shell URLs Count:', cachedUrls.length);
    console.log('Precached Samples:', cachedUrls.slice(0, 5));
  }

  // 5. Test Offline Boot / Reload (PWA-05, PWA-06)
  console.log('5. Emulating NETWORK DISCONNECTED (Offline test)...');
  await sendCdp(
    ws,
    'Network.emulateNetworkConditions',
    {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    },
    401
  );

  // Reload page while completely offline
  console.log('Reloading page while offline...');
  await sendCdp(ws, 'Page.reload', {}, 402);
  await sleep(2500);

  const offlineTitle = await evaluate(ws, 'document.title', 403);
  const offlineAppHeading = await evaluate(ws, 'document.querySelector("h1")?.textContent', 404);
  console.log('Offline Reloaded Page Title:', offlineTitle);
  console.log('Offline Reloaded App Heading:', offlineAppHeading);

  // Check offline indicator badge
  const offlineBadge = await evaluate(
    ws,
    'document.querySelector(".network-offline-badge")?.textContent',
    405
  );
  console.log('Offline Badge in UI:', offlineBadge);

  // 6. Test IndexedDB Persistence while Offline (M5/M7 separation)
  console.log('6. Verifying IndexedDB persistence and separation from Cache Storage...');
  const idbDatabases = await evaluate(
    ws,
    'indexedDB.databases().then(d => d.map(x => x.name))',
    501
  );
  console.log('IndexedDB Databases Present:', idbDatabases);

  // Clean up
  ws.close();
  edge.kill();
  preview.kill();
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch {}

  const passPwa01 = !!manifestHref && manifestData.display === 'standalone';
  const passPwa03 = themeColor === '#0284C7' && manifestData.icons?.length >= 2;
  const passPwa04 = swReady && cachedUrls.length > 0;
  const passPwa05 = offlineTitle === 'VKU Field Survey' && offlineAppHeading === 'VKU Field Survey';

  console.log('\n--- BROWSER VERIFICATION SUMMARY ---');
  console.log('PWA-01 / PWA-02 (Manifest & Standalone):', passPwa01 ? 'PASS' : 'FAIL');
  console.log('PWA-03 (Theme #0284C7 & Icons):', passPwa03 ? 'PASS' : 'FAIL');
  console.log('PWA-04 (App Shell Service Worker Precaching):', passPwa04 ? 'PASS' : 'FAIL');
  console.log('PWA-05 / PWA-06 (Offline Launch & Reload):', passPwa05 ? 'PASS' : 'FAIL');

  if (!passPwa01 || !passPwa03 || !passPwa04 || !passPwa05) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
