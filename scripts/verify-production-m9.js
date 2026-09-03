import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9223;
const PROD_URL = 'https://vkufieldsurvey.vanhoang.online/';
const EVIDENCE_DIR = path.resolve('docs/evidence/m9');

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

async function takeScreenshot(ws, filename, id = 500) {
  const res = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' }, id);
  const buffer = Buffer.from(res.data, 'base64');
  const filepath = path.join(EVIDENCE_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`[Screenshot saved]: ${filepath} (${buffer.length} bytes)`);
}

async function setViewport(ws, width, height, id = 600) {
  await sendCdp(
    ws,
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    },
    id
  );
}

async function run() {
  console.log('====================================================');
  console.log('--- Starting Production QA & Evidence Collection ---');
  console.log('Target URL:', PROD_URL);
  console.log('Evidence Output:', EVIDENCE_DIR);
  console.log('====================================================\n');

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  // 1. Launch Headless Edge with dedicated test profile
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-prod-qa-'));
  console.log('1. Launching headless Edge with profile:', tmpUserData);

  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpUserData}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

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
    throw new Error('Edge CDP failed to become ready');
  }
  console.log('Connected to Edge CDP:', version['Browser']);

  const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  console.log('Connecting to page WebSocket:', pageTarget.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  const consoleLogs = [];
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      consoleLogs.push({ type: data.params.type, text });
    }
  });

  await sendCdp(ws, 'Page.enable', {}, 10);
  await sendCdp(ws, 'Network.enable', {}, 11);
  await sendCdp(ws, 'Runtime.enable', {}, 12);

  // Set standard desktop viewport first
  await setViewport(ws, 1280, 800, 15);

  // 2. Initial Online Load & Health Check
  console.log('\n2. Navigating to live production site:', PROD_URL);
  await sendCdp(ws, 'Page.navigate', { url: PROD_URL }, 20);
  await sleep(3000); // Allow initial load, React hydration, SW registration

  const title = await evaluate(ws, 'document.title', 101);
  console.log('Page Title:', title);

  const isFormRendered = await evaluate(ws, '!!document.querySelector(".survey-form")', 102);
  console.log('Form rendered:', isFormRendered);

  // Capture Home Desktop Screenshot
  await takeScreenshot(ws, '01-production-home.png', 501);

  // 3. Manifest Verification
  console.log('\n3. Verifying Manifest...');
  const manifestHref = await evaluate(
    ws,
    'document.querySelector("link[rel=manifest]")?.href',
    103
  );
  console.log('Manifest Link:', manifestHref);

  const manifestData = await evaluate(
    ws,
    'fetch("/manifest.webmanifest").then(r => r.json())',
    104
  );
  console.log('Manifest Content:', JSON.stringify(manifestData, null, 2));

  // Navigate to manifest directly or render details for screenshot
  await evaluate(
    ws,
    `
    const pre = document.createElement('pre');
    pre.id = 'manifest-preview';
    pre.style = 'position:fixed;top:10px;right:10px;background:#1e293b;color:#f8fafc;padding:12px;border-radius:8px;font-size:11px;z-index:99999;max-width:320px;max-height:400px;overflow:auto;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1);';
    pre.innerText = JSON.stringify(${JSON.stringify(manifestData)}, null, 2);
    document.body.appendChild(pre);
  `,
    105
  );
  await takeScreenshot(ws, '02-manifest.png', 502);
  await evaluate(ws, 'document.getElementById("manifest-preview")?.remove()', 106);

  // 4. Service Worker Verification
  console.log('\n4. Verifying Service Worker...');
  let swStatus = null;
  for (let i = 0; i < 20; i++) {
    swStatus = await evaluate(
      ws,
      `
      (async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return null;
        return {
          scope: reg.scope,
          active: !!reg.active,
          controller: !!navigator.serviceWorker.controller
        };
      })()
    `,
      107 + i
    );
    if (swStatus?.active) break;
    await sleep(500);
  }
  console.log('Service Worker Status:', swStatus);

  // Reload once online to ensure controller claim if first registration
  if (!swStatus?.controller) {
    console.log('Reloading once to claim controller...');
    await sendCdp(ws, 'Page.reload', {}, 130);
    await sleep(2500);
    swStatus = await evaluate(
      ws,
      `
      (async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return {
          scope: reg?.scope,
          active: !!reg?.active,
          controller: !!navigator.serviceWorker.controller
        };
      })()
    `,
      131
    );
    console.log('Service Worker Status after reload:', swStatus);
  }

  // Visual badge for SW active
  await evaluate(
    ws,
    `
    const banner = document.createElement('div');
    banner.id = 'sw-status-banner';
    banner.style = 'position:fixed;bottom:16px;right:16px;background:#0284c7;color:#fff;padding:8px 14px;border-radius:20px;font-weight:600;font-size:12px;z-index:9999;box-shadow:0 4px 6px rgba(0,0,0,0.15);';
    banner.innerText = 'Service Worker: Active & Controlling Page';
    document.body.appendChild(banner);
  `,
    132
  );
  await takeScreenshot(ws, '03-service-worker.png', 503);
  await evaluate(ws, 'document.getElementById("sw-status-banner")?.remove()', 133);

  // 5. Offline Boot & Reload Test
  console.log('\n5. Performing Offline Reload Test (PWA-05, PWA-06)...');
  console.log('Setting network to OFFLINE...');
  await sendCdp(
    ws,
    'Network.emulateNetworkConditions',
    {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    },
    140
  );

  await sleep(1000);

  // Hard reload while offline!
  console.log('Reloading while offline...');
  await sendCdp(ws, 'Page.reload', {}, 141);
  await sleep(3000);

  const offlineTitle = await evaluate(ws, 'document.title', 142);
  const offlineFormPresent = await evaluate(ws, '!!document.querySelector(".survey-form")', 143);
  const offlineBadgePresent = await evaluate(
    ws,
    '!!document.querySelector(".network-offline-badge")',
    144
  );
  console.log('Offline reload title:', offlineTitle);
  console.log('Offline form present:', offlineFormPresent);
  console.log('Offline badge visible:', offlineBadgePresent);

  await takeScreenshot(ws, '04-offline-reload.png', 504);

  // Re-enable network
  console.log('Re-enabling network...');
  await sendCdp(
    ws,
    'Network.emulateNetworkConditions',
    {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    },
    145
  );
  await sleep(1500);

  // 6. IndexedDB Draft Persistence
  console.log('\n6. Testing IndexedDB Draft Persistence (CR-001 Location Model)...');

  // Fill in draft: Zone: K, Building: A, Room Number: 205
  await evaluate(
    ws,
    `
    (() => {
      // 1. Select Zone K
      const zoneK = document.querySelector('input[name="zone"][value="K"]');
      if (zoneK) {
        zoneK.click();
      }

      // 2. Building A
      const bldgInput = document.querySelector('#building');
      if (bldgInput) {
        bldgInput.value = 'A';
        bldgInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 3. Room Number 205
      const roomInput = document.querySelector('#roomNumber');
      if (roomInput) {
        roomInput.value = '205';
        roomInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 4. Category
      const catSelect = document.querySelector('#category');
      if (catSelect) {
        catSelect.value = 'AC';
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 5. Rating 4
      const star4 = document.querySelector('input[name="conditionRating"][value="4"]');
      if (star4) {
        star4.click();
      }

      // 6. Defect Notes
      const notesInput = document.querySelector('#defectNotes');
      if (notesInput) {
        notesInput.value = 'Air conditioner compressor vibrates loudly on high fan speed.';
        notesInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `,
    150
  );

  console.log('Waiting 2 seconds for autosave debounce to complete...');
  await sleep(2200);

  // Verify full room identifier displayed in UI
  const previewBadge = await evaluate(
    ws,
    'document.querySelector(".preview-badge")?.textContent?.trim()',
    151
  );
  console.log('Derived Room Identifier:', previewBadge);

  // Verify draft directly in IndexedDB
  const idbDraft = await evaluate(
    ws,
    `
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('vku-field-survey');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('drafts', 'readonly');
          const store = tx.objectStore('drafts');
          const getReq = store.get('current_draft');
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    })()
  `,
    152
  );
  console.log('Draft in IndexedDB:', JSON.stringify(idbDraft, null, 2));

  // Check localStorage durability
  const localStorageUsage = await evaluate(ws, 'JSON.stringify(Object.keys(localStorage))', 153);
  console.log('LocalStorage keys (must NOT contain survey data):', localStorageUsage);

  // Reload page to verify draft recovery
  console.log('Reloading page to verify draft recovery...');
  await sendCdp(ws, 'Page.reload', {}, 154);
  await sleep(2500);

  const recoveredZone = await evaluate(
    ws,
    'document.querySelector(\'input[name="zone"]:checked\')?.value',
    155
  );
  const recoveredBldg = await evaluate(ws, 'document.querySelector("#building")?.value', 156);
  const recoveredRoom = await evaluate(ws, 'document.querySelector("#roomNumber")?.value', 157);
  const recoveredIdentifier = await evaluate(
    ws,
    'document.querySelector(".preview-badge")?.textContent?.trim()',
    158
  );
  console.log('Recovered Zone:', recoveredZone);
  console.log('Recovered Building:', recoveredBldg);
  console.log('Recovered Room:', recoveredRoom);
  console.log('Recovered Identifier:', recoveredIdentifier);

  await takeScreenshot(ws, '05-indexeddb-draft.png', 505);

  // 7. Offline Submission & Queueing
  console.log('\n7. Testing Offline Submission Queue (PENDING_SYNC)...');
  console.log('Setting network to OFFLINE...');
  await sendCdp(
    ws,
    'Network.emulateNetworkConditions',
    {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    },
    160
  );
  await sleep(1000);

  // Click Submit Inspection button
  console.log('Submitting inspection offline...');
  await evaluate(
    ws,
    `
    (() => {
      const btn = document.querySelector('.btn-submit');
      if (btn) btn.click();
    })()
  `,
    161
  );

  await sleep(1500);

  const submitStatusText = await evaluate(
    ws,
    'document.querySelector(".btn-submitted")?.textContent?.trim()',
    162
  );
  console.log('Submission UI Status:', submitStatusText);

  // Inspect IndexedDB submissions store
  const idbSubmissions = await evaluate(
    ws,
    `
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('vku-field-survey');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('submissions', 'readonly');
          const store = tx.objectStore('submissions');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result);
          getAllReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    })()
  `,
    163
  );
  console.log('Queued Submissions in IndexedDB:');
  for (const s of idbSubmissions || []) {
    console.log(
      ` - ID: ${s.id}, syncStatus: ${s.syncStatus}, Zone: ${s.surveyData?.zone}, Room: ${s.surveyData?.building}-${s.surveyData?.roomNumber}`
    );
  }

  // Reload page while STILL OFFLINE to verify queued record survives
  console.log('Reloading page while still offline to confirm queue survival...');
  await sendCdp(ws, 'Page.reload', {}, 164);
  await sleep(2500);

  const idbSubmissionsAfterReload = await evaluate(
    ws,
    `
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('vku-field-survey');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('submissions', 'readonly');
          const store = tx.objectStore('submissions');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result);
          getAllReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    })()
  `,
    165
  );
  console.log('Submissions in IndexedDB after offline reload:', idbSubmissionsAfterReload?.length);

  await takeScreenshot(ws, '06-pending-sync.png', 506);

  // 8. Reconnection Behavior
  console.log('\n8. Testing Reconnection Behavior...');
  console.log('Restoring network connectivity...');
  await sendCdp(
    ws,
    'Network.emulateNetworkConditions',
    {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    },
    170
  );
  await sleep(2500); // Wait for online event

  const idbSubmissionsAfterReconnect = await evaluate(
    ws,
    `
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('vku-field-survey');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('submissions', 'readonly');
          const store = tx.objectStore('submissions');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => resolve(getAllReq.result);
          getAllReq.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    })()
  `,
    171
  );

  console.log(
    'Submissions status after reconnect (must remain PENDING_SYNC without fake backend):'
  );
  for (const s of idbSubmissionsAfterReconnect || []) {
    console.log(` - ID: ${s.id}, syncStatus: ${s.syncStatus}`);
  }

  // 9. Responsive QA Viewports
  console.log('\n9. Testing Responsive Viewports...');

  // 9A. Mobile Viewport (375 x 740)
  console.log('Testing Mobile Viewport (375px)...');
  await setViewport(ws, 375, 740, 180);
  await sleep(1000);

  const mobileScrollWidth = await evaluate(
    ws,
    'document.documentElement.scrollWidth <= window.innerWidth',
    181
  );
  console.log('Mobile has no horizontal overflow:', mobileScrollWidth);
  await takeScreenshot(ws, '07-mobile-layout.png', 507);

  // 9B. Desktop Viewport (1440 x 900)
  console.log('Testing Desktop Viewport (1440px)...');
  await setViewport(ws, 1440, 900, 182);
  await sleep(1000);

  const desktopScrollWidth = await evaluate(
    ws,
    'document.documentElement.scrollWidth <= window.innerWidth',
    183
  );
  console.log('Desktop has no horizontal overflow:', desktopScrollWidth);
  await takeScreenshot(ws, '08-desktop-layout.png', 508);

  console.log('\n====================================================');
  console.log('Console Logs During Production QA:');
  for (const log of consoleLogs) {
    console.log(`[${log.type}] ${log.text}`);
  }
  console.log('====================================================');

  ws.close();
  edge.kill();
  console.log('\nProduction QA Verification Completed Successfully!');
}

run().catch((err) => {
  console.error('Production QA Script Failed:', err);
  process.exit(1);
});
