import { createPublicClient, erc20Abi, http, multicall3Abi, type Address } from "viem";
import { sleep } from "./cli";
import type { ChainConfig } from "./types";

export type Balances = Map<string, Record<string, bigint>>;

/** Minimal surface of a viem public client that we need, so tests can fake it. */
export type MulticallClient = {
  multicall: (args: { contracts: readonly unknown[]; allowFailure: true; batchSize?: number; multicallAddress?: Address }) => Promise<{ status: "success" | "failure"; result?: unknown }[]>;
};

export type ClientFactory = (rpc: string, cfg: ChainConfig) => MulticallClient;

export const defaultClientFactory: ClientFactory = (rpc, cfg) =>
  createPublicClient({
    chain: { id: cfg.chainId, name: cfg.name, nativeCurrency: { name: cfg.native.symbol, symbol: cfg.native.symbol, decimals: cfg.native.decimals }, rpcUrls: { default: { http: [rpc] } }, contracts: { multicall3: { address: cfg.multicall3 } } },
    transport: http(rpc, { timeout: 30_000, retryCount: 0 }),
  }) as unknown as MulticallClient;

export type FetchBalancesOptions = {
  rpcs: string[];
  batchSize?: number;
  concurrency?: number;
  clientFactory?: ClientFactory;
  sleepImpl?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function callsFor(cfg: ChainConfig, owners: string[]) {
  const calls: unknown[] = [];
  for (const o of owners) {
    calls.push({ address: cfg.multicall3, abi: multicall3Abi, functionName: "getEthBalance", args: [o as Address] });
    for (const t of cfg.tokens) calls.push({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [o as Address] });
  }
  return calls;
}

/**
 * Reads native + configured token balances for every owner through Multicall3.
 * One eth_call per batch of owners; batches run with bounded concurrency; failures rotate RPC and retry.
 */
export async function fetchBalances(cfg: ChainConfig, owners: string[], opts: FetchBalancesOptions): Promise<Balances> {
  const { rpcs, batchSize = 200, concurrency = 4, clientFactory = defaultClientFactory, sleepImpl = sleep, log = () => {} } = opts;
  if (rpcs.length === 0) throw new Error("fetchBalances: no RPC endpoints");
  const clients = new Map<string, MulticallClient>();
  const clientFor = (rpc: string) => {
    let c = clients.get(rpc);
    if (!c) {
      c = clientFactory(rpc, cfg);
      clients.set(rpc, c);
    }
    return c;
  };
  const result: Balances = new Map();
  const batches = chunk(owners, batchSize);
  const perOwner = 1 + cfg.tokens.length;
  let rpcIndex = 0;
  let done = 0;
  const maxTries = Math.max(3, rpcs.length * 3);

  async function runBatch(batch: string[]): Promise<void> {
    const contracts = callsFor(cfg, batch);
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxTries; attempt++) {
      const rpc = rpcs[rpcIndex % rpcs.length];
      try {
        const res = await clientFor(rpc).multicall({ contracts, allowFailure: true, batchSize: 0, multicallAddress: cfg.multicall3 });
        if (res.length !== contracts.length) throw new Error(`multicall returned ${res.length} results for ${contracts.length} calls`);
        batch.forEach((owner, i) => {
          const rec: Record<string, bigint> = {};
          const base = i * perOwner;
          const nat = res[base];
          rec[cfg.native.symbol] = nat.status === "success" ? BigInt(nat.result as bigint) : 0n;
          cfg.tokens.forEach((t, j) => {
            const r = res[base + 1 + j];
            rec[t.symbol] = r.status === "success" ? BigInt(r.result as bigint) : 0n;
          });
          result.set(owner, rec);
        });
        return;
      } catch (e) {
        lastErr = e;
        rpcIndex++;
        log(`batch failed on ${rpc} (${(e as Error).message.slice(0, 120)}), rotating`);
        await sleepImpl(Math.min(10_000, 300 * 2 ** attempt));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  let next = 0;
  async function worker(): Promise<void> {
    while (next < batches.length) {
      const idx = next++;
      await runBatch(batches[idx]);
      done++;
      if (done % 50 === 0 || done === batches.length) log(`balances: ${done}/${batches.length} batches`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));
  return result;
}
