import fs from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node inspect-png.mjs <path>");
  process.exit(1);
}
const buf = fs.readFileSync(path);
console.log("size_bytes", buf.length);
console.log(
  "signature_ok",
  buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a"
);
let i = 8;
const chunks = [];
while (i < buf.length) {
  const len = buf.readUInt32BE(i);
  const type = buf.slice(i + 4, i + 8).toString("ascii");
  chunks.push({ type, len, off: i });
  if (type === "IHDR") {
    const w = buf.readUInt32BE(i + 8);
    const h = buf.readUInt32BE(i + 12);
    const bd = buf[i + 16];
    const ct = buf[i + 17];
    const ctName =
      { 0: "Gray", 2: "RGB", 3: "Indexed", 4: "GrayA", 6: "RGBA" }[ct] ?? "?";
    console.log(`IHDR width=${w} height=${h} bit_depth=${bd} color_type=${ct} (${ctName})`);
  }
  if (type === "tRNS") {
    console.log(`tRNS (transparency chunk) length=${len}`);
  }
  i += 12 + len;
  if (type === "IEND") break;
}
console.log("chunks:", chunks.map((c) => c.type).join(","));
