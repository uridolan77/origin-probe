#!/usr/bin/env node
/**
 * Build sanitized concept catalog from sealed Candidate 005 materials.
 * Inputs are read from paths passed on the CLI (outside the product repo).
 * Output: data/concepts/catalog.json + catalog-receipt.json
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const OBJECT_KINDS = new Set([
  "argument",
  "case_family",
  "distinction",
  "doctrine",
  "framework",
  "lexeme_concept",
  "method",
  "paradox",
  "principle",
  "problem_family",
  "reception_formula",
  "theory",
  "thought_experiment",
]);

const SOURCE_PACKAGE_ID = "ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005";
const EXPECTED_ARTIFACT =
  "a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814";
const EXPECTED_C092 =
  "74ace215ecc436399e5f57da0b4e1b4ad6d61672a3025a8e930ff679c5d209d0";

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(p) {
  return sha256Hex(fs.readFileSync(p));
}

function slugify(label) {
  const base = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!base) throw new Error(`Cannot slugify label: ${label}`);
  return base;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) throw new Error(`Missing value for --${key}`);
      out[key] = val;
      i++;
    }
  }
  return out;
}

function deriveMaturity(record, audit, c092Pilot) {
  const tags = record.curation?.maturityTags ?? [];
  if (record.id === "C092" && c092Pilot?.gate === "PASS_PARTIALLY_VERIFIED") {
    return "partially_verified";
  }
  if (
    audit.sourceLeadModeledRecordIds?.includes(record.id) ||
    tags.includes("source_lead_modeled")
  ) {
    return "source_leads_mapped";
  }
  return "research_queue";
}

function main() {
  const args = parseArgs(process.argv);
  const artifactDir = args["artifact-dir"];
  const c092Report = args["c092-report"];
  const artifactZip = args["artifact-zip"];
  const c092Zip = args["c092-zip"];
  if (!artifactDir || !artifactZip) {
    console.error(
      "Usage: node tools/build-concept-catalog.mjs --artifact-dir <dir> --artifact-zip <zip> [--c092-report <json>] [--c092-zip <zip>]",
    );
    process.exit(1);
  }

  const artifactDigest = sha256File(artifactZip);
  if (artifactDigest !== EXPECTED_ARTIFACT) {
    throw new Error(`Artifact digest mismatch: ${artifactDigest}`);
  }

  let c092PilotDigest = null;
  let c092Pilot = null;
  if (c092Zip) {
    c092PilotDigest = sha256File(c092Zip);
    if (c092PilotDigest !== EXPECTED_C092) {
      throw new Error(`C092 zip digest mismatch: ${c092PilotDigest}`);
    }
  }
  if (c092Report) {
    c092Pilot = JSON.parse(fs.readFileSync(c092Report, "utf8"));
    if (c092Pilot.recordId !== "C092") {
      throw new Error("C092 report recordId mismatch");
    }
    if ((c092Pilot.acceptedAssertionIds ?? []).length !== 0) {
      throw new Error("C092 report unexpectedly lists accepted assertions");
    }
  }

  const candidatePath = path.join(artifactDir, "candidate-005.json");
  const auditPath = path.join(artifactDir, "CORPUS_AUDIT.json");
  const taskGraphPath = path.join(artifactDir, "TASK_GRAPH.json");
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const taskGraph = JSON.parse(fs.readFileSync(taskGraphPath, "utf8"));

  if (candidate.packageId !== SOURCE_PACKAGE_ID) {
    throw new Error(`Unexpected packageId: ${candidate.packageId}`);
  }
  if (!Array.isArray(candidate.records) || candidate.records.length !== 100) {
    throw new Error(`Expected 100 records, got ${candidate.records?.length}`);
  }
  if (audit.acceptedAssertionCount != null && audit.acceptedAssertionCount !== 0) {
    throw new Error("Audit reports accepted assertions");
  }

  const corpusAuditDigest = sha256File(auditPath);

  const openTasksByRecord = new Map();
  for (const task of taskGraph.tasks ?? []) {
    const fromTarget =
      typeof task.targetId === "string"
        ? task.targetId.match(/^(C(?:0[0-9]{2}|100))/)
        : null;
    const fromTaskId =
      typeof task.taskId === "string"
        ? task.taskId.match(/C(?:0[0-9]{2}|100)/)
        : null;
    const id =
      task.recordId ||
      task.conceptId ||
      (fromTarget ? fromTarget[1] : null) ||
      (fromTaskId ? fromTaskId[0] : null);
    if (!id) continue;
    const open = task.status === "open" || task.state === "open" || !task.status;
    const cur = openTasksByRecord.get(id) ?? 0;
    if (open) openTasksByRecord.set(id, cur + 1);
    else if (!openTasksByRecord.has(id)) openTasksByRecord.set(id, 0);
  }

  const usedSlugs = new Map();
  const items = [];

  const sorted = [...candidate.records].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  );

  for (const record of sorted) {
    if (!OBJECT_KINDS.has(record.objectKind)) {
      throw new Error(`${record.id}: invalid objectKind ${record.objectKind}`);
    }
    const conceptId = record.id;
    if (!/^C(?:0[0-9]{2}|100)$/.test(conceptId)) {
      throw new Error(`Invalid conceptId: ${conceptId}`);
    }

    let slug = slugify(record.label);
    if (usedSlugs.has(slug)) {
      throw new Error(
        `Slug collision: "${slug}" for ${conceptId} and ${usedSlugs.get(slug)}`,
      );
    }
    usedSlugs.set(slug, conceptId);

    const maturity = deriveMaturity(record, audit, c092Pilot);
    if (maturity === "published") {
      throw new Error(`${conceptId}: catalog build must not emit published without signed projection`);
    }

    const recordDigest = sha256Hex(
      Buffer.from(
        JSON.stringify({
          id: record.id,
          objectKind: record.objectKind,
          label: record.label,
          aliases: record.aliases ?? [],
          domains: record.domains ?? [],
        }),
        "utf8",
      ),
    );

    items.push({
      conceptId,
      slug,
      label: record.label,
      aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
      objectKind: record.objectKind,
      domains: [...(record.domains ?? [])],
      researchMaturity: maturity,
      publicFindingAvailable: false,
      openTaskCount: openTasksByRecord.get(conceptId) ?? 0,
      sourceLeadCount: Array.isArray(record.sources) ? record.sources.length : 0,
      evidenceLeadCount: Array.isArray(record.evidenceItems)
        ? record.evidenceItems.length
        : 0,
      acceptedAssertionCount: 0,
      publicationSlug: null,
      sourcePackageId: SOURCE_PACKAGE_ID,
      sourceRecordDigest: recordDigest,
    });
  }

  if (items.length !== 100) throw new Error("Expected 100 catalog items");
  const ids = new Set(items.map((i) => i.conceptId));
  if (ids.size !== 100) throw new Error("Duplicate concept IDs");

  const c092 = items.find((i) => i.conceptId === "C092");
  if (!c092 || c092.researchMaturity !== "partially_verified") {
    throw new Error("C092 must derive to partially_verified");
  }
  if (items.some((i) => i.researchMaturity === "published")) {
    throw new Error("No published maturity without signed projection");
  }

  // Forbidden claim leakage check
  const serialized = JSON.stringify(items);
  for (const bad of [
    '"claim"',
    '"assertions"',
    '"earliest"',
    '"originator"',
    "most likely origin",
  ]) {
    if (serialized.toLowerCase().includes(bad.toLowerCase()) && bad.startsWith('"')) {
      // structural keys only
      if (/"claim"\s*:/.test(serialized) || /"assertions"\s*:/.test(serialized)) {
        throw new Error(`Forbidden catalog field leaked: ${bad}`);
      }
    }
  }

  const catalog = {
    schemaVersion: 1,
    sourcePackageId: SOURCE_PACKAGE_ID,
    sourceArtifactDigest: artifactDigest,
    generatedFrom: {
      artifactDigest,
      corpusAuditDigest,
      c092PilotDigest,
    },
    items,
  };

  const outDir = path.join(REPO_ROOT, "data", "concepts");
  fs.mkdirSync(outDir, { recursive: true });
  const catalogPath = path.join(outDir, "catalog.json");
  const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;
  fs.writeFileSync(catalogPath, catalogJson);

  const catalogDigest = sha256Hex(Buffer.from(catalogJson, "utf8"));
  const receipt = {
    receiptKind: "origin_concept_catalog_receipt_v1",
    sourcePackageId: SOURCE_PACKAGE_ID,
    sourceArtifactDigest: artifactDigest,
    corpusAuditDigest,
    c092PilotDigest,
    catalogDigest,
    catalogCount: items.length,
    acceptedAssertionCount: 0,
    publishedDossierCount: 0,
    c092Maturity: "partially_verified",
    transformationBoundary:
      "Neutral catalog metadata only; candidate assertion prose excluded",
  };
  fs.writeFileSync(
    path.join(outDir, "catalog-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );

  const pubDir = path.join(outDir, "publications");
  fs.mkdirSync(pubDir, { recursive: true });
  const keep = path.join(pubDir, ".gitkeep");
  if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");

  console.log(
    JSON.stringify(
      {
        ok: true,
        catalogCount: items.length,
        catalogDigest,
        c092Maturity: c092.researchMaturity,
        maturityCounts: items.reduce((acc, i) => {
          acc[i.researchMaturity] = (acc[i.researchMaturity] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2,
    ),
  );
}

main();
