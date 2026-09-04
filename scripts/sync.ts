import { loadChain, loadChains } from "../pipeline/chains";
import { log, parseArgs } from "../pipeline/cli";
import { loadRules, topUnmapped } from "../pipeline/projects";
import { gapCheck, syncAgents } from "../pipeline/scan";
import { AgentStore } from "../pipeline/store";

export async function syncChain(slug: string, full: boolean): Promise<void> {
  const cfg = loadChain(slug);
  const rules = loadRules(slug);
  const store = AgentStore.open(slug);
  const before = store.count();
  log(`${cfg.name}: sync start (${before} agents cached, ${full ? "full" : "incremental"})`);
  const t0 = Date.now();
  const sleepMs = Number(process.env.SCAN_SLEEP_MS ?? 1000);
  const res = await syncAgents({ chainId: cfg.chainId, store, rules, full, log, sleepMs });
  const gap = gapCheck(store, res.total);
  log(`${cfg.name}: ${res.fetchedPages} pages, ${res.newAgents} new, ${res.updatedAgents} updated, stored ${gap.stored} of ${gap.total} (missing ${gap.missing}) in ${Math.round((Date.now() - t0) / 1000)}s`);
  if (gap.missing > 0 && gap.missing > res.total * 0.001) {
    log(`${cfg.name}: gap above 0.1%; rerun with --full to backfill`);
  }
  const unmapped = topUnmapped(store.all(), rules, 10);
  if (unmapped.length > 0) {
    log(`${cfg.name}: top names without a project rule:`);
    for (const u of unmapped) log(`   ${u.agents.toString().padStart(7)}  ${u.name}`);
  }
  store.close();
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  const slugs = args.chain ? [args.chain] : loadChains().map((c) => c.slug);
  for (const s of slugs) await syncChain(s, args.full);
}
