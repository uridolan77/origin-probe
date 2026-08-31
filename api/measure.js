const UPSTREAM_ORIGIN = "https://origin-probe-measure.vercel.app";
const TRUSTED_BROWSER_ORIGIN = "https://uridolan77.github.io";
const PUBLIC_POST_PATHS = new Set([
  "/v1/result-view",
  "/v1/create-share",
  "/v1/share-arrival",
]);
const PUBLIC_GET_PATHS = new Set(["/v1/health"]);

function measurementPath(req) {
  const url = new URL(req.url || "/", "https://origin.ontogony.net");
  const captured = url.searchParams.get("path") || "";
  const normalized = captured.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

function requestBody(req) {
  if (req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

export default async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  const path = measurementPath(req);

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("allow", "GET, POST, OPTIONS");
    res.end();
    return;
  }

  const allowed =
    (method === "POST" && PUBLIC_POST_PATHS.has(path)) ||
    (method === "GET" && PUBLIC_GET_PATHS.has(path));

  if (!allowed) {
    res.statusCode = method === "GET" || method === "POST" ? 404 : 405;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "measurement_route_not_exposed" }));
    return;
  }

  const body = method === "POST" ? requestBody(req) : undefined;
  if (body && new TextEncoder().encode(body).byteLength > 8192) {
    res.statusCode = 413;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "body_too_large" }));
    return;
  }

  try {
    const headers = {
      accept: "application/json",
      origin: TRUSTED_BROWSER_ORIGIN,
      "user-agent": String(req.headers["user-agent"] || "Origin custom-domain bridge"),
    };

    if (method === "POST") {
      headers["content-type"] = "application/json";
      const clientId = req.headers["x-origin-client-raw"];
      if (
        typeof clientId === "string" &&
        /^[A-Za-z0-9._:-]{8,256}$/.test(clientId)
      ) {
        headers["x-origin-client-raw"] = clientId;
      }
    }

    const upstreamResponse = await fetch(new URL(path, UPSTREAM_ORIGIN), {
      method,
      headers,
      body,
      redirect: "manual",
    });

    res.statusCode = upstreamResponse.status;
    res.setHeader(
      "content-type",
      upstreamResponse.headers.get("content-type") ||
        "application/json; charset=utf-8",
    );
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-origin-measurement-bridge", "public-routes-only");
    res.end(await upstreamResponse.text());
  } catch {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "measurement_upstream_unavailable" }));
  }
}
