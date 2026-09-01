#!/usr/bin/env node
/**
 * Clean-room denylist scan.
 *
 * Documented exception: the intentional public canonical hostname
 * `origin.ontogony.net` may appear as an exact contiguous string. Brand
 * tokens outside that exact hostname remain prohibited.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLEANROOM_ALLOWED_EXACT_HOSTS,
  isApprovedHostAllowList,
  maskAllowedHosts,
} from "./lib/cleanroom-policy.mjs";

export {
  CLEANROOM_ALLOWED_EXACT_HOSTS,
  isApprovedHostAllowList,
  maskAllowedHosts,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const denylistPath = path.join(root, "tools", "denylist.json");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "out",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
]);

const SKIP_FILES = new Set(["denylist.json", "package-lock.json"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const denylist = JSON.parse(fs.readFileSync(denylistPath, "utf8"));
const patterns = denylist.patterns.map((p) => {
  const decoded = Buffer.from(p.pattern, "base64").toString("utf8");
  return {
    id: p.id,
    mode: p.mode || "literal",
    decoded,
  };
});

const files = walk(root).filter((f) => {
  const base = path.basename(f);
  if (SKIP_FILES.has(base)) return false;
  if (f.includes(`${path.sep}tools${path.sep}denylist.json`)) return false;
  return true;
});

let failed = false;

if (!isApprovedHostAllowList(CLEANROOM_ALLOWED_EXACT_HOSTS)) {
  failed = true;
  console.error(
    "cleanroom hit: CLEANROOM_ALLOWED_EXACT_HOSTS broadened beyond exact public hostname",
  );
}

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue;

  const scanned = maskAllowedHosts(text);

  for (const p of patterns) {
    let hit = false;
    if (p.mode === "regex") {
      try {
        const re = new RegExp(p.decoded, "i");
        hit = re.test(scanned);
      } catch {
        hit = scanned.toLowerCase().includes(p.decoded.toLowerCase());
      }
    } else {
      hit = scanned.toLowerCase().includes(p.decoded.toLowerCase());
    }
    if (hit) {
      failed = true;
      console.error(
        `cleanroom hit: ${path.relative(root, file)} matched denylist id ${p.id}`,
      );
    }
  }
}

if (failed) {
  console.error("cleanroom-scan: failed");
  process.exit(1);
}
console.log(`cleanroom-scan: ok (${files.length} files, ${patterns.length} patterns)`);
