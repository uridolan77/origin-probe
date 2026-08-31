#!/usr/bin/env node
/**
 * Build-time social cards from published genealogy JSON only.
 * Renders separated evidence roles; never fabricates source counts or findings.
 * Verifies the checked-in cards before attempting any host-font fallback.
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
    "f17d80bce661f0d0f262c80978364f2c1ce2e396ea2d65f5736baba44b91ad95",
  "culture-eats-strategy-for-breakfast":
    "f0337cf83404b4fce95e384e1c1e68b78f3e352efb1db7f87720a106486f60cf",
  "if-youre-not-paying-you-are-the-product":
    "d743c9af6db62c3cbaffb9049be61bbc2a56ceb8a166734f9573d2f533db042c",
  "information-wants-to-be-free":
    "aa4a776e0fcf0fa17b48d8b681e674df4240da94ceed5500a0c14d6937cebab5",
  "insanity-doing-the-same-thing":
    "8c60009449cb9690d9c65d42a84ac3f169c11905893ef801620246c9ce840c35",
  "move-fast-and-break-things":
    "9b8b11485bc12094df5d807cdce25ef98deb32c5c26bc9113ab8781ac7fbdfe1",
  "the-medium-is-the-message":
    "3fce0231cccfcb47d9bdd19295de9882900bd30a8f6e41aebd297256f3a4cac3",
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
  const candidates = [
    "C:/Windows/Fonts/times.ttf",
    "C:/Windows/Fonts/timesnr.ttf",
    "C:/Windows/Fonts/georgia.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const buffer = fs.readFileSync(candidate);
      fs.writeFileSync(fontPath, buffer);
      return buffer;
    }
  }
  throw new Error(
    "No local serif TTF found for OG generation. Install Liberation Serif or Times on the runner.",
  );
}

function roleLines(genealogy) {
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
    const assertion = genealogy.assertions.find(
      (candidate) => candidate.evidenceRole === role,
    );
    if (!assertion) continue;
    lines.push(`${ROLE_LABELS[role]}: ${assertion.subject}`);
  }
  return lines.slice(0, 4);
}

function indexEarliestLine(genealogy) {
  if (!genealogy.index) return null;
  const assertion = genealogy.assertions.find(
    (candidate) => candidate.assertionId === genealogy.index.earliest.assertionId,
  );
  const display =
    assertion?.occurrenceDate?.display ?? genealogy.index.earliest.date.display;
  if (assertion?.evidenceRole === "EARLIEST_REPORTED_OCCURRENCE") {
    return `Index earliest: Reported ${display} (secondary; primary not re-inspected)`;
  }
  return `Index earliest: ${display}`;
}

async function renderCard(genealogy, fontData) {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const roles = roleLines(genealogy);
  const earliest = indexEarliestLine(genealogy);
  const finding =
    genealogy.finding.length > 160
      ? `${genealogy.finding.slice(0, 157)}…`
      : genealogy.finding;
  const meta = `${genealogy.sources.length} sources · revision ${genealogy.revision} · reviewed ${genealogy.reviewedAt}`;

  const children = [
    {
      type: "div",
      props: {
        style: {
          fontSize: 22,
          letterSpacing: 2,
          color: "#3d5a45",
          marginBottom: 18,
        },
        children: "ORIGIN",
      },
    },
    {
      type: "div",
      props: {
        style: {
          fontSize: 44,
          lineHeight: 1.15,
          marginBottom: 22,
          maxWidth: 1040,
        },
        children: `“${genealogy.phrase}”`,
      },
    },
  ];

  if (earliest) {
    children.push({
      type: "div",
      props: {
        style: {
          fontSize: 24,
          marginBottom: 10,
          color: "#243028",
          maxWidth: 1040,
        },
        children: earliest,
      },
    });
  }

  for (const line of roles) {
    children.push({
      type: "div",
      props: {
        style: {
          fontSize: 24,
          marginBottom: 8,
          color: "#243028",
          maxWidth: 1040,
        },
        children: line,
      },
    });
  }

  children.push({
    type: "div",
    props: {
      style: {
        fontSize: 22,
        marginTop: 18,
        color: "#1a241c",
        maxWidth: 1040,
      },
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
      fonts: [
        { name: "CardSerif", data: fontData, weight: 400, style: "normal" },
      ],
    },
  );
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
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

  const publishedSlugs = genealogies.map((genealogy) => genealogy.slug);
  if (verifyFrozenCards(genealogies)) {
    const removed = pruneStaleOgCards(outDir, publishedSlugs);
    if (removed.length) {
      console.log(
        `gen-og-cards: pruned ${removed.length} stale card(s): ${removed.join(", ")}`,
      );
    }
    return;
  }

  const fontData = await ensureFont();
  for (const genealogy of genealogies) {
    const outputPath = path.join(outDir, `${genealogy.slug}.png`);
    const png = await renderCard(genealogy, fontData);
    if (sha256(png) !== FROZEN_CARD_SHA256[genealogy.slug]) {
      throw new Error(`Generated OG card digest changed for ${genealogy.slug}.`);
    }
    fs.writeFileSync(outputPath, png);
    console.log("wrote", path.relative(root, outputPath), `${png.length} bytes`);
  }
  const removed = pruneStaleOgCards(outDir, publishedSlugs);
  if (removed.length) {
    console.log(
      `gen-og-cards: pruned ${removed.length} stale card(s): ${removed.join(", ")}`,
    );
  }
  console.log(`gen-og-cards: ok (${genealogies.length} published)`);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
