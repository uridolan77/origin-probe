import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url =
  process.env.MEASUREMENT_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
if (!url) {
  console.error("MEASUREMENT_DATABASE_URL required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema_v1.sql"), "utf8");
await client.query(sql);
await client.end();
console.log("migrate: ok schema_v1");
