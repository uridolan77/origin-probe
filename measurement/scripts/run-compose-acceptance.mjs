/**
 * Bring up dual-API + Postgres compose and run hosted acceptance (20 scenarios).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env.acceptance");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function ensureAcceptanceEnv() {
  const existing = loadEnv(envPath);
  const env = {
    MEASUREMENT_HMAC_SECRET:
      existing.MEASUREMENT_HMAC_SECRET ||
      process.env.MEASUREMENT_HMAC_SECRET ||
      crypto.randomBytes(32).toString("hex"),
    MEASUREMENT_CLIENT_SALT:
      existing.MEASUREMENT_CLIENT_SALT ||
      process.env.MEASUREMENT_CLIENT_SALT ||
      crypto.randomBytes(32).toString("hex"),
    MEASUREMENT_ADMIN_KEY:
      existing.MEASUREMENT_ADMIN_KEY ||
      process.env.MEASUREMENT_ADMIN_KEY ||
      crypto.randomBytes(24).toString("hex"),
    MEASUREMENT_ALLOWED_ORIGIN:
      existing.MEASUREMENT_ALLOWED_ORIGIN ||
      process.env.MEASUREMENT_ALLOWED_ORIGIN ||
      "https://uridolan77.github.io",
    MEASUREMENT_RUN_ID:
      existing.MEASUREMENT_RUN_ID ||
      process.env.MEASUREMENT_RUN_ID ||
      "ORIGIN-G2R-ACCEPTANCE",
    MEASUREMENT_OPERATOR_RAW:
      existing.MEASUREMENT_OPERATOR_RAW ||
      process.env.MEASUREMENT_OPERATOR_RAW ||
      "operator-profile-aaaaaaaa",
  };
  const body = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(envPath, body + "\n", "utf8");
  return env;
}

const env = ensureAcceptanceEnv();
const operatorRaw = env.MEASUREMENT_OPERATOR_RAW || "operator-profile-aaaaaaaa";
const operatorHash = createHmac("sha256", env.MEASUREMENT_CLIENT_SALT)
  .update(operatorRaw)
  .digest("hex");

const composeEnv = {
  ...process.env,
  ...env,
  MEASUREMENT_OPERATOR_HASHES: operatorHash,
};

console.log("operatorHash", operatorHash.slice(0, 16) + "…");
console.log("compose up --build …");

let r = spawnSync(
  "docker",
  ["compose", "--env-file", ".env.acceptance", "up", "--build", "-d", "--force-recreate"],
  { cwd: root, env: composeEnv, encoding: "utf8", shell: true },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) process.exit(r.status || 1);

// Wait a bit for migrate + listen
await new Promise((res) => setTimeout(res, 4000));

const restartCmd = `docker compose --env-file .env.acceptance restart api-a`;
r = spawnSync(
  "node",
  ["scripts/hosted-acceptance.mjs"],
  {
    cwd: root,
    env: {
      ...composeEnv,
      MEASUREMENT_API_URL_A: "http://127.0.0.1:8787",
      MEASUREMENT_API_URL_B: "http://127.0.0.1:8788",
      MEASUREMENT_RESTART_CMD: restartCmd,
    },
    encoding: "utf8",
    shell: true,
  },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status || 0);
