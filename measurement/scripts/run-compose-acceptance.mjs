/**
 * Bring up dual-API + Postgres compose and run hosted acceptance (20 scenarios).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "origin-g2-acceptance-"));
const envPath = path.join(tempRoot, "compose.env");
const projectName = `origin-g2-accept-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
const imageName = `${projectName}:local`;

function ensureAcceptanceEnv() {
  const env = {
    MEASUREMENT_HMAC_SECRET:
      process.env.MEASUREMENT_HMAC_SECRET ||
      crypto.randomBytes(32).toString("hex"),
    MEASUREMENT_CLIENT_SALT:
      process.env.MEASUREMENT_CLIENT_SALT ||
      crypto.randomBytes(32).toString("hex"),
    MEASUREMENT_ADMIN_KEY:
      process.env.MEASUREMENT_ADMIN_KEY ||
      crypto.randomBytes(24).toString("hex"),
    MEASUREMENT_ALLOWED_ORIGIN:
      process.env.MEASUREMENT_ALLOWED_ORIGIN ||
      "https://uridolan77.github.io",
    MEASUREMENT_RUN_ID:
      process.env.MEASUREMENT_RUN_ID ||
      "ORIGIN-G2R-ACCEPTANCE",
    MEASUREMENT_OPERATOR_RAW:
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
  MEASUREMENT_ACCEPTANCE_IMAGE: imageName,
  MEASUREMENT_OPERATOR_HASHES: operatorHash,
};

console.log("operatorHash", operatorHash.slice(0, 16) + "…");
console.log("compose up --build …");

const composePrefix = [
  "compose",
  "--project-name",
  projectName,
  "--env-file",
  envPath,
];

function docker(args) {
  return spawnSync("docker", args, {
    cwd: root,
    env: composeEnv,
    encoding: "utf8",
    shell: false,
  });
}

function serviceContainerId(service) {
  const result = docker([...composePrefix, "ps", "-q", service]);
  return result.status === 0 ? (result.stdout || "").trim() : "";
}

function containerImageId(containerId) {
  if (!containerId) return "";
  const result = docker(["inspect", "--format={{.Image}}", containerId]);
  return result.status === 0 ? (result.stdout || "").trim() : "";
}

let status = 1;
try {
  let result = docker([
    ...composePrefix,
    "up",
    "--build",
    "-d",
    "--force-recreate",
  ]);
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    status = result.status || 1;
  } else {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const containerA = serviceContainerId("api-a");
    const containerB = serviceContainerId("api-b");
    const imageA = containerImageId(containerA);
    const imageB = containerImageId(containerB);
    if (!containerA || !containerB || containerA === containerB || !imageA || imageA !== imageB) {
      console.error("HOSTED_ACCEPTANCE_TRANSCRIPT=BLOCKED reason=unproven_compose_topology");
      status = 2;
    } else {
      const topology = JSON.stringify({
        apiA: { containerId: containerA, imageId: imageA },
        apiB: { containerId: containerB, imageId: imageB },
      });
      const restartCmd =
        `docker compose --project-name "${projectName}" ` +
        `--env-file "${envPath}" restart api-a`;
      result = spawnSync(process.execPath, ["scripts/hosted-acceptance.mjs"], {
        cwd: root,
        env: {
          ...composeEnv,
          MEASUREMENT_API_URL_A: "http://127.0.0.1:8787",
          MEASUREMENT_API_URL_B: "http://127.0.0.1:8788",
          MEASUREMENT_RESTART_CMD: restartCmd,
          MEASUREMENT_TOPOLOGY_EVIDENCE_JSON: topology,
        },
        encoding: "utf8",
        shell: false,
      });
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
      status = result.status ?? 1;
    }
  }
} finally {
  const cleanup = docker([...composePrefix, "down", "--volumes", "--remove-orphans"]);
  if (cleanup.status !== 0) process.stderr.write(cleanup.stderr || "compose cleanup failed\n");
  const imageCleanup = docker(["image", "rm", imageName]);
  if (imageCleanup.status !== 0) {
    process.stderr.write(imageCleanup.stderr || "acceptance image cleanup failed\n");
  }
  const resolvedTempRoot = path.resolve(tempRoot);
  const resolvedSystemTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (
    resolvedTempRoot.startsWith(resolvedSystemTemp) &&
    path.basename(resolvedTempRoot).startsWith("origin-g2-acceptance-")
  ) {
    fs.rmSync(resolvedTempRoot, { recursive: true, force: true });
  } else {
    console.error("temporary acceptance directory failed safety validation");
    status = status === 0 ? 1 : status;
  }
}

process.exit(status);
