/**
 * 生成 PWA 图标：用 Node 内置 zlib 手写 PNG 编码（签名 + IHDR + IDAT + IEND + CRC32），
 * 不依赖任何图片库。图案为深蓝纯色底 + 金色对角渐变菱形块（游戏主色 #1a1a2e / #c9a96e）。
 *
 * 用法：node script/gen-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 主色：深蓝底 */
const BG = [0x1a, 0x1a, 0x2e];
/** 主色：金色（菱形中心） */
const GOLD = [0xc9, 0xa9, 0x6e];
/** 金色暗端（菱形边缘） */
const GOLD_DARK = [0x8a, 0x6d, 0x3b];
/** 菱形半对角线占图标尺寸比例 */
const DIAMOND_RATIO = 0.38;

/** CRC32 查表 */
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

/**
 * 计算 CRC32。
 *
 * @param buf 输入字节
 * @returns 无符号 32 位校验值
 */
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * 组装一个 PNG chunk（length + type + data + crc）。
 *
 * @param type 4 字节类型名（如 IHDR）
 * @param data chunk 数据
 * @returns 完整 chunk 字节
 */
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * 生成一张正方形 RGB 图标：纯色底 + 中央金色对角渐变菱形。
 *
 * @param size 边长（像素）
 * @returns PNG 完整字节
 */
function makeIcon(size) {
  // 原始像素流：每行前置 1 字节 filter=0，之后是 RGB 三通道
  const raw = Buffer.alloc(size * (1 + size * 3));
  const center = (size - 1) / 2;
  const radius = size * DIAMOND_RATIO;
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - center) + Math.abs(y - center);
      let rgb = BG;
      if (d <= radius) {
        // 菱形内：沿对角线方向亮金 → 暗金渐变
        const t = Math.min(d / radius, 1);
        rgb = [
          Math.round(GOLD[0] + (GOLD_DARK[0] - GOLD[0]) * t),
          Math.round(GOLD[1] + (GOLD_DARK[1] - GOLD[1]) * t),
          Math.round(GOLD[2] + (GOLD_DARK[2] - GOLD[2]) * t),
        ];
      }
      raw[off++] = rgb[0];
      raw[off++] = rgb[1];
      raw[off++] = rgb[2];
    }
  }

  // IHDR：宽/高 + 位深 8 + 颜色类型 2（RGB）+ 压缩/滤波/隔行 0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `pwa-${size}x${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log(`✅ 生成 ${file}（${size}×${size}）`);
}
