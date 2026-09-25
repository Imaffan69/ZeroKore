/**
 * Generates the ZeroKore desktop icon as a 1024Ã—1024 PNG.
 *
 * Written by hand because this machine has no image libraries installed â€” no
 * sharp, no canvas, no ImageMagick. The drawing is done into a raw RGBA buffer
 * and encoded with Node's built-in zlib, so the icon can be regenerated on a
 * clean checkout with zero extra dependencies.
 *
 * The mark matches the product: pure-black rounded square, a soft sage ring, and
 * the mint/sage bolt used across the site and the landing nav.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 1024;

const BLACK = [0, 0, 0];
const SAGE = [181, 207, 160]; // #b5cfa0
const MINT = [74, 222, 128]; // #4ade80

/** Transparent RGBA buffer. */
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // Source-over composite so antialiased edges blend correctly.
  const a = alpha / 255;
  pixels[i] = Math.round(pixels[i] * (1 - a) + r * a);
  pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + g * a);
  pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + b * a);
  pixels[i + 3] = Math.max(pixels[i + 3], alpha);
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Even-odd fill of a polygon with a small feather for smooth edges. */
function fillPolygon(points, color, feather = 1.5) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const pad = Math.ceil(feather) + 1;
  const samples = 3;
  for (let y = Math.floor(minY) - pad; y <= Math.ceil(maxY) + pad; y += 1) {
    for (let x = Math.floor(minX) - pad; x <= Math.ceil(maxX) + pad; x += 1) {
      // A pixel whose centre is inside the polygon is fully covered. Skipping
      // those would leave only the outline drawn, which is what made the first
      // render show a hollow bolt.
      if (pointInPolygon(x, y, points)) {
        setPixel(x, y, color, 255);
        continue;
      }
      // Otherwise only edge pixels pick up partial coverage.
      let hits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + ((sx + 0.5) / samples - 0.5) * feather;
          const py = y + ((sy + 0.5) / samples - 0.5) * feather;
          if (pointInPolygon(px, py, points)) hits += 1;
        }
      }
      if (hits > 0) {
        setPixel(x, y, color, Math.round((hits / (samples * samples)) * 255));
      }
    }
  }
}

/** Rounded-rectangle background with antialiased corners. */
function fillRoundedRect(x0, y0, w, h, radius, color) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const px = x0 + x;
      const py = y0 + y;
      const cx = Math.min(Math.max(px, x0 + radius), x0 + w - radius);
      const cy = Math.min(Math.max(py, y0 + radius), y0 + h - radius);
      const d = Math.hypot(px - cx, py - cy);
      const alpha = Math.round(Math.max(0, Math.min(1, radius - d + 0.5)) * 255);
      if (alpha > 0) setPixel(px, py, color, alpha);
    }
  }
}

/** Ring outline â€” the faint halo behind the bolt. */
function strokeRing(cx, cy, radius, thickness, color) {
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  for (let y = Math.floor(cy - outer) - 2; y <= Math.ceil(cy + outer) + 2; y += 1) {
    for (let x = Math.floor(cx - outer) - 2; x <= Math.ceil(cx + outer) + 2; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= outer && d >= inner) setPixel(x, y, color, 255);
    }
  }
}

function draw() {
  // Background: pure black rounded square (matches the window backgroundColor).
  fillRoundedRect(0, 0, SIZE, SIZE, Math.round(SIZE * 0.22), BLACK);

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Sage ring â€” a whisper, not a border.
  strokeRing(cx, cy, SIZE * 0.375, SIZE * 0.006, SAGE);

  const s = SIZE / 1024;
  // The bolt, sage bodyâ€¦
  const bolt = [
    [575 * s, 176 * s],
    [330 * s, 556 * s],
    [474 * s, 556 * s],
    [418 * s, 848 * s],
    [694 * s, 452 * s],
    [545 * s, 452 * s],
  ];
  fillPolygon(bolt, SAGE, 2.2);

  // â€¦with a mint highlight on the upper-left face.
  const highlight = [
    [575 * s, 176 * s],
    [330 * s, 556 * s],
    [470 * s, 556 * s],
  ];
  fillPolygon(highlight, MINT, 2.2);
}

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  // Each scanline is prefixed with a filter byte (0 = none).
  const stride = SIZE * 4 + 1;
  const raw = Buffer.alloc(stride * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "build");
fs.mkdirSync(outDir, { recursive: true });
draw();
const png = encodePng();
const out = path.join(outDir, "icon.png");
fs.writeFileSync(out, png);
// electron-builder picks the PNG up and converts it to .ico during packaging.
console.log(`Wrote ${out} (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} kB)`);
