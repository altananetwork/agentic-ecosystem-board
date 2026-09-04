import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatUnits } from "viem";
import type { Balances } from "./balances";
import type { ChainConfig, WalletState, WalletStateFile } from "./types";

const ROOT = join(import.meta.dir, "..");

export function statePath(slug: string, cacheDir = join(ROOT, "cache")): string {
  return join(cacheDir, slug, "wallets.json");
}

export function loadState(slug: string, cacheDir?: string): WalletStateFile | null {
  const p = statePath(slug, cacheDir);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as WalletStateFile;
}

export function saveState(state: WalletStateFile, cacheDir = join(ROOT, "cache")): string {
  const p = statePath(state.chain, cacheDir);
  mkdirSync(join(cacheDir, state.chain), { recursive: true });
  writeFileSync(p, JSON.stringify(state));
  return p;
}

export type Prices = Record<string, number>; // symbol -> usd

export function pricesFor(cfg: ChainConfig, nativePriceUsd: number, extra: Prices = {}): Prices {
  const p: Prices = { [cfg.native.symbol]: nativePriceUsd };
  for (const t of cfg.tokens) p[t.symbol] = t.priceUsd ?? extra[t.symbol] ?? 0;
  return p;
}

function decimalsOf(cfg: ChainConfig, symbol: string): number {
  if (symbol === cfg.native.symbol) return cfg.native.decimals;
  return cfg.tokens.find((t) => t.symbol === symbol)?.decimals ?? 18;
}

export function toAmount(cfg: ChainConfig, symbol: string, raw: bigint | string): number {
  return Number(formatUnits(BigInt(raw), decimalsOf(cfg, symbol)));
}

export function usdOf(cfg: ChainConfig, raw: Record<string, bigint | string>, prices: Prices): number {
  let usd = 0;
  for (const [sym, v] of Object.entries(raw)) usd += toAmount(cfg, sym, v) * (prices[sym] ?? 0);
  return usd;
}

export type StateUpdate = {
  next: WalletStateFile;
  netFlowUsd: number;
  changedWallets: number;
  walletsWithAssets: number;
  totalAssetsUsd: number;
  byToken: { symbol: string; amount: number; usd: number }[];
};

/** Folds today's balances into the previous state. Wallets absent from `today` keep their last values. */
export function updateState(prev: WalletStateFile | null, today: Balances, prices: Prices, cfg: ChainConfig, date: string): StateUpdate {
  const wallets: Record<string, WalletState> = { ...(prev?.wallets ?? {}) };
  const first = prev === null;
  let netFlowUsd = 0;
  let changedWallets = 0;
  for (const [owner, raw] of today) {
    const rawStr: Record<string, string> = {};
    for (const [sym, v] of Object.entries(raw)) rawStr[sym] = v.toString();
    const usd = usdOf(cfg, raw, prices);
    const before = wallets[owner];
    const moved = before ? Object.keys({ ...before.raw, ...rawStr }).some((k) => (before.raw[k] ?? "0") !== (rawStr[k] ?? "0")) : false;
    if (!first) {
      netFlowUsd += usd - (before?.usd ?? 0);
      if (!before || moved) changedWallets++;
    }
    wallets[owner] = {
      raw: rawStr,
      usd,
      firstSeen: before?.firstSeen ?? date,
      lastChanged: before && !moved ? before.lastChanged : date,
    };
  }
  const symbols = [cfg.native.symbol, ...cfg.tokens.map((t) => t.symbol)];
  const totals: Record<string, { amount: number; usd: number }> = Object.fromEntries(symbols.map((s) => [s, { amount: 0, usd: 0 }]));
  let walletsWithAssets = 0;
  let totalAssetsUsd = 0;
  for (const w of Object.values(wallets)) {
    if (w.usd > 0) walletsWithAssets++;
    totalAssetsUsd += w.usd;
    for (const s of symbols) {
      const amount = toAmount(cfg, s, w.raw[s] ?? "0");
      totals[s].amount += amount;
      totals[s].usd += amount * (prices[s] ?? 0);
    }
  }
  const next: WalletStateFile = { schemaVersion: 1, chain: cfg.slug, asOf: date, nativePriceUsd: prices[cfg.native.symbol] ?? 0, wallets };
  return {
    next,
    netFlowUsd: first ? 0 : netFlowUsd,
    changedWallets: first ? 0 : changedWallets,
    walletsWithAssets,
    totalAssetsUsd,
    byToken: symbols.map((s) => ({ symbol: s, amount: totals[s].amount, usd: totals[s].usd })),
  };
}
