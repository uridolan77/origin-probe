import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** @typedef {{ id: string, at: string, type: string, [k: string]: unknown }} StoredEvent */

export class EventStore {
  /**
   * @param {{ storePath?: string, seedEvents?: StoredEvent[] }} opts
   */
  constructor(opts = {}) {
    this.storePath = opts.storePath || "";
    /** @type {StoredEvent[]} */
    this.events = Array.isArray(opts.seedEvents) ? [...opts.seedEvents] : [];
    if (this.storePath && fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        this.events.push(JSON.parse(line));
      }
    }
  }

  /**
   * @param {Omit<StoredEvent, "id"> & { type: string }} event
   */
  append(event) {
    const stored = {
      id: crypto.randomBytes(12).toString("hex"),
      ...event,
      at: event.at || new Date().toISOString(),
    };
    this.events.push(stored);
    if (this.storePath) {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.appendFileSync(this.storePath, JSON.stringify(stored) + "\n", "utf8");
    }
    return stored;
  }

  list() {
    return [...this.events];
  }

  clear() {
    this.events = [];
    if (this.storePath && fs.existsSync(this.storePath)) {
      fs.writeFileSync(this.storePath, "", "utf8");
    }
  }
}

/** Process-global store for warm serverless / local server. */
let globalStore;

export function getStore(storePath) {
  if (!globalStore) {
    globalStore = new EventStore({ storePath });
  }
  return globalStore;
}

export function resetStoreForTests(storePath = "") {
  globalStore = new EventStore({ storePath });
  return globalStore;
}
