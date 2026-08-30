const fs = require('fs');
const path = require('path');

// BMP Encoder for 24-bit uncompressed RGB
function createBMP(width, height, pixelGenerator) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;

  const buf = Buffer.alloc(fileSize);

  // File Header
  buf.write('BM', 0); // Magic
  buf.writeUInt32LE(fileSize, 2); // File size
  buf.writeUInt32LE(0, 6); // Reserved
  buf.writeUInt32LE(54, 10); // Offset to pixel data

  // DIB Header (BITMAPINFOHEADER)
  buf.writeUInt32LE(40, 14); // Header size
  buf.writeInt32LE(width, 18); // Width
  buf.writeInt32LE(height, 22); // Height (positive = bottom-up)
  buf.writeUInt16LE(1, 26); // Color planes
  buf.writeUInt16LE(24, 28); // Bits per pixel
  buf.writeUInt32LE(0, 30); // Compression (0 = BI_RGB)
  buf.writeUInt32LE(imageSize, 34); // Image size
  buf.writeInt32LE(2835, 38); // X pixels per meter (~72 DPI)
  buf.writeInt32LE(2835, 42); // Y pixels per meter
  buf.writeUInt32LE(0, 46); // Total colors
  buf.writeUInt32LE(0, 50); // Important colors

  // Pixels (stored bottom-up, BGR format)
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      // Invert Y coordinate so generator receives top-down (0 = top)
      const topDownY = height - 1 - y;
      const { r, g, b } = pixelGenerator(x, topDownY, width, height);
      const pxOffset = rowOffset + x * 3;
      buf[pxOffset] = b;
      buf[pxOffset + 1] = g;
      buf[pxOffset + 2] = r;
    }
  }

  return buf;
}

// 1. Generate Sidebar Image (164 x 314)
// Sleek dark charcoal background with #0399F7 glowing vertical accent and glowing "K" logo motif
function sidebarPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background base gradient (dark slate to deep charcoal)
  let r = 22 + Math.floor(10 * ny);
  let g = 26 + Math.floor(12 * ny);
  let b = 34 + Math.floor(16 * ny);

  // Top-center glowing aura around logo (center around x=82, y=90)
  const dx = (x - 82) / 45;
  const dy = (y - 90) / 45;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1.0) {
    const glow = Math.pow(1.0 - dist, 1.5);
    r = Math.min(255, r + Math.floor(3 * glow * 1.5));
    g = Math.min(255, g + Math.floor(153 * glow * 0.9));
    b = Math.min(255, b + Math.floor(247 * glow * 0.95));
  }

  // Draw minimalist "K" shape in center (x: 55-110, y: 60-120)
  if (x >= 62 && x <= 72 && y >= 65 && y <= 115) {
    // Vertical stem of K
    r = 3; g = 153; b = 247;
  }
  // Upper arm of K
  const upperArmDist = Math.abs((y - 90) - (68 - x));
  if (x >= 70 && x <= 104 && y >= 65 && y <= 92 && upperArmDist < 6) {
    r = 3; g = 153; b = 247;
  }
  // Lower leg of K
  const lowerLegDist = Math.abs((y - 90) - (x - 72));
  if (x >= 70 && x <= 104 && y >= 88 && y <= 115 && lowerLegDist < 6) {
    r = 3; g = 153; b = 247;
  }

  // Right edge subtle cyan border line
  if (x === w - 1) {
    r = 3; g = 153; b = 247;
  } else if (x === w - 2) {
    r = 2; g = 80; b = 140;
  }

  return { r, g, b };
}

// 2. Generate Header Image (150 x 57)
function headerPixel(x, y, w, h) {
  // Deep dark header with glowing right-side icon
  let r = 24;
  let g = 29;
  let b = 38;

  // Small "K" icon on right side (x: 110-140, y: 12-45)
  const dx = (x - 125) / 18;
  const dy = (y - 28) / 18;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1.0) {
    const glow = Math.pow(1.0 - dist, 1.2);
    r = Math.min(255, r + Math.floor(3 * glow));
    g = Math.min(255, g + Math.floor(153 * glow * 0.7));
    b = Math.min(255, b + Math.floor(247 * glow * 0.8));
  }

  // Mini K symbol
  if (x >= 118 && x <= 122 && y >= 18 && y <= 38) {
    r = 3; g = 153; b = 247;
  }
  const upperDist = Math.abs((y - 28) - (121 - x));
  if (x >= 121 && x <= 133 && y >= 18 && y <= 29 && upperDist < 3) {
    r = 3; g = 153; b = 247;
  }
  const lowerDist = Math.abs((y - 28) - (x - 122));
  if (x >= 121 && x <= 133 && y >= 27 && y <= 38 && lowerDist < 3) {
    r = 3; g = 153; b = 247;
  }

  // Bottom edge border
  if (y === h - 1) {
    r = 40; g = 48; b = 62;
  }

  return { r, g, b };
}

const iconsDir = path.join(__dirname, '../src-tauri/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sidebarBMP = createBMP(164, 314, sidebarPixel);
fs.writeFileSync(path.join(iconsDir, 'installer-sidebar.bmp'), sidebarBMP);

const headerBMP = createBMP(150, 57, headerPixel);
fs.writeFileSync(path.join(iconsDir, 'installer-header.bmp'), headerBMP);

console.log('Successfully created NSIS installer sidebar and header bitmaps!');
