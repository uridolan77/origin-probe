#!/usr/bin/env node
/**
 * Flags absolute-priority wording in product copy and genealogy findings.
 * Patterns are described generically — they do not embed example absolute claim sentences.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_ROOTS = ["src", "data", "docs"];

/** Regexes for absolute certainty / first-use marketing language. */
const ABSOLUTE_PATTERNS = [
  /\bthe\s+very\s+first\s+use\b/i,
  /\bworld'?s?\s+first\s+use\b/i,
  /\bfirst\s+ever\s+(?:use|occurrence|appearance)\b/i,
  /\bno\s+earlier\s+(?:use|occurrence)\s+exists\b/i,
  /\bdefinitive\s+first\s+(?:use|coinage)\b/i,
  /\bunquestionably\s+the\s+first\b/i,
  /\bthe\s+first\s+use\s+was\b/i,
  /\bthe\s+actual\s+origin\s+is\b/i,
  /\bthis\s+definitively\s+came\s+from\b/i,
  /\bthe\s+true\s+author\s+is\b/i,
  /\bx\s+originated\s+this\b/i,
  /\boriginated\s+this\s+phrase\b/i,
];

const SKIP = new Set(["node_modules", ".git", "out", ".next", "coverage"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|md|json|css|mjs|cjs)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let failed = false;
for (const rel of SCAN_ROOTS) {
  const files = walk(path.join(root, rel));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const re of ABSOLUTE_PATTERNS) {
      const m = text.match(re);
      if (m) {
        failed = true;
        console.error(`absolute claim language in ${path.relative(root, file)}: /${re.source}/ matched "${m[0]}"`);
      }
    }
  }
}

if (failed) process.exit(1);
console.log("guard-absolutes: ok");
