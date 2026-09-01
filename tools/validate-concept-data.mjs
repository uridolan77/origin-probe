#!/usr/bin/env node
/**
 * Validate concept catalog and publication membrane (tsx entry).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(root, "tools/validate-concept-data.ts")],
  { stdio: "inherit", cwd: root, shell: false },
);
process.exit(result.status ?? 1);
