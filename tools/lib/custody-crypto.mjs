/**
 * AES-256-GCM custody encryption for Candidate 005 sealed ZIP artifacts.
 *
 * File format (binary):
 *   magic      : 8 bytes  "ORIGCUST"
 *   version    : 1 byte   0x01
 *   salt       : 16 bytes
 *   iv         : 12 bytes
 *   ciphertext : remaining bytes including 16-byte GCM auth tag at end
 *
 * Key derivation: scrypt(passphrase, salt, N=16384, r=8, p=1, keylen=32)
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";

export const CUSTODY_MAGIC = Buffer.from("ORIGCUST", "ascii");
export const CUSTODY_VERSION = 0x01;
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 32;
const TAG_LEN = 16;

export function deriveCustodyKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export function encryptCustodyBlob(plaintext, passphrase) {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveCustodyKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([CUSTODY_MAGIC, Buffer.from([CUSTODY_VERSION]), salt, iv, encrypted, tag]);
}

export function decryptCustodyBlob(blob, passphrase) {
  if (blob.length < 8 + 1 + SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error("Custody blob too short");
  }
  if (!blob.subarray(0, 8).equals(CUSTODY_MAGIC)) {
    throw new Error("Custody blob magic mismatch");
  }
  if (blob[8] !== CUSTODY_VERSION) {
    throw new Error(`Unsupported custody blob version: ${blob[8]}`);
  }
  const salt = blob.subarray(9, 9 + SALT_LEN);
  const iv = blob.subarray(9 + SALT_LEN, 9 + SALT_LEN + IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ciphertext = blob.subarray(9 + SALT_LEN + IV_LEN, blob.length - TAG_LEN);
  const key = deriveCustodyKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptCustodyFile(inputPath, outputPath, passphrase) {
  const plaintext = fs.readFileSync(inputPath);
  fs.mkdirSync(pathDirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, encryptCustodyBlob(plaintext, passphrase));
}

export function decryptCustodyFile(inputPath, outputPath, passphrase) {
  const blob = fs.readFileSync(inputPath);
  const plaintext = decryptCustodyBlob(blob, passphrase);
  fs.mkdirSync(pathDirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, plaintext);
  return plaintext;
}

function pathDirname(p) {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(0, idx) : ".";
}
