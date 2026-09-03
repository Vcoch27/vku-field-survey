import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4174;
const CDP_PORT = 9226;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let messageId = 0;

async function command(socket, method, params = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', listener);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(socket, expression) {
  const result = await command(socket, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(socket, pathname) {
  await command(socket, 'Page.navigate', { url: `http://localhost:${PORT}${pathname}` });
  await pause(700);
  await evaluate(socket, 'window.scrollTo(0, 0)');
}

async function screenshot(socket, filename) {
  const result = await command(socket, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.resolve('docs/evidence/m9', filename), Buffer.from(result.data, 'base64'));
}

async function run() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vku-m918-'));
  const preview = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  const edge = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, 'about:blank']);
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const previewResponse = await fetch(`http://127.0.0.1:${PORT}/`);
        if (previewResponse.ok) break;
      } catch {}
      await pause(250);
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (response.ok) break;
      } catch {}
      await pause(250);
    }
    const targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((response) => response.json());
    const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    await command(socket, 'Page.enable');
    await command(socket, 'Runtime.enable');
    await command(socket, 'Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await navigate(socket, '/');
    await evaluate(socket, `(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('vku-field-survey', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const transaction = db.transaction('submission_queue', 'readwrite');
      transaction.objectStore('submission_queue').clear();
      const categories = ['Hardware', 'Projector', 'AC', 'Electrical', 'Furniture'];
      for (let index = 0; index < 10; index += 1) {
        const status = index === 0 ? 'SYNC_FAILED' : index < 3 ? 'PENDING_SYNC' : 'SYNCED';
        transaction.objectStore('submission_queue').put({
          id: 'qa-' + index,
          timestamp: new Date(Date.now() - index * 3600000).toISOString(),
          syncStatus: status,
          lastErrorMessage: status === 'SYNC_FAILED' ? 'Destination unavailable' : undefined,
          failureDisposition: status === 'SYNC_FAILED' ? 'RETRYABLE' : undefined,
          surveyData: { zone: index < 3 ? 'K' : 'V', building: 'A', roomNumber: String(200 + index), category: categories[index % categories.length], conditionRating: index < 2 ? 2 : 4 + (index % 2), defectNotes: index === 0 ? 'Requires follow-up' : '', photo: null }
        });
      }
      await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
      db.close();
      return await new Promise((resolve, reject) => { const request = indexedDB.open('vku-field-survey', 1); request.onsuccess = () => { const countRequest = request.result.transaction('submission_queue').objectStore('submission_queue').count(); countRequest.onsuccess = () => resolve(countRequest.result); countRequest.onerror = () => reject(countRequest.error); }; request.onerror = () => reject(request.error); });
    })()`);

    const viewports = [320, 360, 390, 430, 768, 1280];
    const overflowResults = [];
    for (const width of viewports) {
      await command(socket, 'Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 800, deviceScaleFactor: 1, mobile: width < 768 });
      for (const pathname of ['/', '/statistics', '/records']) {
        await navigate(socket, pathname);
        const result = await evaluate(socket, `({ path: location.pathname, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth })`);
        overflowResults.push(result);
      }
    }

    await command(socket, 'Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await navigate(socket, '/');
    const home = await evaluate(socket, `({ primaryAction: document.body.innerText.includes('Start New Survey'), attention: document.body.innerText.includes('Needs attention'), recent: document.body.innerText.includes('Recent activity') })`);
    await screenshot(socket, 'm9_1_8_mobile_home.png');
    await navigate(socket, '/statistics');
    const stats = await evaluate(socket, `({ text: document.body.innerText, zoneRows: [...document.querySelectorAll('.zone-row')].map((row) => row.innerText), rawRows: document.querySelectorAll('.dist-row').length })`);
    await screenshot(socket, 'm9_1_8_mobile_stats.png');
    await evaluate(socket, 'window.scrollTo(0, document.documentElement.scrollHeight)');
    await pause(200);
    await screenshot(socket, 'm9_1_8_mobile_stats_coverage.png');
    await navigate(socket, '/records');
    const records = await evaluate(socket, `({ detailsLabels: [...document.querySelectorAll('.record-item-card')].filter((card) => /Details/.test(card.innerText)).length, permanentDeleteButtons: document.querySelectorAll('.btn-action-delete').length, cardLinks: document.querySelectorAll('.record-card-link').length, openMenus: [...document.querySelectorAll('.record-menu')].filter((menu) => menu.open).length })`);
    await screenshot(socket, 'm9_1_8_mobile_records.png');
    await navigate(socket, '/records?zone=V&category=Projector&status=SYNCED');
    const filtered = await evaluate(socket, `({ summary: document.querySelector('.active-filter-summary')?.innerText, cards: [...document.querySelectorAll('.record-room-pill')].map((node) => node.textContent) })`);
    await screenshot(socket, 'm9_1_8_mobile_records_filtered.png');
    await navigate(socket, '/records/qa-0');
    const details = await evaluate(socket, `({ room: document.querySelector('.room-badge-large')?.textContent, hasPhotoSection: /photo evidence/i.test(document.body.innerText), hasDelivery: /delivery:/i.test(document.body.innerText) })`);
    await screenshot(socket, 'm9_1_8_mobile_details.png');

    const failures = [];
    if (overflowResults.some((result) => result.overflow)) failures.push('horizontal overflow detected');
    if (!home.primaryAction || !home.attention || !home.recent) failures.push('home does not expose operational next actions');
    if (!stats.zoneRows.some((row) => row.includes('3') && row.includes('30%'))) failures.push('zone K is not 3 / 30%');
    if (!stats.zoneRows.some((row) => row.includes('7') && row.includes('70%'))) failures.push('zone V is not 7 / 70%');
    if (stats.rawRows !== 0) failures.push('legacy raw distribution markup remains');
    if (records.detailsLabels !== 0 || records.permanentDeleteButtons !== 0 || records.openMenus !== 0) failures.push('record actions are permanently exposed');
    if (records.cardLinks !== 10) failures.push('record cards are not all tappable');
    if (!filtered.summary?.includes('Zone V · Projector · Synced') || filtered.cards.length !== 1) failures.push('drill-down filters are not explicit/composed');
    if (details.room !== 'K.A-200' || !details.hasPhotoSection || !details.hasDelivery) failures.push('record details are incomplete');
    console.log(JSON.stringify({ overflowResults, home, stats: stats.zoneRows, records, filtered, details, failures }, null, 2));
    socket.close();
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    preview.kill();
    edge.kill();
    await pause(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
