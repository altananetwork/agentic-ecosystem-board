import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardSources, ChainConfig, SourceRef } from "./types";

const CACHE = join(import.meta.dir, "..", "cache");

function file(slug: string, part: "agents" | "holdings"): string {
  return join(CACHE, slug, `sources-${part}.json`);
}

export function writeAgentSources(slug: string, s: Pick<BoardSources, "agents" | "crossCheck">): void {
  mkdirSync(join(CACHE, slug), { recursive: true });
  writeFileSync(file(slug, "agents"), `${JSON.stringify(s, null, 2)}\n`);
}

export function writeHoldingSources(slug: string, s: Pick<BoardSources, "holdings" | "prices">): void {
  mkdirSync(join(CACHE, slug), { recursive: true });
  writeFileSync(file(slug, "holdings"), `${JSON.stringify(s, null, 2)}\n`);
}

/** Merge the two halves written by sync and balances. Undefined until both have run. */
export function readSources(slug: string): BoardSources | undefined {
  const a = file(slug, "agents");
  const h = file(slug, "holdings");
  if (!existsSync(a) || !existsSync(h)) return undefined;
  const agents = JSON.parse(readFileSync(a, "utf8")) as Pick<BoardSources, "agents" | "crossCheck">;
  const holdings = JSON.parse(readFileSync(h, "utf8")) as Pick<BoardSources, "holdings" | "prices">;
  return { ...agents, ...holdings };
}

export function subgraphSource(cfg: ChainConfig, agents: number, asOf: string): SourceRef {
  const id = cfg.subgraphId ?? "";
  return {
    name: "The Graph, Agent0 subgraph",
    url: `https://thegraph.com/explorer/subgraphs/${id}`,
    detail: `subgraph ${id.slice(0, 4)}…${id.slice(-4)}, registry ${cfg.registry}`,
    asOf,
    value: agents,
  };
}

export function scanSource(cfg: ChainConfig, agents: number, asOf: string): SourceRef {
  return { name: "8004scan", url: cfg.scanUrl, detail: `chain id ${cfg.chainId}`, asOf, value: agents };
}

export function holdingsSource(cfg: ChainConfig, rpc: string, wallets: number, asOf: string): SourceRef {
  let host = rpc;
  try {
    host = new URL(rpc).host;
  } catch {
    /* keep as is */
  }
  const tokens = [cfg.native.symbol, ...cfg.tokens.map((t) => t.symbol)].join(", ");
  return {
    name: "On-chain via Multicall3",
    url: `${cfg.explorerUrl}/address/${cfg.multicall3}`,
    detail: `RPC ${host}, ${wallets.toLocaleString("en-US")} wallets, ${tokens}`,
    asOf,
  };
}

export function priceSource(cfg: ChainConfig, price: number, asOf: string): SourceRef {
  const sym = cfg.native.priceSymbol;
  const pair = sym.endsWith("USDT") ? `${sym.slice(0, -4)}_USDT` : sym;
  return { name: "Binance spot", url: `https://www.binance.com/en/trade/${pair}`, detail: sym, asOf, value: price };
}
