/**
 * 生成 OG 分享图（1200×630）：深蓝渐变底 + 金色柔光 + 「LIFE · SIMULATOR」像素字。
 * 与 gen-icons.mjs 相同，用 Node 内置 zlib 手写 PNG，不依赖图片库。
 * 用法：node script/gen-og.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1200;
const H = 630;
const TOP = [26, 26, 48];       // #1a1a30
const BOTTOM = [10, 10, 20];    // #0a0a14
const GOLD = [201, 169, 110];   // #c9a96e

// 5×7 像素字（5 位/行，bit4 为最左）
const FONT = {
  L: [16, 16, 16, 16, 16, 16, 31],
  I: [14, 4, 4, 4, 4, 4, 14],
  F: [31, 16, 16, 30, 16, 16, 16],
  E: [31, 16, 16, 30, 16, 16, 31],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 4, 0, 0, 0],
  S: [15, 16, 16, 14, 1, 1, 30],
  M: [17, 27, 21, 21, 17, 17, 17],
  U: [17, 17, 17, 17, 17, 17, 14],
  A: [14, 17, 17, 31, 17, 17, 17],
  T: [31, 4, 4, 4, 4, 4, 4],
  O: [14, 17, 17, 17, 17, 17, 14],
  R: [30, 17, 17, 30, 18, 17, 17],
};

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const TEXT = 'LIFE . SIMULATOR';
const SCALE = 10;
const GLYPH_W = 5 * SCALE;
const GLYPH_H = 7 * SCALE;
const GAP = SCALE;
const TOTAL_W = TEXT.length * (GLYPH_W + GAP) - GAP;
const START_X = Math.floor((W - TOTAL_W) / 2);
const TEXT_Y = Math.floor((H - GLYPH_H) / 2);

const raw = Buffer.alloc(H * (1 + W * 3));
let off = 0;
for (let y = 0; y < H; y++) {
  raw[off++] = 0;
  for (let x = 0; x < W; x++) {
    // 纵向渐变
    const t = y / (H - 1);
    let r = TOP[0] + (BOTTOM[0] - TOP[0]) * t;
    let g = TOP[1] + (BOTTOM[1] - TOP[1]) * t;
    let b = TOP[2] + (BOTTOM[2] - TOP[2]) * t;

    // 中心金色柔光（偏上，让文字区更亮）
    const dx = x - W / 2;
    const dy = y - H * 0.44;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, 1 - dist / (H * 0.55));
    r += GOLD[0] * glow * 0.24;
    g += GOLD[1] * glow * 0.24;
    b += GOLD[2] * glow * 0.24;

    // 像素字
    const gx = Math.floor((x - START_X) / (GLYPH_W + GAP));
    const px = (x - START_X) % (GLYPH_W + GAP);
    if (gx >= 0 && gx < TEXT.length && px < GLYPH_W) {
      const cy = Math.floor((y - TEXT_Y) / SCALE);
      const cx = Math.floor(px / SCALE);
      const glyph = FONT[TEXT[gx]];
      if (glyph && cy >= 0 && cy < 7 && (glyph[cy] & (1 << (4 - cx)))) {
        r = GOLD[0];
        g = GOLD[1];
        b = GOLD[2];
      }
    }

    raw[off++] = Math.round(Math.min(255, r));
    raw[off++] = Math.round(Math.min(255, g));
    raw[off++] = Math.round(Math.min(255, b));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');
writeFileSync(out, png);
console.log(`✅ 生成 ${out}（${W}×${H}）`);
