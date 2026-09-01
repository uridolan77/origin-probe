/**
 * Clean-room allow-list policy for the intentional public canonical hostname.
 * Broadening beyond the exact host is a policy failure.
 */
export const CLEANROOM_ALLOWED_EXACT_HOSTS = Object.freeze([
  "origin.ontogony.net",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mask allowed hosts only at hostname/token boundaries — not as substrings.
 */
export function maskAllowedHosts(text, hosts = CLEANROOM_ALLOWED_EXACT_HOSTS) {
  let out = text;
  for (const host of hosts) {
    const escaped = escapeRegExp(host);
    const re = new RegExp(`(?<![a-z0-9.-])${escaped}(?![a-z0-9.-])`, "gi");
    out = out.replace(re, "[canonical-host]");
  }
  return out;
}

export function isApprovedHostAllowList(hosts) {
  return (
    Array.isArray(hosts) &&
    hosts.length === 1 &&
    hosts[0] === "origin.ontogony.net"
  );
}

/**
 * Returns true when a hostname string equals an allowed host exactly.
 */
export function isExactAllowedHost(hostname, hosts = CLEANROOM_ALLOWED_EXACT_HOSTS) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return hosts.some((h) => h.toLowerCase() === normalized);
}
