// One-off: shrink a white-on-transparent PNG to a small inline asset.
// usage: node scripts/shrinkLogo.cjs in.png out.png factor
const fs = require('fs');
const zlib = require('zlib');
const [, , inPath, outPath, factorArg] = process.argv;
const factor = parseInt(factorArg || '4', 10);
const buf = fs.readFileSync(inPath);
let pos = 8, width, height, bitDepth, colorType, idat = [], palette, trns;
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.slice(pos + 8, pos + 8 + len);
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12]) throw new Error('interlaced'); }
  else if (type === 'PLTE') palette = data;
  else if (type === 'tRNS') trns = data;
  else if (type === 'IDAT') idat.push(data);
  pos += 12 + len;
}
if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
const bpp = { 6: 4, 2: 3, 3: 1, 4: 2, 0: 1 }[colorType];
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * bpp;
const px = Buffer.alloc(height * stride);
for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)];
  const src = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? px[y * stride + x - bpp] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
    let v = src[x];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    px[y * stride + x] = v & 255;
  }
}
const alphaAt = (x, y) => {
  const i = y * stride + x * bpp;
  if (colorType === 6) return px[i + 3];
  if (colorType === 4) return px[i + 1];
  if (colorType === 3) return trns && px[i] < trns.length ? trns[px[i]] : 255;
  return 255;
};
const W = Math.floor(width / factor), H = Math.floor(height / factor);
const out = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  out[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) s += alphaAt(x * factor + dx, y * factor + dy);
    const o = y * (W * 4 + 1) + 1 + x * 4;
    out[o] = 255; out[o + 1] = 255; out[o + 2] = 255; out[o + 3] = Math.round(s / (factor * factor));
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(outPath, png);
console.log(JSON.stringify({ in: [width, height, colorType], out: [W, H], bytes: png.length }));
