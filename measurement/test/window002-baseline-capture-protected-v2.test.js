import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  STAGED_RECEIPT_SCHEMA_VERSION,
  TRUST_MODEL,
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  VERCEL_SCOPE,
} from "../scripts/window002-baseline-capture-v2.mjs";
import { ACTIVE_RUN_ID } from "../scripts/window002-historical-projection.mjs";

const wrapper = fileURLToPath(
  new URL(
    "../scripts/window002-baseline-capture-protected-v2.ps1",
    import.meta.url,
  ),
);
const startUtc = "2030-01-01T12:00:00.000Z";
const digest = "a".repeat(64);
const stagedUrl =
  "https://origin-probe-measure-contract-uridolan77s-projects.vercel.app";

function stageReceipt() {
  return {
    schemaVersion: STAGED_RECEIPT_SCHEMA_VERSION,
    attemptId: "11111111-1111-4111-8111-111111111111",
    createdAtUtc: "2026-08-31T10:00:00.000Z",
    updatedAtUtc: "2026-08-31T10:04:00.000Z",
    completedAtUtc: "2026-08-31T10:04:00.000Z",
    result: "PASS",
    providerWriteState: "STAGED_READY_NOT_PROMOTED",
    providerWriteRetryPolicy:
      "single_cli_invocation_one_discovery_post_one_upload_per_declared_missing_digest_one_identical_continuation_no_automatic_mutation_retry",
    runId: ACTIVE_RUN_ID,
    projectId: VERCEL_PROJECT_ID,
    orgId: VERCEL_ORG_ID,
    scope: VERCEL_SCOPE,
    repairedCommit: "2e4f33c334f5eb07204d6a69481b5c85fe15e45a",
    repairedMeasurementTree: "76218da5886b022ec7d7310dfc6c79f00228a17e",
    archiveTarSha256:
      "926f9468c5faa5991f113f86bd0d852602dd46af75c43de77d0efa114154b556",
    archiveTarBytes: 184320,
    deployManifestSha256Before:
      "cdd30fe6a9f18c7136a882d903302282f35e6ec5b273f247f45b0fdc9d0ebda7",
    deployFileCountBefore: 26,
    wrapperSha256Before:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    rotationReceiptSha256: digest,
    rotationAttemptId: "22222222-2222-4222-8222-222222222222",
    expectedMeasurementConfigFingerprint: digest,
    secretSetFingerprint: digest,
    nodeVersion: "v22.14.0",
    nodeSha256:
      "33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b",
    vercelCliVersion: "57.0.0",
    vercelTreeManifestSha256:
      "21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994",
    executionReadLockCount: 42,
    noRetryPreloadSha256:
      "d8ac99ea2805cd00e11e28270083192b8a5389e4142695b7c49a0fd6c04de2fe",
    scratchItemCountBefore: 0,
    scratchFileCountBefore: 0,
    scratchManifestSha256Before: digest,
    providerCredentialMode: "VERCEL_TOKEN_child_environment_skip_write",
    providerBearerExpiresAtEpochSeconds: 2_000_000_000,
    providerExecutionConfigSha256:
      "889e23d72f6500793b541d7dace3cb13a8e8cddb0d0cba4babc60841f14fdf96",
    projectNodeVersion: "24.x",
    acceptedDeploymentId: "dpl_FzYtRPK5oxnoG4TJnjNxEYrcZbs7",
    providerBaseline: {
      projectRawSha256: digest,
      domainRawSha256: digest,
      acceptedDeploymentRawSha256: digest,
      acceptedAliasesRawSha256: digest,
      aliasRawSha256: {
        "origin-probe-measure-uridolan77s-projects.vercel.app": digest,
        "origin-probe-measure.vercel.app": digest,
      },
    },
    normalAuthSha256Before: digest,
    localUtcBeforeCli: "2026-08-31T10:01:00.000Z",
    localUtcAfterCli: "2026-08-31T10:02:00.000Z",
    cliTimedOut: false,
    cliExitCode: 0,
    cliStdoutSha256: digest,
    cliStderrSha256: digest,
    stagedDeployment: {
      id: "dpl_ContractCaptureV2",
      uniqueUrl: stagedUrl,
      inspectorUrl: "https://vercel.com/uridolan77s-projects/contract",
      target: "production",
      readyState: "READY",
      readySubstate: "STAGED",
    },
    providerReconciliation: {
      candidateDeploymentRawSha256: digest,
      candidateDeploymentRawBytes: 1024,
      candidateAliasSetRawSha256: digest,
      candidateAliasAssignedAtEpochMs: 1_788_169_720_000,
      candidateCreatedAtEpochMs: 1_788_169_660_000,
      candidateAliasAssignedSemantics:
        "staged_readiness_signal_not_window_start",
      postStageProjectRawSha256: digest,
      postStageDomainRawSha256: digest,
      postStageAcceptedDeploymentRawSha256: digest,
      postStageAcceptedAliasesRawSha256: digest,
    },
    productionAliasesRemainOnAcceptedDeployment: true,
    deployManifestSha256After:
      "cdd30fe6a9f18c7136a882d903302282f35e6ec5b273f247f45b0fdc9d0ebda7",
    normalAuthSha256After: digest,
    wrapperSha256After:
      "0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd",
    scratchItemCountAfter: 4,
    scratchFileCountAfter: 4,
    scratchTotalBytesAfter: 4096,
    scratchManifestSha256After: digest,
  };
}

function providerProjection(stage) {
  return {
    id: stage.stagedDeployment.id,
    projectId: VERCEL_PROJECT_ID,
    ownerId: VERCEL_ORG_ID,
    url: new URL(stage.stagedDeployment.uniqueUrl).hostname,
    target: "production",
    readyState: "READY",
    readySubstate: "STAGED",
    aliasAssignedAtEpochMs:
      stage.providerReconciliation.candidateAliasAssignedAtEpochMs,
    createdAtEpochMs: stage.providerReconciliation.candidateCreatedAtEpochMs,
  };
}

function fixture(overrides = {}) {
  const stage = stageReceipt();
  overrides.mutateStage?.(stage);
  const provider = providerProjection(stage);
  overrides.mutateProvider?.(provider);
  return {
    phase: overrides.phase ?? "staged",
    providerDeployment: provider,
    secretScanSecrets:
      overrides.secretScanSecrets ?? ["contract-scanner-secret-12345"],
    secretScanText:
      overrides.secretScanText ?? '{"safe":{"value":"ordinary"}}',
    stageReceipt: stage,
    stdinText:
      overrides.stdinText ??
      "contract-admin-key-12345\ncontract-bypass-key-12345\n",
  };
}

function invoke(value, environmentOverrides = {}) {
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  return spawnSync(
    "pwsh",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      wrapper,
      "ContractTest",
      "-ExpectedStartUtc",
      startUtc,
      "-ContractFixtureBase64",
      encoded,
    ],
    {
      encoding: "utf8",
      timeout: 20_000,
      env: { ...process.env, ...environmentOverrides },
    },
  );
}

function assertRejected(value, expected) {
  const result = invoke(value);
  assert.notEqual(result.status, 0, "contract fixture unexpectedly passed");
  assert.match(result.stderr, new RegExp(expected));
  assert.equal(result.stdout.includes("contract-admin-key"), false);
  assert.equal(result.stderr.includes("contract-admin-key"), false);
}

test("ContractTest validates the protected contract without I/O authority", () => {
  const result = invoke(fixture());
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    schemaVersion:
      "origin.window002.baseline-capture-protected-contract-test.v1",
    result: "PASS",
    trustModel: TRUST_MODEL,
    credentialReads: 0,
    providerReads: 0,
    providerWrites: 0,
    filesystemWrites: 0,
    childEnvironment: {
      SystemRoot: "C:\\Windows",
      WINDIR: "C:\\Windows",
    },
  });
});

test("ContractTest child environment ignores poisoned ambient variables", () => {
  const poisoned = {
    NODE_OPTIONS: "--require=C:\\definitely-missing\\poison.js",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    NODE_EXTRA_CA_CERTS: "C:\\poison\\ca.pem",
    SSL_CERT_FILE: "C:\\poison\\cert.pem",
    SSL_CERT_DIR: "C:\\poison\\certs",
    OPENSSL_CONF: "C:\\poison\\openssl.cnf",
    NODE_USE_ENV_PROXY: "1",
    HTTP_PROXY: "http://127.0.0.1:1",
    HTTPS_PROXY: "http://127.0.0.1:2",
    ALL_PROXY: "socks://127.0.0.1:3",
    NO_PROXY: "*",
  };
  const result = invoke(fixture(), poisoned);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).childEnvironment, {
    SystemRoot: "C:\\Windows",
    WINDIR: "C:\\Windows",
  });
});

test("ContractTest rejects empty and blank stdin secret contracts", async (t) => {
  for (const [name, stdinText] of [
    ["empty", ""],
    ["one newline", "\n"],
    ["blank lines", "\n\n\n"],
  ]) {
    await t.test(name, () => {
      assertRejected(fixture({ stdinText }), "stdin secret line count is invalid");
    });
  }
  await t.test("oversized", () => {
    assertRejected(
      fixture({ stdinText: "x".repeat(8197) }),
      "stdin secret input exceeds the bounded limit",
    );
  });
});

test("ContractTest rejects stage field, secret, state, and time drift", async (t) => {
  for (const [name, mutateStage, expected] of [
    ["extra", (value) => { value.extra = true; }, "field set changed"],
    ["missing", (value) => { delete value.archiveTarBytes; }, "field set changed"],
    ["secret", (value) => { value.adminKey = "leak"; }, "forbidden secret key"],
    ["state", (value) => { value.stagedDeployment.readySubstate = "PROMOTED"; }, "stage deployment or timestamps are invalid"],
    ["time", (value) => { value.completedAtUtc = "2026-08-31T09:00:00.000Z"; value.updatedAtUtc = value.completedAtUtc; }, "time order changed"],
  ]) {
    await t.test(name, () => {
      assertRejected(fixture({ mutateStage }), expected);
    });
  }
});

test("ContractTest requires exact JSON Boolean and integer scalar types", async (t) => {
  const cases = [
    ["cliTimedOut string", (value) => { value.cliTimedOut = "false"; }, "exact JSON Boolean"],
    ["cliTimedOut null", (value) => { value.cliTimedOut = null; }, "exact JSON Boolean"],
    ["cliTimedOut number", (value) => { value.cliTimedOut = 0; }, "exact JSON Boolean"],
    ["alias-retained string", (value) => { value.productionAliasesRemainOnAcceptedDeployment = "true"; }, "exact JSON Boolean"],
    ["alias-retained null", (value) => { value.productionAliasesRemainOnAcceptedDeployment = null; }, "exact JSON Boolean"],
    ["alias-retained number", (value) => { value.productionAliasesRemainOnAcceptedDeployment = 1; }, "exact JSON Boolean"],
    ["cliExitCode string", (value) => { value.cliExitCode = "0"; }, "exact JSON integer"],
    ["archive bytes fraction", (value) => { value.archiveTarBytes = 184320.5; }, "exact JSON integer"],
    ["deploy count null", (value) => { value.deployFileCountBefore = null; }, "exact JSON integer"],
    ["execution lock count string", (value) => { value.executionReadLockCount = "42"; }, "exact JSON integer"],
    ["provider expiry fraction", (value) => { value.providerBearerExpiresAtEpochSeconds = 2_000_000_000.5; }, "exact JSON integer"],
    ["scratch items before null", (value) => { value.scratchItemCountBefore = null; }, "exact JSON integer"],
    ["scratch files before string", (value) => { value.scratchFileCountBefore = "0"; }, "exact JSON integer"],
    ["scratch items after fraction", (value) => { value.scratchItemCountAfter = 4.5; }, "exact JSON integer"],
    ["scratch files after null", (value) => { value.scratchFileCountAfter = null; }, "exact JSON integer"],
    ["scratch bytes after string", (value) => { value.scratchTotalBytesAfter = "4096"; }, "exact JSON integer"],
    ["candidate alias timestamp string", (value) => { value.providerReconciliation.candidateAliasAssignedAtEpochMs = "1788169720000"; }, "exact JSON integer"],
    ["candidate created timestamp fraction", (value) => { value.providerReconciliation.candidateCreatedAtEpochMs = 1_788_169_660_000.5; }, "exact JSON integer"],
    ["candidate raw bytes null", (value) => { value.providerReconciliation.candidateDeploymentRawBytes = null; }, "exact JSON integer"],
  ];
  for (const [name, mutateStage, expected] of cases) {
    await t.test(name, () => {
      assertRejected(fixture({ mutateStage }), expected);
    });
  }

  for (const [name, mutateProvider] of [
    ["provider alias timestamp string", (value) => { value.aliasAssignedAtEpochMs = "1788169720000"; }],
    ["provider created timestamp fraction", (value) => { value.createdAtEpochMs = 1_788_169_660_000.5; }],
    ["provider created timestamp null", (value) => { value.createdAtEpochMs = null; }],
  ]) {
    await t.test(name, () => {
      assertRejected(fixture({ mutateProvider }), "exact JSON integer");
    });
  }
});

test("ContractTest rejects provider deployment identity drift", async (t) => {
  for (const [name, mutateProvider] of [
    ["deployment", (value) => { value.id = "dpl_Attacker"; }],
    ["project", (value) => { value.projectId = "prj_attacker"; }],
    ["team", (value) => { value.ownerId = "team_attacker"; }],
    ["host", (value) => { value.url = "attacker.example"; }],
    ["state", (value) => { value.readySubstate = "PROMOTED"; }],
    ["timestamp", (value) => { value.createdAtEpochMs += 1; }],
  ]) {
    await t.test(name, () => {
      assertRejected(
        fixture({ mutateProvider }),
        "independent provider lookup differs from the stage receipt",
      );
    });
  }
});

test("ContractTest rejects escaped, decoded, and reversibly encoded credential reflections without I/O", async (t) => {
  const secret = 'contract-"quote\\path"-credential';
  const encodedSecret = "contract-scanner-credential-!>!";
  const encodedSecretBytes = Buffer.from(encodedSecret, "utf8");
  const base64 = encodedSecretBytes.toString("base64");
  const base64UrlUnpadded = base64
    .replace(/=+$/u, "")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
  const fullPercent = Array.from(
    encodedSecretBytes,
    (byte) => `%${byte.toString(16).padStart(2, "0").toUpperCase()}`,
  ).join("");
  const encodedCases = [
    ["full UTF-8 percent", fullPercent],
    ["lowercase full UTF-8 percent", fullPercent.toLowerCase()],
    ["standard URI", encodeURIComponent(encodedSecret)],
    ["base64", base64],
    ["base64 unpadded", base64.replace(/=+$/u, "")],
    [
      "base64url padded",
      `${base64UrlUnpadded}${"=".repeat((4 - (base64UrlUnpadded.length % 4)) % 4)}`,
    ],
    ["base64url unpadded", base64UrlUnpadded],
    ["hex lowercase", encodedSecretBytes.toString("hex")],
    ["hex uppercase", encodedSecretBytes.toString("hex").toUpperCase()],
  ].map(([name, reflected]) => [
    name,
    JSON.stringify({ nested: { reflected } }),
    [encodedSecret],
  ]);
  for (const [name, secretScanText, secretScanSecrets] of [
    [
      "quote and backslash",
      JSON.stringify({ nested: { value: `prefix:${secret}:suffix` } }),
      [secret],
    ],
    [
      "Unicode escape in nested value",
      '{"nested":{"value":"contract-\\u0073canner-secret-12345"}}',
      ["contract-scanner-secret-12345"],
    ],
    [
      "Unicode escape in nested key",
      '{"nested":{"prefix-contract-\\u0073canner-secret-12345-suffix":"safe"}}',
      ["contract-scanner-secret-12345"],
    ],
    ...encodedCases,
  ]) {
    await t.test(name, () => {
      const result = invoke(fixture({ secretScanText, secretScanSecrets }));
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /synthetic credential-reflection scanner detected credential material/,
      );
      for (const candidate of secretScanSecrets) {
        assert.equal(result.stdout.includes(candidate), false);
        assert.equal(result.stderr.includes(candidate), false);
      }
    });
  }
});

test("production source pins locks, ACLs, GET-only lookup, and safe trimming", () => {
  const source = readFileSync(wrapper, "utf8");
  assert.match(source, /C:\\Users\\urido\\OriginProbeOperator/);
  assert.match(source, /window002-runtime/);
  assert.match(source, /origin-g2-window002-promote\.ps1/);
  assert.match(source, /origin-g2-window002-stage\.ps1/);
  assert.match(source, /window002-baseline-supersession-pre-rotation/);
  assert.match(source, /window002-baseline-supersession'/);
  assert.match(source, /33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b/);
  assert.match(source, /5b5975f44e3bcbd87af702696e53af49783cd13d3ac3108ea23adffe9cd75276/);
  assert.match(source, /c9c18c829da7e4cf553b2aca3f3e74e70c6912d34c1a99e6b26f8dcc0ba6ccd2/);
  assert.match(source, /window002-historical-projection\.mjs/);
  assert.match(source, /HttpMethod\]::Get/);
  assert.match(source, /providerWrites = 0/);
  assert.match(source, /Open-OutputDirectoryGuard/);
  assert.match(
    source,
    /\$locks\.Add\(\(Write-ExclusiveProtectedBytes[\s\S]*-LiteralPath \$lookupPath/,
  );
  assert.match(source, /Assert-RestrictedAclLocal \$credentialPath/);
  assert.match(source, /Where-Object Name -CNE \$outputGuardFilename/);
  assert.match(source, /Read-BoundedStandardInput/);
  assert.doesNotMatch(source, /\[Console\]::In\.ReadToEnd\(\)/);
  assert.doesNotMatch(source, /\$lines\[0\.\.\(\$lines\.Count - 2\)\]/);
  assert.match(source, /Language\.Parser\]::ParseInput/);
  assert.doesNotMatch(source, /Language\.Parser\]::ParseFile/);
  assert.equal(
    source.includes(["C:\\dev\\", "her", "mes-wrap"].join("")),
    false,
  );

  const runtimeAcl = source.indexOf(
    "Assert-RestrictedAclLocal $runtimePath $true",
  );
  const helperLock = source.indexOf(
    "$legacyPromotionHelperLock = Open-ReadLock $legacyPromotionHelperPath",
    runtimeAcl,
  );
  const stageHelperLock = source.indexOf(
    "$stageHelperLock = Open-ReadLock $stageHelperPath",
    helperLock,
  );
  const helperRead = source.indexOf(
    "$legacyPromotionHelperBytes = Read-LockedBytes",
    stageHelperLock,
  );
  const helperImport = source.indexOf(
    "Import-SealedFunctions -LegacyHelperBytes",
    helperRead,
  );
  const nodeLock = source.indexOf("$locks.Add((Open-ReadLock $nodePath");
  const captureDependencyLock = source.indexOf(
    "$captureScriptLock = Open-ReadLock $captureScriptPath",
  );
  const projectorDependencyLock = source.indexOf(
    "$projectorScriptLock = Open-ReadLock",
    captureDependencyLock,
  );
  const captureDependencyPin = source.indexOf(
    "Assert-LockedDependencyDigest -Stream $captureScriptLock",
    projectorDependencyLock,
  );
  const projectorDependencyPin = source.indexOf(
    "Assert-LockedDependencyDigest -Stream $projectorScriptLock",
    captureDependencyPin,
  );
  const stdinRead = source.indexOf(
    "$stdinText = Read-BoundedStandardInput",
    nodeLock,
  );
  const providerRead = source.indexOf(
    "Invoke-ProviderLookupRaw -Token",
    helperImport,
  );
  assert.ok(
    runtimeAcl >= 0 &&
      helperLock > runtimeAcl &&
      stageHelperLock > helperLock &&
      helperRead > stageHelperLock &&
      helperImport > helperRead,
  );
  assert.ok(
    captureDependencyLock >= 0 &&
      projectorDependencyLock > captureDependencyLock &&
      captureDependencyPin > projectorDependencyLock &&
      projectorDependencyPin > captureDependencyPin,
  );
  assert.ok(nodeLock >= 0 && stdinRead > nodeLock && stdinRead > projectorDependencyPin);
  assert.ok(providerRead > helperImport && providerRead > projectorDependencyPin);

  const environmentClear = source.indexOf("$startInfo.Environment.Clear()");
  const systemRootAllow = source.indexOf(
    "$startInfo.Environment['SystemRoot'] = 'C:\\Windows'",
    environmentClear,
  );
  const windirAllow = source.indexOf(
    "$startInfo.Environment['WINDIR'] = 'C:\\Windows'",
    systemRootAllow,
  );
  const startInfoFactory = source.indexOf(
    "$startInfo = New-CaptureChildStartInfo -Phase $phase",
    windirAllow,
  );
  const processStart = source.indexOf("$process.Start()", startInfoFactory);
  assert.ok(
    environmentClear >= 0 &&
      systemRootAllow > environmentClear &&
      windirAllow > systemRootAllow &&
      startInfoFactory > windirAllow &&
      processStart > startInfoFactory,
  );
  assert.equal(
    (source.match(/\$startInfo\.Environment\['/g) ?? []).length,
    2,
  );

  const providerBytesInMemory = source.indexOf("$providerBytes = $lookup.Bytes");
  const allCredentialInput = source.indexOf(
    "$stdinText = Read-BoundedStandardInput",
    providerBytesInMemory,
  );
  const prewriteScan = source.indexOf(
    "Test-ContainsSecret $bytes @($providerToken, $adminKey, $protectionBypass)",
    allCredentialInput,
  );
  const providerEvidenceWrite = source.indexOf(
    "$locks.Add((Write-ExclusiveProtectedBytes",
    prewriteScan,
  );
  assert.ok(
    providerBytesInMemory >= 0 &&
      allCredentialInput > providerBytesInMemory &&
      prewriteScan > allCredentialInput &&
      providerEvidenceWrite > prewriteScan,
  );
  assert.match(
    source,
    /Test-ContainsSecretText \$childOutput @\(\$providerToken, \$adminKey, \$protectionBypass\)/,
  );
  assert.match(
    source,
    /Test-ContainsSecret \$artifactBytes @\(\$providerToken, \$adminKey, \$protectionBypass\)/,
  );

  const guardOpen = source.indexOf(
    "$locks.Add((Open-OutputDirectoryGuard $outputPath))",
  );
  const childStart = source.indexOf("$process.Start()", guardOpen);
  const childWait = source.indexOf("$process.WaitForExit(90000)", childStart);
  const captureDependencyRevalidation = source.indexOf(
    "Assert-LockedDependencyDigest -Stream $captureScriptLock",
    childWait,
  );
  const projectorDependencyRevalidation = source.indexOf(
    "Assert-LockedDependencyDigest -Stream $projectorScriptLock",
    captureDependencyRevalidation,
  );
  const guardRelease = source.indexOf("foreach ($lock in $locks)", childWait);
  const guardRemoval = source.indexOf(
    "Remove-Item -LiteralPath $outputGuardPath",
    guardRelease,
  );
  assert.ok(
    guardOpen >= 0 &&
      childStart > guardOpen &&
      childWait > childStart &&
      captureDependencyRevalidation > childWait &&
      projectorDependencyRevalidation > captureDependencyRevalidation &&
      guardRelease > childWait &&
      guardRemoval > guardRelease,
  );
});

test(
  "the wrapper dependency read-lock mode behaviorally denies pathname replacement",
  { skip: process.platform !== "win32" },
  () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "window002-lock-contract-"));
    try {
      const dependency = path.join(temporary, "dependency.mjs");
      const moved = `${dependency}.moved`;
      writeFileSync(dependency, "export const locked = true;\n", { flag: "wx" });
      const result = spawnSync(
        "pwsh",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          [
            "$p=$env:ORIGIN_CAPTURE_LOCK_TEST_PATH",
            "$m=$env:ORIGIN_CAPTURE_LOCK_TEST_MOVED_PATH",
            "$s=[IO.FileStream]::new($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)",
            "try { try { [IO.File]::Move($p,$m); throw 'swap unexpectedly succeeded' } catch [IO.IOException] { [Console]::Out.WriteLine('SWAP_BLOCKED') } } finally { $s.Dispose() }",
          ].join("; "),
        ],
        {
          encoding: "utf8",
          timeout: 20_000,
          env: {
            ...process.env,
            ORIGIN_CAPTURE_LOCK_TEST_PATH: dependency,
            ORIGIN_CAPTURE_LOCK_TEST_MOVED_PATH: moved,
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /SWAP_BLOCKED/);
      assert.equal(existsSync(dependency), true);
      assert.equal(existsSync(moved), false);
      renameSync(dependency, moved);
      assert.equal(existsSync(moved), true, "the pathname is released after lock disposal");
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);
