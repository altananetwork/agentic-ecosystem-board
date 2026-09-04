import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { attribute } from "./projects";
import { addDays, todayUtc } from "./cli";
import type { AgentRecord, ProjectRule } from "./types";

/** Wallets that cannot spend: tokens sent here are burned, not owned. Excluded from owner metrics. */
export const BURN_ADDRESSES = ["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"] as const;
const BURN_LIST = BURN_ADDRESSES.map((a) => `'${a}'`).join(",");

const ROOT = join(import.meta.dir, "..");

type Row = {
  token_id: number;
  owner: string;
  name: string;
  description: string;
  project: string;
  protocols: string;
  x402: number;
  feedbacks: number;
  created_at: string;
  uri_host: string | null;
};

function fromRow(r: Row): AgentRecord {
  return {
    tokenId: r.token_id,
    owner: r.owner,
    name: r.name,
    description: r.description,
    project: r.project,
    protocols: JSON.parse(r.protocols || "[]"),
    x402: r.x402 === 1,
    feedbacks: r.feedbacks,
    createdAt: r.created_at,
    uriHost: r.uri_host ?? undefined,
  };
}

export class AgentStore {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS agents (
      token_id INTEGER PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT 'Unknown',
      protocols TEXT NOT NULL DEFAULT '[]',
      x402 INTEGER NOT NULL DEFAULT 0,
      feedbacks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );`);
    const cols = (this.db.query("PRAGMA table_info(agents)").all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes("uri_host")) this.db.exec("ALTER TABLE agents ADD COLUMN uri_host TEXT;");
    this.db.exec("CREATE INDEX IF NOT EXISTS agents_owner ON agents(owner);");
    this.db.exec("CREATE INDEX IF NOT EXISTS agents_created ON agents(created_at);");
    this.db.exec("CREATE INDEX IF NOT EXISTS agents_project ON agents(project);");
  }

  /** Opens cache/<slug>/agents.sqlite, creating the folder. */
  static open(slug: string, cacheDir = join(ROOT, "cache")): AgentStore {
    const dir = join(cacheDir, slug);
    mkdirSync(dir, { recursive: true });
    return new AgentStore(join(dir, "agents.sqlite"));
  }

  static memory(): AgentStore {
    return new AgentStore(":memory:");
  }

  upsertMany(records: AgentRecord[], rules: ProjectRule[] = []): void {
    const stmt = this.db.prepare(`INSERT INTO agents (token_id, owner, name, description, project, protocols, x402, feedbacks, created_at, uri_host)
      VALUES ($token_id, $owner, $name, $description, $project, $protocols, $x402, $feedbacks, $created_at, $uri_host)
      ON CONFLICT(token_id) DO UPDATE SET owner=excluded.owner, name=excluded.name, description=excluded.description,
        project=excluded.project, protocols=excluded.protocols, x402=excluded.x402, feedbacks=excluded.feedbacks, created_at=excluded.created_at,
        uri_host=COALESCE(excluded.uri_host, agents.uri_host)`);
    const tx = this.db.transaction((rows: AgentRecord[]) => {
      for (const r of rows) {
        stmt.run({
          $token_id: r.tokenId,
          $owner: r.owner.toLowerCase(),
          $name: r.name ?? "",
          $description: r.description ?? "",
          $project: rules.length > 0 || !r.project ? attribute(r, rules) : r.project,
          $protocols: JSON.stringify(r.protocols ?? []),
          $x402: r.x402 ? 1 : 0,
          $feedbacks: r.feedbacks ?? 0,
          $created_at: r.createdAt,
          $uri_host: r.uriHost ?? null,
        });
      }
    });
    tx(records);
  }

  has(tokenId: number): boolean {
    return this.db.query("SELECT 1 FROM agents WHERE token_id = ?").get(tokenId) !== null;
  }

  count(): number {
    return (this.db.query("SELECT COUNT(*) AS n FROM agents").get() as { n: number }).n;
  }

  maxTokenId(): number | null {
    const r = this.db.query("SELECT MAX(token_id) AS m FROM agents").get() as { m: number | null };
    return r.m;
  }

  /** Latest createdAt stored (ISO) or null when empty. */
  maxCreatedAt(): string | null {
    const r = this.db.query("SELECT MAX(created_at) AS m FROM agents").get() as { m: string | null };
    return r.m;
  }

  /** Distinct owner wallets, excluding burn addresses (agents sent there are not held by anyone). */
  owners(): string[] {
    return (this.db.query(`SELECT DISTINCT owner FROM agents WHERE owner NOT IN (${BURN_LIST}) ORDER BY owner`).all() as { owner: string }[]).map((r) => r.owner);
  }

  uniqueOwners(): number {
    return (this.db.query(`SELECT COUNT(DISTINCT owner) AS n FROM agents WHERE owner NOT IN (${BURN_LIST})`).get() as { n: number }).n;
  }

  *all(): IterableIterator<AgentRecord> {
    for (const row of this.db.query("SELECT * FROM agents ORDER BY token_id").iterate() as IterableIterator<Row>) {
      yield fromRow(row);
    }
  }

  /** Registrations per UTC day for the last `days` days ending today, zero-filled, oldest first. */
  registrationsByDay(days: number, today = todayUtc()): { date: string; count: number }[] {
    const start = addDays(today, -(days - 1));
    const rows = this.db
      .query("SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM agents WHERE created_at >= ? GROUP BY d")
      .all(`${start}T00:00:00Z`) as { d: string; n: number }[];
    const map = new Map(rows.map((r) => [r.d, r.n]));
    const out: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      out.push({ date, count: map.get(date) ?? 0 });
    }
    return out;
  }

  registrationsOn(date: string): number {
    const r = this.db.query("SELECT COUNT(*) AS n FROM agents WHERE substr(created_at, 1, 10) = ?").get(date) as { n: number };
    return r.n;
  }

  projectCounts(): { project: string; agents: number }[] {
    return this.db
      .query("SELECT project, COUNT(*) AS agents FROM agents GROUP BY project ORDER BY agents DESC, project ASC")
      .all() as { project: string; agents: number }[];
  }

  /** Re-run attribution for every stored agent (after the rules file changes). Returns rows changed. */
  reattributeAll(rules: ProjectRule[]): number {
    const update = this.db.prepare("UPDATE agents SET project = ? WHERE token_id = ? AND project <> ?");
    let changed = 0;
    const tx = this.db.transaction(() => {
      for (const a of this.all()) {
        const project = attribute(a, rules);
        if (project !== a.project) {
          update.run(project, a.tokenId, project);
          changed++;
        }
      }
    });
    tx();
    return changed;
  }

  close(): void {
    this.db.close();
  }
}
