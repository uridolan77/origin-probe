#!/usr/bin/env node
/**
 * G2 window sample-size acceptance guard (campaign-only, not part of guard:all).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "genealogies");

const files = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"))
  : [];

if (files.length < 6 || files.length > 8) {
  console.error(`guard-g2-sample-size: FAIL — expected 6–8 genealogies, got ${files.length}`);
  process.exit(1);
}

console.log(`guard-g2-sample-size: ok (${files.length} genealogies)`);
