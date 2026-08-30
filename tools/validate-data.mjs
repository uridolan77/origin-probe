#!/usr/bin/env node
/**
 * Fail-closed genealogy data validation.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "genealogies");

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

const EvidenceRoleSchema = z.enum([
  "EARLIEST_VERIFIED_OCCURRENCE",
  "CLAIMED_COINAGE",
  "POPULARIZED_BY",
  "MISATTRIBUTED_TO",
  "ANTECEDENT",
  "CONTESTED_INCOMPLETE",
]);

const GenealogySchema = z
  .object({
    genealogyId: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    phrase: z.string().min(1),
    aliases: z.array(z.string()),
    revision: z.number().int().positive(),
    reviewedAt: z.string().min(1),
    status: z.enum(["draft", "reviewed", "provisional", "superseded", "withdrawn"]),
    finding: z.string().min(1),
    searchScope: z.string().min(1),
    evidenceReviewed: z.string().min(1),
    sourceSetHash: z.string().regex(/^sha256:[0-9a-f]{16}$/),
    supersedesRevision: z.number().int().positive().nullable(),
    correctionHistory: z.array(z.any()),
    assertions: z
      .array(
        z.object({
          assertionId: z.string().min(1),
          evidenceRole: EvidenceRoleSchema,
          subject: z.string().min(1),
          publicStatement: z.string().min(1),
          evidenceIds: z.array(z.string()).min(1),
          supportKind: z.enum(["direct", "supporting", "contested", "incomplete"]),
          caveat: z.string().optional(),
        }),
      )
      .min(1),
    sources: z
      .array(
        z.object({
          sourceId: z.string().min(1),
          title: z.string().min(1),
          author: z.string().min(1),
          publisher: z.string().min(1),
          publicationDate: z.string().min(1),
          sourceType: z.enum(["primary", "secondary"]),
          url: z.string().url(),
          archiveUrl: z.string().url().optional(),
          accessedAt: z.string().min(1),
          supportsAssertionIds: z.array(z.string()).min(1),
          shortExcerpt: z.string().max(280).optional(),
        }),
      )
      .min(1),
  })
  .strict();

function computeHash(sources) {
  const lines = sources
    .map((s) => `${s.sourceId}\t${s.url}\t${s.publicationDate}`)
    .sort((a, b) => a.localeCompare(b));
  const digest = createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}

function fail(msg) {
  console.error(`validate-data: FAIL — ${msg}`);
  process.exitCode = 1;
}

if (!fs.existsSync(dataDir)) {
  fail("missing data/genealogies directory");
  process.exit(1);
}

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
if (files.length < 6 || files.length > 8) {
  fail(`result page count must be 6–8, got ${files.length}`);
}

const slugs = new Set();
const genealogyIds = new Set();
const allSourceIds = new Set();
const allAliases = new Map();

for (const file of files) {
  const full = path.join(dataDir, file);
  const raw = JSON.parse(fs.readFileSync(full, "utf8"));
  const parsed = GenealogySchema.safeParse(raw);
  if (!parsed.success) {
    fail(`${file}: schema — ${JSON.stringify(parsed.error.issues)}`);
    continue;
  }
  const g = parsed.data;

  if (file !== `${g.slug}.json`) {
    fail(`${file}: filename must match slug ${g.slug}.json`);
  }
  if (slugs.has(g.slug)) fail(`duplicate slug: ${g.slug}`);
  slugs.add(g.slug);
  if (genealogyIds.has(g.genealogyId)) fail(`duplicate genealogyId: ${g.genealogyId}`);
  genealogyIds.add(g.genealogyId);

  if (!DATE_RE.test(g.reviewedAt) && !/^\d{4}-\d{2}-\d{2}$/.test(g.reviewedAt)) {
    fail(`${file}: reviewedAt must be YYYY-MM-DD`);
  }

  const expected = computeHash(g.sources);
  if (g.sourceSetHash !== expected) {
    fail(`${file}: sourceSetHash mismatch got=${g.sourceSetHash} expected=${expected}`);
  }

  if (g.supersedesRevision !== null && g.supersedesRevision >= g.revision) {
    fail(`${file}: supersedesRevision must be < revision`);
  }

  const sourceById = new Map();
  for (const s of g.sources) {
    if (sourceById.has(s.sourceId)) fail(`${file}: duplicate sourceId ${s.sourceId}`);
    sourceById.set(s.sourceId, s);
    if (allSourceIds.has(s.sourceId)) fail(`duplicate sourceId across corpus: ${s.sourceId}`);
    allSourceIds.add(s.sourceId);
    if (!DATE_RE.test(s.publicationDate)) {
      fail(`${file}: source ${s.sourceId} publicationDate not canonical (${s.publicationDate})`);
    }
    if (!DATE_RE.test(s.accessedAt) && !/^\d{4}-\d{2}-\d{2}$/.test(s.accessedAt)) {
      fail(`${file}: source ${s.sourceId} accessedAt not canonical`);
    }
  }

  const assertionById = new Map();
  for (const a of g.assertions) {
    if (assertionById.has(a.assertionId)) fail(`${file}: duplicate assertionId ${a.assertionId}`);
    assertionById.set(a.assertionId, a);

    for (const eid of a.evidenceIds) {
      if (!sourceById.has(eid)) {
        fail(`${file}: assertion ${a.assertionId} references missing source ${eid}`);
      }
    }

    if (a.evidenceRole === "CLAIMED_COINAGE" && a.supportKind === "direct") {
      const hasDirectPrimary = a.evidenceIds.some((id) => {
        const s = sourceById.get(id);
        return s && s.sourceType === "primary";
      });
      if (!hasDirectPrimary) {
        fail(
          `${file}: coinage assertion ${a.assertionId} with supportKind=direct requires a primary source`,
        );
      }
    }

    if (a.evidenceRole === "EARLIEST_VERIFIED_OCCURRENCE") {
      const hasPrimary = a.evidenceIds.some((id) => sourceById.get(id)?.sourceType === "primary");
      if (!hasPrimary) {
        fail(
          `${file}: earliest-occurrence assertion ${a.assertionId} requires at least one primary source`,
        );
      }
    }
  }

  for (const s of g.sources) {
    for (const aid of s.supportsAssertionIds) {
      if (!assertionById.has(aid)) {
        fail(`${file}: source ${s.sourceId} supports missing assertion ${aid}`);
      }
    }
  }

  // Bidirectional closure: every assertion evidenceId must be listed by that source
  for (const a of g.assertions) {
    for (const eid of a.evidenceIds) {
      const s = sourceById.get(eid);
      if (s && !s.supportsAssertionIds.includes(a.assertionId)) {
        fail(
          `${file}: source ${eid} must list supportsAssertionIds including ${a.assertionId}`,
        );
      }
    }
  }

  for (const alias of [g.phrase, ...g.aliases]) {
    const key = alias.trim().toLowerCase();
    if (!key) continue;
    if (allAliases.has(key) && allAliases.get(key) !== g.slug) {
      fail(`alias collision "${alias}" between ${allAliases.get(key)} and ${g.slug}`);
    }
    allAliases.set(key, g.slug);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log(`validate-data: ok (${files.length} genealogies)`);
