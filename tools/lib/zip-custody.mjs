/**
 * Archive-first ZIP custody helpers (no third-party zip dependency).
 * Supports stored and deflate entries; rejects traversal, absolute paths, and symlinks.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function readU32(buf, off) {
  return buf.readUInt32LE(off);
}
function readU16(buf, off) {
  return buf.readUInt16LE(off);
}

/**
 * Parse central directory and return entry metadata. Does not extract.
 */
export function listZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (readU32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid ZIP: EOCD not found");
  const totalEntries = readU16(buf, eocd + 10);
  const cdOffset = readU32(buf, eocd + 16);
  const entries = [];
  let off = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (readU32(buf, off) !== 0x02014b50) {
      throw new Error("Invalid ZIP: central directory signature");
    }
    const compression = readU16(buf, off + 10);
    const compressedSize = readU32(buf, off + 20);
    const uncompressedSize = readU32(buf, off + 24);
    const nameLen = readU16(buf, off + 28);
    const extraLen = readU16(buf, off + 30);
    const commentLen = readU16(buf, off + 32);
    const externalAttrs = readU32(buf, off + 38);
    const localHeaderOffset = readU32(buf, off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    const isSymlink = ((externalAttrs >>> 16) & 0o170000) === 0o120000;
    if (isSymlink) throw new Error(`ZIP symlink rejected: ${name}`);
    if (name.includes("..") || path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) {
      throw new Error(`ZIP traversal rejected: ${name}`);
    }
    if (uncompressedSize > 50 * 1024 * 1024) {
      throw new Error(`ZIP entry too large: ${name}`);
    }
    entries.push({
      name: name.replace(/\\/g, "/"),
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      isDirectory: name.endsWith("/"),
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipEntry(zipPath, entryName) {
  const buf = fs.readFileSync(zipPath);
  const entries = listZipEntries(zipPath);
  const entry = entries.find((e) => e.name === entryName);
  if (!entry || entry.isDirectory) {
    throw new Error(`ZIP entry missing: ${entryName}`);
  }
  const localOff = entry.localHeaderOffset;
  if (readU32(buf, localOff) !== 0x04034b50) {
    throw new Error(`Invalid local header: ${entryName}`);
  }
  const nameLen = readU16(buf, localOff + 26);
  const extraLen = readU16(buf, localOff + 28);
  const dataStart = localOff + 30 + nameLen + extraLen;
  const compressed = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compression === 0) {
    return Buffer.from(compressed);
  }
  if (entry.compression === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(
    `Unsupported ZIP compression ${entry.compression} for ${entryName}`,
  );
}

export function extractZipToTemp(zipPath, expectedNames) {
  const entries = listZipEntries(zipPath);
  const fileEntries = entries.filter((e) => !e.isDirectory);
  const names = fileEntries.map((e) => e.name).sort();
  if (expectedNames) {
    const expected = [...expectedNames].sort();
    if (
      names.length !== expected.length ||
      names.some((n, i) => n !== expected[i])
    ) {
      throw new Error(
        `ZIP exact-set mismatch: got [${names.join(",")}] expected [${expected.join(",")}]`,
      );
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "origin-zip-"));
  for (const entry of fileEntries) {
    const dest = path.join(dir, entry.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, readZipEntry(zipPath, entry.name));
  }
  return { dir, names };
}

export function destroyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Build a minimal STORED (no compression) ZIP for tests. */
export function writeStoredZip(zipPath, files) {
  const locals = [];
  const chunks = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(content);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc optional for tests
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push({
      name,
      nameBuf,
      data,
      localHeaderOffset: offset,
    });
    chunks.push(local, data);
    offset += local.length + data.length;
  }
  const cdChunks = [];
  let cdSize = 0;
  for (const loc of locals) {
    const cd = Buffer.alloc(46 + loc.nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(loc.data.length, 20);
    cd.writeUInt32LE(loc.data.length, 24);
    cd.writeUInt16LE(loc.nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(loc.localHeaderOffset, 42);
    loc.nameBuf.copy(cd, 46);
    cdChunks.push(cd);
    cdSize += cd.length;
  }
  const cdOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(locals.length, 8);
  eocd.writeUInt16LE(locals.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, Buffer.concat([...chunks, ...cdChunks, eocd]));
}
