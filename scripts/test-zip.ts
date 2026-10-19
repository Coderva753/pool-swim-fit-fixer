import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { decodeFit } from "../src/fit";
import { extractFitFromZip } from "../src/zip";

interface TestEntry {
  name: string;
  bytes: Uint8Array;
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function makeZip(entries: TestEntry[], method: 0 | 8): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const compressed = method === 8 ? new Uint8Array(deflateRawSync(entry.bytes)) : entry.bytes;
    const local = new Uint8Array(30 + name.byteLength);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, method, true);
    localView.setUint32(18, compressed.byteLength, true);
    localView.setUint32(22, entry.bytes.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.byteLength);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(20, compressed.byteLength, true);
    centralView.setUint32(24, entry.bytes.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);

    localParts.push(local, compressed);
    centralParts.push(central);
    localOffset += local.byteLength + compressed.byteLength;
  }

  const centralDirectory = concatenate(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.byteLength, true);
  endView.setUint32(16, localOffset, true);
  return concatenate([...localParts, centralDirectory, end]);
}

const source = new Uint8Array(readFileSync(new URL("../data/23931263419_ACTIVITY.fit", import.meta.url)));
for (const method of [0, 8] as const) {
  const extracted = await extractFitFromZip(makeZip([
    { name: "garmin/23931263419_ACTIVITY.fit", bytes: source },
  ], method));
  assert.equal(extracted.fileName, "23931263419_ACTIVITY.fit");
  assert.deepEqual(extracted.bytes, source);
  assert.equal(decodeFit(extracted.bytes, extracted.fileName).sourceIntegrity, true);
}

await assert.rejects(
  extractFitFromZip(makeZip([{ name: "readme.txt", bytes: new TextEncoder().encode("none") }], 8)),
  /не найден FIT-файл/,
);
await assert.rejects(
  extractFitFromZip(makeZip([
    { name: "one.fit", bytes: source },
    { name: "two.fit", bytes: source },
  ], 8)),
  /только один FIT-файл/,
);

console.log("ZIP support tests passed (stored, deflate, missing FIT, multiple FIT).");
