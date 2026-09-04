/**
 * Shared shapes. `BoardPayload` is what the pipeline writes to public/data/<slug>.json
 * and what the site renders. Keep this file free of runtime imports so the Next.js app
 * can import the types without pulling pipeline code.
 */

export type ChainToken = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  /** Fixed USD price for stablecoins. Omit to look the price up by priceSymbol. */
  priceUsd?: number;
  priceSymbol?: string;
};

export type ChainConfig = {
  slug: string;
  chainId: number;
  name: string;
  shortName: string;
  color: string;
  explorerUrl: string;
  scanUrl: string;
  registry: `0x${string}`;
  multicall3: `0x${string}`;
  rpcs: string[];
  native: { symbol: string; decimals: number; priceSymbol: string };
  tokens: ChainToken[];
  liveSince: string;
  /** Optional Agent0 subgraph id on The Graph; used when GRAPH_API_KEY is set. */
  subgraphId?: string;
};

/** One agent as stored in the local cache (from 8004scan). */
export type AgentRecord = {
  tokenId: number;
  owner: string; // lowercase 0x
  name: string;
  description: string;
  project: string;
  protocols: string[];
  x402: boolean;
  feedbacks: number;
  createdAt: string; // ISO
  /** host of the agentURI when known (subgraph source); enables host rules */
  uriHost?: string;
};

export type ProjectRule = {
  match: "name" | "description" | "host";
  value: string;
  project: string;
};

/** Per-wallet state kept in cache/<slug>/wallets.json (hot) and backed up to a release asset. */
export type WalletState = {
  /** raw balances as decimal strings keyed by symbol (native included) */
  raw: Record<string, string>;
  usd: number;
  firstSeen: string; // YYYY-MM-DD
  /** YYYY-MM-DD of the last observed balance move; null until a move has been seen between two runs */
  lastChanged: string | null;
};

export type WalletStateFile = {
  schemaVersion: 1;
  chain: string;
  asOf: string; // YYYY-MM-DD
  nativePriceUsd: number;
  wallets: Record<string, WalletState>;
};

/** Small committed summary written every run to data/snapshots/<slug>/<date>.json */
export type DailySnapshot = {
  date: string; // YYYY-MM-DD
  agents: number;
  uniqueOwners: number;
  walletsWithAssets: number;
  totalAssetsUsd: number;
  byToken: { symbol: string; amount: number; usd: number }[];
  nativePriceUsd: number;
  /** sum over wallets of (usd today - usd previous run); 0 on the first run */
  netFlowUsd: number;
  /** wallets whose balances moved since the previous run */
  changedWallets: number;
  /** sum of absolute token amount changes valued in USD since the previous run (gross movement) */
  grossFlowUsd: number;
  registrations: number; // agents created on this date (UTC)
};

export type BoardPayload = {
  schemaVersion: 1;
  chain: Pick<ChainConfig, "slug" | "chainId" | "name" | "shortName" | "color" | "explorerUrl" | "scanUrl" | "registry">;
  asOf: string; // ISO timestamp of the build
  totals: {
    agents: number;
    uniqueOwners: number;
    walletsWithAssets: number;
    totalAssetsUsd: number;
    byToken: { symbol: string; amount: number; usd: number }[];
    nativePriceUsd: number;
  };
  activity: {
    windowDays: number;
    /** first date covered by the window (may be later than 30 days ago while history builds) */
    since: string;
    daysCovered: number;
    activeWallets: number;
    netFlowUsd: number;
    /** gross balance movement across owner wallets over the window, USD */
    volumeUsd: number;
  };
  /** last 31 days, oldest first, zero-filled */
  registrationsDaily: { date: string; count: number }[];
  /** every committed snapshot, oldest first */
  history: { date: string; agents: number; totalAssetsUsd: number; walletsWithAssets: number; netFlowUsd: number }[];
  topProjects: { project: string; agents: number; share: number }[];
  methodology: string[];
  /** Where each group of numbers comes from, shown on the board next to the metrics. */
  sources?: BoardSources;
};

export type SourceRef = {
  /** Human name, e.g. "The Graph, Agent0 subgraph" */
  name: string;
  /** Link a reader can open to see the same data */
  url: string;
  /** One line of detail: subgraph id, RPC host, ticker symbol */
  detail?: string;
  /** ISO timestamp of the read */
  asOf: string;
  /** Headline number from that source, when it has one (agent count, price) */
  value?: number;
};

export type BoardSources = {
  /** Primary agent index (subgraph when a key is configured, otherwise 8004scan) */
  agents: SourceRef;
  /** Independent count used as a cross-check, when different from the primary */
  crossCheck?: SourceRef;
  /** Balance reads on the chain itself */
  holdings: SourceRef;
  /** Native token price */
  prices: SourceRef;
};

export type IndexPayload = {
  schemaVersion: 1;
  generatedAt: string;
  chains: {
    slug: string;
    name: string;
    shortName: string;
    chainId: number;
    color: string;
    asOf: string;
    agents: number;
    uniqueOwners: number;
    totalAssetsUsd: number;
  }[];
};
