const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const icoBuf = fs.readFileSync(path.join(__dirname, '../icon.ico'));
fs.writeFileSync(path.join(__dirname, '../src-tauri/icons/icon.ico'), icoBuf);

// Parse ICO
const count = icoBuf.readUInt16LE(4);
const offset = 6;
const w = icoBuf.readUInt8(offset) || 256;
const h = icoBuf.readUInt8(offset + 1) || 256;
const imgOffset = icoBuf.readUInt32LE(offset + 12);
const imgSize = icoBuf.readUInt32LE(offset + 8);

const headerSize = icoBuf.readUInt32LE(imgOffset);
const bmpWidth = icoBuf.readInt32LE(imgOffset + 4);
const bmpHeight = Math.abs(icoBuf.readInt32LE(imgOffset + 8)) / 2; // In ICO, height is doubled for AND mask
const bpp = icoBuf.readUInt16LE(imgOffset + 14);

console.log(`Parsed ICO image: ${bmpWidth}x${bmpHeight}, bpp: ${bpp}`);

// Extract RGBA buffer
const pixelDataOffset = imgOffset + headerSize;
const rawPixels = Buffer.alloc(bmpWidth * bmpHeight * 4);

for (let y = 0; y < bmpHeight; y++) {
  // BMP stores bottom-up
  const srcY = bmpHeight - 1 - y;
  const srcRowOffset = pixelDataOffset + srcY * (bmpWidth * 4);
  const dstRowOffset = y * (bmpWidth * 4);

  for (let x = 0; x < bmpWidth; x++) {
    const srcPx = srcRowOffset + x * 4;
    const dstPx = dstRowOffset + x * 4;
    const b = icoBuf[srcPx];
    const g = icoBuf[srcPx + 1];
    const r = icoBuf[srcPx + 2];
    const a = icoBuf[srcPx + 3];
    rawPixels[dstPx] = r;
    rawPixels[dstPx + 1] = g;
    rawPixels[dstPx + 2] = b;
    rawPixels[dstPx + 3] = a;
  }
}

// Helper to make a square N x N RGBA buffer by centering & bilinear/nearest scaling
function createSquareImage(targetSize) {
  const targetBuf = Buffer.alloc(targetSize * targetSize * 4, 0);
  
  // Calculate aspect-fit scaling
  const scale = Math.min(targetSize / bmpWidth, targetSize / bmpHeight);
  const scaledW = Math.round(bmpWidth * scale);
  const scaledH = Math.round(bmpHeight * scale);
  const startX = Math.floor((targetSize - scaledW) / 2);
  const startY = Math.floor((targetSize - scaledH) / 2);

  for (let dy = 0; dy < scaledH; dy++) {
    const sy = Math.min(Math.floor(dy / scale), bmpHeight - 1);
    for (let dx = 0; dx < scaledW; dx++) {
      const sx = Math.min(Math.floor(dx / scale), bmpWidth - 1);
      const srcIdx = (sy * bmpWidth + sx) * 4;
      const dstIdx = ((startY + dy) * targetSize + (startX + dx)) * 4;

      targetBuf[dstIdx] = rawPixels[srcIdx];
      targetBuf[dstIdx + 1] = rawPixels[srcIdx + 1];
      targetBuf[dstIdx + 2] = rawPixels[srcIdx + 2];
      targetBuf[dstIdx + 3] = rawPixels[srcIdx + 3];
    }
  }

  return targetBuf;
}

// CRC32 Table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePNG(size, rgbaBuffer) {
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter 0
    const srcOffset = y * (size * 4);
    rgbaBuffer.copy(rawData, rowOffset + 1, srcOffset, srcOffset + size * 4);
  }

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '../src-tauri/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const targetSizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

for (const { name, size } of targetSizes) {
  const squareRgba = createSquareImage(size);
  const png = encodePNG(size, squareRgba);
  fs.writeFileSync(path.join(iconsDir, name), png);
}

// Also save an app icon for web / settings modal
fs.writeFileSync(path.join(__dirname, '../src/assets/app-icon.png'), encodePNG(128, createSquareImage(128)));

console.log('Successfully generated all icon assets from user icon.ico!');
