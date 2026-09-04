import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAddress, isAddress } from "viem";
import type { ChainConfig } from "./types";

const ROOT = join(import.meta.dir, "..");

export function loadChains(dir = join(ROOT, "chains")): ChainConfig[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ChainConfig);
}

export function loadChain(slug: string, dir = join(ROOT, "chains")): ChainConfig {
  const cfg = loadChains(dir).find((c) => c.slug === slug);
  if (!cfg) throw new Error(`Unknown chain "${slug}". Add chains/${slug}.json first.`);
  return cfg;
}

function checksummed(addr: unknown): boolean {
  return typeof addr === "string" && isAddress(addr) && getAddress(addr) === addr;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a list of human-readable problems. Empty list means the config is valid. */
export function validateChain(cfg: ChainConfig): string[] {
  const p: string[] = [];
  const where = `chains/${cfg?.slug ?? "?"}.json`;
  if (typeof cfg.slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cfg.slug)) p.push(`${where}: slug must be kebab-case`);
  if (!Number.isInteger(cfg.chainId) || cfg.chainId <= 0) p.push(`${where}: chainId must be a positive integer`);
  for (const key of ["name", "shortName", "explorerUrl", "scanUrl"] as const) {
    if (typeof cfg[key] !== "string" || cfg[key].length === 0) p.push(`${where}: ${key} is required`);
  }
  if (typeof cfg.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(cfg.color)) p.push(`${where}: color must be a #rrggbb hex`);
  if (!checksummed(cfg.registry)) p.push(`${where}: registry must be a checksummed address`);
  if (!checksummed(cfg.multicall3)) p.push(`${where}: multicall3 must be a checksummed address`);
  if (!Array.isArray(cfg.rpcs) || cfg.rpcs.length === 0) p.push(`${where}: rpcs must be a non-empty list`);
  else for (const r of cfg.rpcs) if (typeof r !== "string" || !r.startsWith("https://")) p.push(`${where}: rpc "${r}" must start with https://`);
  if (!cfg.native || typeof cfg.native.symbol !== "string" || !Number.isInteger(cfg.native.decimals) || typeof cfg.native.priceSymbol !== "string") {
    p.push(`${where}: native must have symbol, decimals and priceSymbol`);
  }
  if (!Array.isArray(cfg.tokens)) p.push(`${where}: tokens must be a list`);
  else {
    const symbols = new Set<string>();
    const addrs = new Set<string>();
    for (const t of cfg.tokens) {
      if (typeof t.symbol !== "string" || t.symbol.length === 0) p.push(`${where}: token symbol is required`);
      if (symbols.has(t.symbol)) p.push(`${where}: duplicate token symbol ${t.symbol}`);
      symbols.add(t.symbol);
      if (cfg.native && t.symbol === cfg.native.symbol) p.push(`${where}: token symbol ${t.symbol} clashes with the native symbol`);
      if (!checksummed(t.address)) p.push(`${where}: token ${t.symbol} address must be checksummed`);
      const lower = String(t.address).toLowerCase();
      if (addrs.has(lower)) p.push(`${where}: duplicate token address ${t.address}`);
      addrs.add(lower);
      if (!Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 36) p.push(`${where}: token ${t.symbol} decimals must be 0..36`);
      if (t.priceUsd === undefined && !t.priceSymbol) p.push(`${where}: token ${t.symbol} needs priceUsd or priceSymbol`);
    }
  }
  if (typeof cfg.liveSince !== "string" || !DATE_RE.test(cfg.liveSince) || Number.isNaN(Date.parse(cfg.liveSince))) {
    p.push(`${where}: liveSince must be YYYY-MM-DD`);
  }
  return p;
}

/** Private endpoints from RPC_URLS_<SLUG> (comma separated) go first, then the public list. */
export function rpcUrls(cfg: ChainConfig, env: Record<string, string | undefined> = process.env): string[] {
  const key = `RPC_URLS_${cfg.slug.toUpperCase().replace(/-/g, "_")}`;
  const priv = (env[key] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...priv, ...cfg.rpcs.filter((r) => !priv.includes(r))];
}
