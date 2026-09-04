import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChain, loadChains } from "../pipeline/chains";
import { log, parseArgs, todayUtc } from "../pipeline/cli";
import { buildIndex, buildPayload } from "../pipeline/metrics";
import { listSnapshots } from "../pipeline/snapshots";
import { loadState } from "../pipeline/state";
import { AgentStore } from "../pipeline/store";
import { readSources } from "../pipeline/sources";
import type { BoardPayload } from "../pipeline/types";

const OUT = join(import.meta.dir, "..", "public", "data");

export function buildChain(slug: string, asOf = new Date().toISOString()): BoardPayload {
  const cfg = loadChain(slug);
  const store = AgentStore.open(slug);
  const snapshots = listSnapshots(slug);
  const payload = buildPayload({
    cfg,
    snapshots,
    registrationsDaily: store.registrationsByDay(31),
    projectCounts: store.projectCounts(),
    state: loadState(slug),
    totals: { agents: store.count(), uniqueOwners: store.uniqueOwners() },
    asOf,
    today: todayUtc(),
  });
  store.close();
  const sources = readSources(slug);
  if (sources) payload.sources = sources;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  log(`${cfg.name}: payload written (${payload.totals.agents} agents, ${payload.totals.uniqueOwners} owners, ${payload.totals.totalAssetsUsd} USD, ${snapshots.length} snapshot(s))`);
  return payload;
}

export function buildAll(slugs: string[]): void {
  const asOf = new Date().toISOString();
  const payloads = slugs.map((s) => buildChain(s, asOf));
  // Keep chains that already have a payload but were not rebuilt this run.
  const existing: BoardPayload[] = [];
  for (const c of loadChains()) {
    if (slugs.includes(c.slug)) continue;
    try {
      existing.push(JSON.parse(require("node:fs").readFileSync(join(OUT, `${c.slug}.json`), "utf8")));
    } catch {
      /* not built yet */
    }
  }
  writeFileSync(join(OUT, "index.json"), `${JSON.stringify(buildIndex([...payloads, ...existing], asOf), null, 2)}\n`);
  log(`index written for ${payloads.length + existing.length} chain(s)`);
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  buildAll(args.chain ? [args.chain] : loadChains().map((c) => c.slug));
}
