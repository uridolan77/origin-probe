const SLUG = "culture-eats-strategy-for-breakfast";
const DEFAULT_MEASUREMENT_API = "https://origin-probe-measure.vercel.app";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function fail(reason, details = {}) {
  process.stderr.write(`${JSON.stringify({ status: "NOT_BOUND", reason, ...details })}\n`);
  process.exitCode = 1;
}

async function fetchText(url, expectedType) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "cache-control": "no-cache",
      "user-agent": "origin-g2-pages-binding-check/2",
    },
  });
  if (!response.ok) {
    throw new Error(`http_${response.status}:${url}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (expectedType && !contentType.includes(expectedType)) {
    throw new Error(`unexpected_content_type:${contentType}:${url}`);
  }
  return { text: await response.text(), finalUrl: response.url };
}

function scriptSources(html, pageUrl) {
  const sources = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js(?:\?[^"]*)?)"[^>]*>/g)) {
    sources.add(new URL(match[1].replaceAll("&amp;", "&"), pageUrl).href);
  }
  return sources;
}

const pagesInput = process.env.ORIGIN_PAGES_URL || argument("pages-url");
const expectedCommit = (process.env.ORIGIN_EXPECTED_COMMIT || argument("expected-commit") || "").toLowerCase();
const measurementApi = (
  process.env.ORIGIN_EXPECTED_MEASUREMENT_API ||
  argument("measurement-api") ||
  DEFAULT_MEASUREMENT_API
).replace(/\/$/, "");

if (!pagesInput) {
  fail("missing_pages_url");
} else if (!/^[0-9a-f]{40}$/.test(expectedCommit)) {
  fail("invalid_expected_commit");
} else {
  try {
    const pagesBase = new URL(pagesInput);
    const loopback = pagesBase.hostname === "127.0.0.1" || pagesBase.hostname === "localhost";
    if (pagesBase.protocol !== "https:" && !(loopback && pagesBase.protocol === "http:")) {
      throw new Error("pages_url_must_be_https");
    }
    pagesBase.pathname = `${pagesBase.pathname.replace(/\/$/, "")}/`;
    pagesBase.search = "";
    pagesBase.hash = "";

    const nonce = Date.now();
    const pageUrls = [
      new URL(`?origin_binding_check=${nonce}`, pagesBase).href,
      new URL(`g/${SLUG}/?origin_binding_check=${nonce}`, pagesBase).href,
    ];
    const pages = await Promise.all(pageUrls.map((url) => fetchText(url, "text/html")));
    const commitMarker = `data-origin-build-commit="${expectedCommit}"`;
    for (const page of pages) {
      if (!page.text.includes(commitMarker)) {
        throw new Error(`commit_marker_missing:${page.finalUrl}`);
      }
    }

    const sources = new Set();
    for (const page of pages) {
      for (const source of scriptSources(page.text, page.finalUrl)) sources.add(source);
    }
    if (sources.size === 0) throw new Error("no_javascript_chunks_discovered");
    const chunks = await Promise.all(
      [...sources].map((url) => fetchText(url, "javascript")),
    );
    const bundle = chunks.map(({ text }) => text).join("\n");
    const requiredBundleMarkers = [
      measurementApi,
      "Sharing is unavailable while measurement is offline.",
      "/v1/create-share",
      "/v1/share-arrival",
    ];
    for (const marker of requiredBundleMarkers) {
      if (!bundle.includes(marker)) throw new Error(`bundle_marker_missing:${marker}`);
    }

    process.stdout.write(
      `${JSON.stringify({
        status: "BOUND",
        pagesUrl: pagesBase.href.replace(/\/$/, ""),
        expectedCommit,
        measurementApi,
        checkedPages: pages.map(({ finalUrl }) => finalUrl),
        scriptsFetched: sources.size,
        requiredBundleMarkers,
        checkedAtUtc: new Date().toISOString(),
      })}\n`,
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : "unknown_error");
  }
}
