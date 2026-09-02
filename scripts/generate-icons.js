import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, drawPixel) {
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth: 8
  ihdrData.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // compression: 0 (deflate)
  ihdrData.writeUInt8(0, 11); // filter: 0
  ihdrData.writeUInt8(0, 12); // interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // 3. IDAT Chunk (Raw scanlines with filter byte 0)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData.writeUInt8(0, rowOffset); // filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixel(x, y, width, height);
      rawData.writeUInt8(r, pixelOffset);
      rawData.writeUInt8(g, pixelOffset + 1);
      rawData.writeUInt8(b, pixelOffset + 2);
      rawData.writeUInt8(a, pixelOffset + 3);
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // 4. IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = zlib.crc32(typeAndData);
  chunk.writeUInt32BE(crc >>> 0, 8 + length);
  return chunk;
}

// Pixel generator for VKU Field Survey icon:
// Brand theme color: #0284C7 (R=2, G=132, B=199)
// White inspection symbol in the center: rounded clipboard board with inner checklist lines
function vkuIconPixel(x, y, width, height) {
  const normX = x / width;
  const normY = y / height;

  // Background: rounded rectangle #0284C7
  const cornerRadius = 0.18;
  let inBackground = true;
  if (normX < cornerRadius && normY < cornerRadius) {
    const dx = normX - cornerRadius;
    const dy = normY - cornerRadius;
    if (dx * dx + dy * dy > cornerRadius * cornerRadius) inBackground = false;
  } else if (normX > 1 - cornerRadius && normY < cornerRadius) {
    const dx = normX - (1 - cornerRadius);
    const dy = normY - cornerRadius;
    if (dx * dx + dy * dy > cornerRadius * cornerRadius) inBackground = false;
  } else if (normX < cornerRadius && normY > 1 - cornerRadius) {
    const dx = normX - cornerRadius;
    const dy = normY - (1 - cornerRadius);
    if (dx * dx + dy * dy > cornerRadius * cornerRadius) inBackground = false;
  } else if (normX > 1 - cornerRadius && normY > 1 - cornerRadius) {
    const dx = normX - (1 - cornerRadius);
    const dy = normY - (1 - cornerRadius);
    if (dx * dx + dy * dy > cornerRadius * cornerRadius) inBackground = false;
  }

  if (!inBackground) {
    return [0, 0, 0, 0]; // Transparent outside outer rounded corner
  }

  // Base brand color: #0284C7
  const r = 2,
    g = 132,
    b = 199,
    a = 255;

  // Clipboard body: center rectangle [0.25 .. 0.75] x [0.24 .. 0.82]
  const boardLeft = 0.25,
    boardRight = 0.75,
    boardTop = 0.24,
    boardBottom = 0.82;
  const isInsideBoard =
    normX >= boardLeft && normX <= boardRight && normY >= boardTop && normY <= boardBottom;

  // Clipboard clip at the top: [0.38 .. 0.62] x [0.17 .. 0.28]
  const isClip = normX >= 0.38 && normX <= 0.62 && normY >= 0.17 && normY <= 0.28;

  // Board outline (white stroke ~ 0.045 thick)
  const boardBorder = 0.045;
  const isBoardBorder =
    isInsideBoard &&
    (normX < boardLeft + boardBorder ||
      normX > boardRight - boardBorder ||
      normY < boardTop + boardBorder ||
      normY > boardBottom - boardBorder);

  // Checkmark in the center
  const isCheckmark = isPointOnCheckmark(normX, normY);

  // Checklist line
  const isLine1 = normX >= 0.36 && normX <= 0.64 && normY >= 0.36 && normY <= 0.4;

  if (isClip || isBoardBorder || isCheckmark || isLine1) {
    return [255, 255, 255, 255]; // Crisp pure white
  }

  return [r, g, b, a];
}

function isPointOnCheckmark(px, py) {
  const thickness = 0.038;
  return (
    distToSegment(px, py, 0.36, 0.55, 0.47, 0.66) < thickness ||
    distToSegment(px, py, 0.47, 0.66, 0.65, 0.46) < thickness
  );
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

const outDir = path.resolve('public');
fs.mkdirSync(outDir, { recursive: true });

const pwa192 = createPng(192, 192, vkuIconPixel);
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), pwa192);
console.log('Created public/pwa-192x192.png (bytes:', pwa192.length, ')');

const pwa512 = createPng(512, 512, vkuIconPixel);
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), pwa512);
console.log('Created public/pwa-512x512.png (bytes:', pwa512.length, ')');

// Also create favicon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1 2-2h2" />
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#0284C7" stroke="#0284C7" />
  <path d="m9 14 2 2 4-4" stroke="#0284C7" />
</svg>\\n`;
fs.writeFileSync(path.join(outDir, 'favicon.svg'), svg);
console.log('Created public/favicon.svg');
