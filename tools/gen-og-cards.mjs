#!/usr/bin/env node
/**
 * Build-time social cards from genealogy JSON.
 * Renders separated evidence roles; never fabricates source counts or findings.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "genealogies");
const outDir = path.join(root, "public", "og");
const fontDir = path.join(root, "tools", "fonts");

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(fontDir, { recursive: true });

const ROLE_LABELS = {
  EARLIEST_VERIFIED_OCCURRENCE: "Earliest verified occurrence located",
  CLAIMED_COINAGE: "Commonly credited to",
  POPULARIZED_BY: "Popularized by",
  MISATTRIBUTED_TO: "Misattributed to",
  ANTECEDENT: "Antecedent",
  CONTESTED_INCOMPLETE: "Contested / incomplete",
};

const FROZEN_CARD_SHA256 = Object.freeze({
  "be-the-change-you-wish-to-see":
    "bea857164bc4e81bd3910f7eaa625abad41866521eadb779263ba2fb58fa8556",
  "culture-eats-strategy-for-breakfast":
    "430c48abdad488da762fcd8568f5d728c5a9a279a426909008d26deef7496aea",
  "if-youre-not-paying-you-are-the-product":
    "4d8383f81eeb72f4cff83de91683474ccc50a43ff2f7860294655d3254ae6733",
  "information-wants-to-be-free":
    "da2880b7011e562fd5f824239b89c9af389336a1cf383935cd7274ae473dc316",
  "insanity-doing-the-same-thing":
    "d077bdd2bc2fd259780f336622b8ae0dbce2b7f0c3de043d9e217f1e651a1555",
  "move-fast-and-break-things":
    "6335afe24230aa37e4187d75c218a11ff07d7ed8bd0f0d1631d81a2eacaba5f6",
  "the-medium-is-the-message":
    "af0abca054e466290a96d9dc90d154610537ff6e1d99263316a06942e90a7a5d",
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function loadGenealogies() {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8")));
}

function verifyFrozenCards(genealogies) {
  const observedSlugs = genealogies.map((genealogy) => genealogy.slug).sort();
  const expectedSlugs = Object.keys(FROZEN_CARD_SHA256).sort();
  if (JSON.stringify(observedSlugs) !== JSON.stringify(expectedSlugs)) {
    throw new Error("Frozen OG card manifest does not match the genealogy set.");
  }

  let missing = false;
  for (const slug of expectedSlugs) {
    const cardPath = path.join(outDir, `${slug}.png`);
    if (!fs.existsSync(cardPath)) {
      missing = true;
      continue;
    }
    const observedSha256 = sha256(fs.readFileSync(cardPath));
    if (observedSha256 !== FROZEN_CARD_SHA256[slug]) {
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
  // Prefer a local system Times/Liberation font when present (no network dependency for CI cache hits).
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

async function renderCard(g, fontData) {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const roles = roleLines(g);
  const finding =
    g.finding.length > 160 ? `${g.finding.slice(0, 157)}…` : g.finding;
  const meta = `${g.sources.length} sources · reviewed ${g.reviewedAt}`;

  const children = [
    {
      type: "div",
      props: {
        style: { fontSize: 22, letterSpacing: 2, color: "#3d5a45", marginBottom: 18 },
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

  for (const line of roles) {
    children.push({
      type: "div",
      props: {
        style: { fontSize: 24, marginBottom: 8, color: "#243028", maxWidth: 1040 },
        children: line,
      },
    });
  }

  children.push({
    type: "div",
    props: {
      style: { fontSize: 22, marginTop: 18, color: "#1a241c", maxWidth: 1040 },
      children: `Finding: ${finding}`,
    },
  });
  children.push({
    type: "div",
    props: {
      style: { fontSize: 20, marginTop: 20, color: "#5a6b5e" },
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
          background: "#f3f0e8",
          color: "#162018",
          fontFamily: "CardSerif",
          border: "12px solid #2f4a38",
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

const genealogies = loadGenealogies();
if (verifyFrozenCards(genealogies)) {
  process.exit(0);
}

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
console.log(`gen-og-cards: ok (${genealogies.length})`);
