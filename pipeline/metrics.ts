import { addDays } from "./cli";
import type { BoardPayload, ChainConfig, DailySnapshot, IndexPayload, WalletStateFile } from "./types";
import type { StateUpdate } from "./state";

export const WINDOW_DAYS = 30;
export const TOP_PROJECTS = 10;

export function buildSnapshot(args: { date: string; agents: number; uniqueOwners: number; update: StateUpdate; nativePriceUsd: number; registrations: number }): DailySnapshot {
  const { date, agents, uniqueOwners, update, nativePriceUsd, registrations } = args;
  return {
    date,
    agents,
    uniqueOwners,
    walletsWithAssets: update.walletsWithAssets,
    totalAssetsUsd: round2(update.totalAssetsUsd),
    byToken: update.byToken.map((t) => ({ symbol: t.symbol, amount: round(t.amount, 6), usd: round2(t.usd) })),
    nativePriceUsd,
    netFlowUsd: round2(update.netFlowUsd),
    changedWallets: update.changedWallets,
    grossFlowUsd: round2(update.grossFlowUsd),
    registrations,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function topProjects(counts: { project: string; agents: number }[], total: number, limit = TOP_PROJECTS): BoardPayload["topProjects"] {
  // Agents that matched no rule and have no usable name are grouped under Other, not shown as a project.
  const named = counts.filter((c) => c.project !== "Unknown");
  const unknown = counts.filter((c) => c.project === "Unknown").reduce((s, c) => s + c.agents, 0);
  const sorted = [...named].sort((a, b) => b.agents - a.agents || a.project.localeCompare(b.project));
  const denom = total > 0 ? total : sorted.reduce((s, c) => s + c.agents, 0) || 1;
  const head = sorted.slice(0, limit).map((c) => ({ project: c.project, agents: c.agents, share: round(c.agents / denom, 4) }));
  const rest = sorted.slice(limit).reduce((s, c) => s + c.agents, 0) + unknown;
  if (rest > 0) head.push({ project: "Other", agents: rest, share: round(rest / denom, 4) });
  return head;
}

export function activityWindow(snapshots: DailySnapshot[], state: WalletStateFile | null, today: string, windowDays = WINDOW_DAYS): BoardPayload["activity"] {
  const floor = addDays(today, -(windowDays - 1));
  const inWindow = snapshots.filter((s) => s.date >= floor && s.date <= today);
  const since = inWindow[0]?.date ?? today;
  const daysCovered = inWindow.length;
  let activeWallets = 0;
  if (state) for (const w of Object.values(state.wallets)) if (w.lastChanged !== null && w.lastChanged >= since) activeWallets++;
  // The first snapshot has no previous run, so its netFlow is 0 by construction; summing is safe.
  const netFlowUsd = round2(inWindow.reduce((s, x) => s + x.netFlowUsd, 0));
  const volumeUsd = round2(inWindow.reduce((s, x) => s + (x.grossFlowUsd ?? 0), 0));
  return { windowDays, since, daysCovered, activeWallets, netFlowUsd, volumeUsd };
}

export function methodology(cfg: ChainConfig): string[] {
  const tokens = [cfg.native.symbol, ...cfg.tokens.map((t) => t.symbol)].join(", ");
  return [
    `Agents are ERC-8004 identities minted by the registry at ${cfg.registry} on ${cfg.name}, as indexed by the Agent0 subgraph on The Graph and cross-checked against 8004scan. Counts can differ slightly between the two indexers.`,
    "Owner wallets are the current holders of those agent NFTs. One wallet can own many agents. Burn addresses are excluded, so agents sent there count as agents but not as owners.",
    `Holdings are the ${tokens} balances of every owner wallet, read directly from the chain through Multicall3 at build time and priced in USD with the ${cfg.native.symbol} spot price from Binance.`,
    "Active wallets are owner wallets whose balances moved at least once inside the 30-day window, measured from one daily snapshot to the next.",
    "Net flow is the change in token amounts held by wallets present in consecutive snapshots, valued at that day's prices. Price moves and wallets joining or leaving the owner set do not count. It is not transfer volume, which this board does not track.",
    "Top projects group agents by the name they registered with, or by the host of their metadata URI, using the community-maintained rules file in the repository.",
    "Every number on this page is rebuilt daily by a public pipeline and committed to the repository, so the full history is reproducible.",
  ];
}

export type BuildPayloadArgs = {
  cfg: ChainConfig;
  snapshots: DailySnapshot[];
  registrationsDaily: { date: string; count: number }[];
  projectCounts: { project: string; agents: number }[];
  state: WalletStateFile | null;
  totals: { agents: number; uniqueOwners: number };
  asOf: string;
  today: string;
};

export function buildPayload(a: BuildPayloadArgs): BoardPayload {
  const latest = a.snapshots[a.snapshots.length - 1];
  const { cfg } = a;
  return {
    schemaVersion: 1,
    chain: { slug: cfg.slug, chainId: cfg.chainId, name: cfg.name, shortName: cfg.shortName, color: cfg.color, explorerUrl: cfg.explorerUrl, scanUrl: cfg.scanUrl, registry: cfg.registry },
    asOf: a.asOf,
    totals: {
      agents: a.totals.agents,
      uniqueOwners: a.totals.uniqueOwners,
      walletsWithAssets: latest?.walletsWithAssets ?? 0,
      totalAssetsUsd: latest?.totalAssetsUsd ?? 0,
      byToken: latest?.byToken ?? [],
      nativePriceUsd: latest?.nativePriceUsd ?? a.state?.nativePriceUsd ?? 0,
    },
    activity: activityWindow(a.snapshots, a.state, a.today),
    registrationsDaily: a.registrationsDaily,
    history: a.snapshots.map((s) => ({ date: s.date, agents: s.agents, totalAssetsUsd: s.totalAssetsUsd, walletsWithAssets: s.walletsWithAssets, netFlowUsd: s.netFlowUsd })),
    topProjects: topProjects(a.projectCounts, a.totals.agents),
    methodology: methodology(cfg),
  };
}

export function buildIndex(payloads: BoardPayload[], generatedAt: string): IndexPayload {
  return {
    schemaVersion: 1,
    generatedAt,
    chains: payloads
      .map((p) => ({
        slug: p.chain.slug,
        name: p.chain.name,
        shortName: p.chain.shortName,
        chainId: p.chain.chainId,
        color: p.chain.color,
        asOf: p.asOf,
        agents: p.totals.agents,
        uniqueOwners: p.totals.uniqueOwners,
        totalAssetsUsd: p.totals.totalAssetsUsd,
      }))
      .sort((x, y) => y.agents - x.agents),
  };
}
