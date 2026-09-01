#!/usr/bin/env node
/**
 * Import signed concept publication bundle (tsx entry).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(root, "tools/import-concept-publication.ts"), ...args],
  { stdio: "inherit", cwd: root, shell: false },
);
process.exit(result.status ?? 1);
