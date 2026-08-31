#!/usr/bin/env node
/**
 * Build-time social cards from published genealogy JSON only.
 * Renders separated evidence roles; never fabricates source counts or findings.
 * Prunes stale /og assets that do not belong to the current published set.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPublishedGenealogies, pruneStaleOgCards } from "./og-publish.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "genealogies");
const outDir = path.join(root, "public", "og");
const fontDir = path.join(root, "tools", "fonts");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(fontDir, { recursive: true });

const ROLE_LABELS = {
  EARLIEST_VERIFIED_OCCURRENCE: "Earliest verified occurrence located",
  EARLIEST_REPORTED_OCCURRENCE: "Earliest reported occurrence (secondary)",
  CLAIMED_COINAGE: "Commonly credited to",
  POPULARIZED_BY: "Popularized by",
  MISATTRIBUTED_TO: "Misattributed to",
  ANTECEDENT: "Antecedent",
  CONTESTED_INCOMPLETE: "Contested / incomplete",
};

const FROZEN_CARD_SHA256 = Object.freeze({
  "be-the-change-you-wish-to-see":
    "db795779da2f232a458f2a506f3580f06cdfbcec5874fb45f5bf86709d6ee634",
  "culture-eats-strategy-for-breakfast":
    "959ebfe881cffcb0803b65c229ca8450d34b8e3303dcc65449206dc5a18c98b0",
  "if-youre-not-paying-you-are-the-product":
    "f3642be0dd11347ddfa39a79a7b00f356d25f4adda93508d29bd8c2da5e5cdef",
  "information-wants-to-be-free":
    "00a8d91714480d7a1a5f1e1b02bec696f6c87e1df9d822d1d0fa864ef6a55741",
  "insanity-doing-the-same-thing":
    "2d6e03d373cf9d7e9af31fb6968f13fdfd7172065eef1c1240b24a8ff4a9300b",
  "move-fast-and-break-things":
    "245652abe7b205b34deeba7701da635745e428e4fb551dcbf4ac29db042344fc",
  "the-medium-is-the-message":
    "01917768cd9f57c4aec3a3ed6fedcd703d0f607dcc028d770a82d7395ef7dcac",
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function verifyFrozenCards(genealogies) {
  const observedSlugs = genealogies.map((genealogy) => genealogy.slug).sort();
  const expectedSlugs = Object.keys(FROZEN_CARD_SHA256).sort();
  if (JSON.stringify(observedSlugs) !== JSON.stringify(expectedSlugs)) {
    throw new Error("Frozen OG card manifest does not match the published genealogy set.");
  }

  let missing = false;
  for (const slug of expectedSlugs) {
    const cardPath = path.join(outDir, `${slug}.png`);
    if (!fs.existsSync(cardPath)) {
      missing = true;
      continue;
    }
    if (sha256(fs.readFileSync(cardPath)) !== FROZEN_CARD_SHA256[slug]) {
      throw new Error(`Frozen OG card digest changed for ${slug}.`);
    }
  }
  if (!missing) {
    console.log(`gen-og-cards: verified frozen assets (${expectedSlugs.length})`);
  }
  return !missing;
}

async function ensureFont() {
  const fontPath = path.join(fontDir, "LiberationSerif-Regular.ttf");
  if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000) {
    return fs.readFileSync(fontPath);
  }
  const candidates = [
    "C:/Windows/Fonts/times.ttf",
    "C:/Windows/Fonts/timesnr.ttf",
    "C:/Windows/Fonts/georgia.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const buf = fs.readFileSync(c);
      fs.writeFileSync(fontPath, buf);
      return buf;
    }
  }
  throw new Error(
    "No local serif TTF found for OG generation. Install Liberation Serif or Times on the runner.",
  );
}

function roleLines(g) {
  const lines = [];
  for (const role of [
    "CLAIMED_COINAGE",
    "POPULARIZED_BY",
    "EARLIEST_VERIFIED_OCCURRENCE",
    "EARLIEST_REPORTED_OCCURRENCE",
    "MISATTRIBUTED_TO",
    "ANTECEDENT",
    "CONTESTED_INCOMPLETE",
  ]) {
    const a = g.assertions.find((x) => x.evidenceRole === role);
    if (!a) continue;
    lines.push(`${ROLE_LABELS[role]}: ${a.subject}`);
  }
  return lines.slice(0, 4);
}

function indexEarliestLine(g) {
  if (!g.index) return null;
  const assertion = g.assertions.find((a) => a.assertionId === g.index.earliest.assertionId);
  const display = assertion?.occurrenceDate?.display ?? g.index.earliest.date.display;
  if (assertion?.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
    return `Index earliest: Reported ${display} (secondary; primary not re-inspected)`;
  }
  return `Index earliest: ${display}`;
}

async function renderCard(g, fontData) {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const roles = roleLines(g);
  const earliest = indexEarliestLine(g);
  const finding =
    g.finding.length > 160 ? `${g.finding.slice(0, 157)}…` : g.finding;
  const meta = `${g.sources.length} sources · revision ${g.revision} · reviewed ${g.reviewedAt}`;

  const children = [
    {
      type: "div",
      props: {
        style: { fontSize: 22, letterSpacing: 2, color: "#1a5a74", marginBottom: 18 },
        children: "ORIGIN",
      },
    },
    {
      type: "div",
      props: {
        style: { fontSize: 44, lineHeight: 1.15, marginBottom: 22, maxWidth: 1040 },
        children: `“${g.phrase}”`,
      },
    },
  ];

  if (earliest) {
    children.push({
      type: "div",
      props: {
        style: { fontSize: 24, marginBottom: 10, color: "#14181d", maxWidth: 1040 },
        children: earliest,
      },
    });
  }

  for (const line of roles) {
    children.push({
      type: "div",
      props: {
        style: { fontSize: 24, marginBottom: 8, color: "#14181d", maxWidth: 1040 },
        children: line,
      },
    });
  }

  children.push({
    type: "div",
    props: {
      style: { fontSize: 22, marginTop: 18, color: "#14181d", maxWidth: 1040 },
      children: `Finding: ${finding}`,
    },
  });
  children.push({
    type: "div",
    props: {
      style: { fontSize: 20, marginTop: 20, color: "#4a5560" },
      children: meta,
    },
  });

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 56,
          background: "#f4f1eb",
          color: "#14181d",
          fontFamily: "CardSerif",
          border: "12px solid #1a5a74",
        },
        children,
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "CardSerif", data: fontData, weight: 400, style: "normal" }],
    },
  );
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}

async function main() {
  const genealogies = loadPublishedGenealogies(dataDir);
  if (genealogies.length === 0) {
    console.log("gen-og-cards: no published genealogies");
    const removedEmpty = pruneStaleOgCards(outDir, []);
    if (removedEmpty.length) {
      console.log(`gen-og-cards: pruned ${removedEmpty.length} stale card(s)`);
    }
    return;
  }

  const publishedSlugs = genealogies.map((g) => g.slug);
  const removed = pruneStaleOgCards(outDir, publishedSlugs);
  if (removed.length) {
    console.log(`gen-og-cards: pruned ${removed.length} stale card(s): ${removed.join(", ")}`);
  }
  if (verifyFrozenCards(genealogies)) return;

  const fontData = await ensureFont();
  for (const g of genealogies) {
    const out = path.join(outDir, `${g.slug}.png`);
    const png = await renderCard(g, fontData);
    if (sha256(png) !== FROZEN_CARD_SHA256[g.slug]) {
      throw new Error(`Generated OG card digest changed for ${g.slug}.`);
    }
    fs.writeFileSync(out, png);
    console.log("wrote", path.relative(root, out), `${png.length} bytes`);
  }
  console.log(`gen-og-cards: ok (${genealogies.length} published)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
