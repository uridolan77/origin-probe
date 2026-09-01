#!/usr/bin/env node
/**
 * Concept publication guard (tsx entry).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", path.join(root, "tools/guard-concept-publication.ts")],
  { stdio: "inherit", cwd: root, shell: false },
);
process.exit(result.status ?? 1);
