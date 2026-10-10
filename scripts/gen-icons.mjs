// Generates the PWA icons from a 16x16 pixel peasant head. No dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = '#0b0d14';
const COLOURS = {
  '.': BG,
  H: '#6b4a32', // hood
  h: '#4a3326', // hood shadow
  S: '#c9b99a', // skin
  n: '#6b4a32', // nose shadow
  E: '#0b0d14', // eye
  M: '#5c1a1a', // mouth
  B: '#4a3326', // stubble
};

const HEAD = [
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '...HHhhhhhhHH...',
  '..HHhSSSSSShHH..',
  '..HHSSSSSSSSHH..',
  '..HHSEESSEESHH..',
  '..HHSSSSnSSSHH..',
  '..HHSSSSnSSSHH..',
  '..HHSBSMMSBSHH..',
  '..hHHSBBBBSHHh..',
  '.hhHHHSSSSHHHhh.',
  'hhhhHHHHHHHHhhhh',
  'hhhhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhhhh',
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function render(size, scale) {
  const px = Buffer.alloc(size * size * 4);
  const off = Math.floor((size - 16 * scale) / 2);
  const bg = hex(BG);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / scale);
      const gy = Math.floor((y - off) / scale);
      const inside = x >= off && y >= off && gx < 16 && gy < 16;
      const rgb = inside ? hex(COLOURS[HEAD[gy][gx]]) : bg;
      px.set([...rgb, 255], (y * size + x) * 4);
    }
  }
  return png(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
const icons = {
  'icon-192.png': [192, 12],
  'icon-512.png': [512, 32],
  'maskable-512.png': [512, 20], // head inside the 80% safe zone
  'apple-touch-icon.png': [180, 10],
  'favicon-32.png': [32, 2],
};
for (const [name, [size, scale]] of Object.entries(icons)) {
  writeFileSync(join(out, name), render(size, scale));
}
console.log(`icons: ${Object.keys(icons).join(', ')}`);
