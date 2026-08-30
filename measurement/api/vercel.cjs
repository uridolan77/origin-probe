/**
 * Mark old process-local CJS entry retired.
 * Authoritative runtime is api/index.js + PostgresLedger.
 * Do not deploy this file as Window 002 ledger authority.
 */
module.exports = function retired(_req, res) {
  res.statusCode = 503;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      ok: false,
      error: "retired_process_local_adapter",
      use: "api/index.js with MEASUREMENT_DATABASE_URL",
    }),
  );
};
