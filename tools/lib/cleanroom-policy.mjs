/**
 * Clean-room allow-list policy for the intentional public canonical hostname.
 * Broadening beyond the exact host is a policy failure.
 */
export const CLEANROOM_ALLOWED_EXACT_HOSTS = Object.freeze([
  "origin.ontogony.net",
]);

export function maskAllowedHosts(text, hosts = CLEANROOM_ALLOWED_EXACT_HOSTS) {
  let out = text;
  for (const host of hosts) {
    const re = new RegExp(host.replace(/\./g, "\\."), "gi");
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
