import { loadChain, loadChains } from "../pipeline/chains";
import { log, parseArgs } from "../pipeline/cli";
import { syncAgentsFromGraph } from "../pipeline/graph";
import { loadRules, topUnmapped } from "../pipeline/projects";
import { gapCheck, syncAgents } from "../pipeline/scan";
import { AgentStore } from "../pipeline/store";
import { scanSource, subgraphSource, writeAgentSources } from "../pipeline/sources";

/** Pages of 8004scan read after a subgraph sync: catches the last minutes and cross-checks the total. */
const SCAN_CROSSCHECK_PAGES = 5;

export async function syncChain(slug: string, full: boolean): Promise<void> {
  const cfg = loadChain(slug);
  const rules = loadRules(slug);
  const store = AgentStore.open(slug);
  const before = store.count();
  const apiKey = process.env.GRAPH_API_KEY;
  const useGraph = Boolean(apiKey && cfg.subgraphId);
  log(`${cfg.name}: sync start (${before} agents cached, ${full ? "full" : "incremental"}, source ${useGraph ? "subgraph + 8004scan cross-check" : "8004scan"})`);
  const t0 = Date.now();
  const sleepMs = Number(process.env.SCAN_SLEEP_MS ?? 1000);
  if (useGraph) {
    let g = await syncAgentsFromGraph({ cfg, store, apiKey: apiKey as string, rules, full, log });
    log(`${cfg.name}: subgraph ${g.pages} pages, ${g.newAgents} new, ${g.updatedAgents} updated, max agent id ${g.maxTokenId ?? "none"}`);
    // An incremental pass only covers recent agents. If the cache is clearly incomplete
    // (agent ids are dense, so count should be close to the highest id), walk everything.
    const expected = (store.maxTokenId() ?? 0) + 1;
    if (!full && store.count() < 0.95 * expected) {
      log(`${cfg.name}: cache has ${store.count()} agents but ids reach ${expected}; running a full subgraph walk`);
      g = await syncAgentsFromGraph({ cfg, store, apiKey: apiKey as string, rules, full: true, log });
      log(`${cfg.name}: subgraph full walk ${g.pages} pages, ${g.newAgents} new, ${g.updatedAgents} updated`);
    }
  }
  const res = await syncAgents({
    chainId: cfg.chainId,
    store,
    rules,
    full: useGraph ? false : full,
    maxPages: useGraph ? SCAN_CROSSCHECK_PAGES : undefined,
    log,
    sleepMs,
  });
  const gap = gapCheck(store, res.total);
  log(`${cfg.name}: 8004scan ${res.fetchedPages} pages, ${res.newAgents} new, ${res.updatedAgents} updated, stored ${gap.stored} of ${gap.total} (missing ${gap.missing}) in ${Math.round((Date.now() - t0) / 1000)}s`);
  if (gap.missing > 0 && gap.missing > res.total * 0.001) {
    log(useGraph ? `${cfg.name}: gap above 0.1% between the subgraph and 8004scan; the subgraph may be lagging` : `${cfg.name}: gap above 0.1%; rerun with --full to backfill`);
  }
  const readAt = new Date().toISOString();
  writeAgentSources(
    slug,
    useGraph
      ? { agents: subgraphSource(cfg, store.count(), readAt), crossCheck: scanSource(cfg, res.total, readAt) }
      : { agents: scanSource(cfg, res.total, readAt) },
  );
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
