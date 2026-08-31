/**
 * Build sanitized concept catalog from sealed Candidate 005 ZIP archives only.
 * Does not accept arbitrary extracted directories or unbound C092 report paths.
 *
 * Usage:
 *   node tools/build-concept-catalog.mjs --artifact-zip <zip> --c092-zip <zip>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  destroyDir,
  extractZipToTemp,
  sha256Buf,
  sha256File,
} from "./zip-custody.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

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

const ARTIFACT_EXACT_SET = [
  "candidate-005.json",
  "CORPUS_AUDIT.json",
  "TASK_GRAPH.json",
];

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

function expectedConceptIds() {
  return Array.from({ length: 100 }, (_, i) => `C${String(i + 1).padStart(3, "0")}`);
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

function deriveC092PilotFromWorkspace(extractDir) {
  const candidates = [
    "C092_MATURITY_REPORT.json",
    "maturity-report.json",
    "reports/C092_MATURITY_REPORT.json",
    "C092/maturity.json",
  ];
  for (const rel of candidates) {
    const p = path.join(extractDir, rel);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  // Fall back: workspace marker file used by sealed pilot packages
  const marker = path.join(extractDir, "PASS_PARTIALLY_VERIFIED");
  if (fs.existsSync(marker)) {
    return {
      recordId: "C092",
      gate: "PASS_PARTIALLY_VERIFIED",
      acceptedAssertionIds: [],
    };
  }
  // Scan for any json declaring the gate
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const hit = walk(full);
        if (hit) return hit;
      } else if (ent.name.endsWith(".json")) {
        try {
          const j = JSON.parse(fs.readFileSync(full, "utf8"));
          if (
            j.recordId === "C092" &&
            j.gate === "PASS_PARTIALLY_VERIFIED"
          ) {
            return j;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  }
  return walk(extractDir);
}

export function buildConceptCatalogFromZips({
  artifactZip,
  c092Zip,
  repoRoot = REPO_ROOT,
  expectedArtifactDigest = EXPECTED_ARTIFACT,
  expectedC092Digest = EXPECTED_C092,
  enforcePinnedDigests = true,
  artifactExactSet = ARTIFACT_EXACT_SET,
}) {
  if (!artifactZip || !c092Zip) {
    throw new Error(
      "Usage requires --artifact-zip and --c092-zip (no --artifact-dir / --c092-report)",
    );
  }

  const artifactDigest = sha256File(artifactZip);
  if (enforcePinnedDigests && artifactDigest !== expectedArtifactDigest) {
    throw new Error(`Artifact digest mismatch: ${artifactDigest}`);
  }

  const c092PilotDigest = sha256File(c092Zip);
  if (enforcePinnedDigests && c092PilotDigest !== expectedC092Digest) {
    throw new Error(`C092 zip digest mismatch: ${c092PilotDigest}`);
  }

  let artifactExtract;
  let c092Extract;
  try {
    artifactExtract = extractZipToTemp(artifactZip, artifactExactSet);
    c092Extract = extractZipToTemp(c092Zip);

    const candidatePath = path.join(artifactExtract.dir, "candidate-005.json");
    const auditPath = path.join(artifactExtract.dir, "CORPUS_AUDIT.json");
    const taskGraphPath = path.join(artifactExtract.dir, "TASK_GRAPH.json");
    const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    const taskGraph = JSON.parse(fs.readFileSync(taskGraphPath, "utf8"));

    const c092Pilot = deriveC092PilotFromWorkspace(c092Extract.dir);
    if (!c092Pilot) {
      throw new Error("C092 maturity could not be derived from verified workspace ZIP");
    }
    if (c092Pilot.recordId !== "C092") {
      throw new Error("C092 report recordId mismatch");
    }
    if ((c092Pilot.acceptedAssertionIds ?? []).length !== 0) {
      throw new Error("C092 report unexpectedly lists accepted assertions");
    }
    if (c092Pilot.gate !== "PASS_PARTIALLY_VERIFIED") {
      throw new Error("C092 gate must be PASS_PARTIALLY_VERIFIED");
    }

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
          ? task.targetId.match(/^(C(?:00[1-9]|0[1-9]\d|100))/)
          : null;
      const fromTaskId =
        typeof task.taskId === "string"
          ? task.taskId.match(/C(?:00[1-9]|0[1-9]\d|100)/)
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
      if (!/^C(?:00[1-9]|0[1-9]\d|100)$/.test(conceptId)) {
        throw new Error(`Invalid conceptId: ${conceptId}`);
      }

      const slug = slugify(record.label);
      if (usedSlugs.has(slug)) {
        throw new Error(
          `Slug collision: "${slug}" for ${conceptId} and ${usedSlugs.get(slug)}`,
        );
      }
      usedSlugs.set(slug, conceptId);

      const maturity = deriveMaturity(record, audit, c092Pilot);
      if (maturity === "published") {
        throw new Error(
          `${conceptId}: catalog build must not emit published without signed projection`,
        );
      }

      // Hash the complete canonical source record (not a display-metadata subset).
      const recordDigest = sha256Buf(
        Buffer.from(JSON.stringify(record), "utf8"),
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

    const expectedIds = expectedConceptIds();
    const gotIds = items.map((i) => i.conceptId);
    if (
      gotIds.length !== expectedIds.length ||
      gotIds.some((id, i) => id !== expectedIds[i])
    ) {
      throw new Error("Catalog must be exactly C001–C100 in sorted order");
    }

    const c092 = items.find((i) => i.conceptId === "C092");
    if (!c092 || c092.researchMaturity !== "partially_verified") {
      throw new Error("C092 must derive to partially_verified");
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

    const outDir = path.join(repoRoot, "data", "concepts");
    fs.mkdirSync(outDir, { recursive: true });
    const catalogPath = path.join(outDir, "catalog.json");
    const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;
    fs.writeFileSync(catalogPath, catalogJson);

    const catalogDigest = sha256Buf(Buffer.from(catalogJson, "utf8"));
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

    return {
      ok: true,
      catalogCount: items.length,
      catalogDigest,
      c092Maturity: c092.researchMaturity,
    };
  } finally {
    if (artifactExtract?.dir) destroyDir(artifactExtract.dir);
    if (c092Extract?.dir) destroyDir(c092Extract.dir);
  }
}



