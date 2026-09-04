import { loadChain, loadChains, rpcUrls } from "../pipeline/chains";
import { log, parseArgs, todayUtc } from "../pipeline/cli";
import { fetchBalances } from "../pipeline/balances";
import { buildSnapshot } from "../pipeline/metrics";
import { nativePriceUsd } from "../pipeline/prices";
import { writeSnapshot } from "../pipeline/snapshots";
import { loadState, pricesFor, saveState, updateState } from "../pipeline/state";
import { AgentStore } from "../pipeline/store";

export async function balancesChain(slug: string): Promise<void> {
  const cfg = loadChain(slug);
  const store = AgentStore.open(slug);
  const agents = store.count();
  if (agents === 0) throw new Error(`${cfg.name}: no agents cached; run sync first`);
  let owners = store.owners();
  const limit = Number(process.env.BALANCES_LIMIT_OWNERS ?? 0);
  if (limit > 0) {
    owners = owners.slice(0, limit);
    log(`${cfg.name}: BALANCES_LIMIT_OWNERS=${limit}, smoke mode (snapshot will not be written)`);
  }
  const date = todayUtc();
  const rpcs = rpcUrls(cfg);
  log(`${cfg.name}: reading balances for ${owners.length} owner wallets via ${rpcs.length} RPC endpoint(s)`);
  const t0 = Date.now();
  const price = await nativePriceUsd(cfg.native.priceSymbol);
  log(`${cfg.name}: ${cfg.native.symbol} price ${price} USD`);
  const balances = await fetchBalances(cfg, owners, { rpcs, log });
  log(`${cfg.name}: balances read in ${Math.round((Date.now() - t0) / 1000)}s`);
  const prices = pricesFor(cfg, price);
  const prev = limit > 0 ? null : loadState(slug);
  const update = updateState(prev, balances, prices, cfg, date);
  log(`${cfg.name}: ${update.walletsWithAssets} wallets with assets, total ${update.totalAssetsUsd.toFixed(2)} USD, net flow ${update.netFlowUsd.toFixed(2)} USD, ${update.changedWallets} wallets moved`);
  for (const t of update.byToken) log(`   ${t.symbol.padEnd(6)} ${t.amount.toFixed(4)}  (${t.usd.toFixed(2)} USD)`);
  if (limit > 0) {
    store.close();
    return;
  }
  saveState(update.next);
  const snap = buildSnapshot({ date, agents, uniqueOwners: store.uniqueOwners(), update, nativePriceUsd: price, registrations: store.registrationsOn(date) });
  const p = writeSnapshot(slug, snap);
  log(`${cfg.name}: snapshot written to ${p}`);
  store.close();
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  const slugs = args.chain ? [args.chain] : loadChains().map((c) => c.slug);
  for (const s of slugs) await balancesChain(s);
}
