import type { ChainConfig } from "../pipeline/types";

export const CFG: ChainConfig = {
  slug: "bnb",
  chainId: 56,
  name: "BNB Chain",
  shortName: "BNB",
  color: "#f0b90b",
  explorerUrl: "https://bscscan.com",
  scanUrl: "https://8004scan.io/agents?chain=56",
  registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  rpcs: ["https://a.example", "https://b.example"],
  native: { symbol: "BNB", decimals: 18, priceSymbol: "BNBUSDT" },
  tokens: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, priceUsd: 1 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, priceUsd: 1 },
  ],
  liveSince: "2026-02-03",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function rawAgent(tokenId: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `uuid-${tokenId}`,
    agent_id: `56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:${tokenId}`,
    token_id: String(tokenId),
    chain_id: 56,
    owner_address: `0x${tokenId.toString(16).padStart(40, "0").toUpperCase()}`,
    name: `Agent#${tokenId}`,
    description: "",
    supported_protocols: ["A2A"],
    x402_supported: false,
    total_feedbacks: 0,
    created_at: "2026-09-04T12:29:28Z",
    ...overrides,
  };
}

/** Fake 8004scan: `all` is newest-first. Optional `failures` injects statuses for the first N calls. */
export function fakeScan(all: ReturnType<typeof rawAgent>[], failures: number[] = []) {
  const calls: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    calls.push(url);
    const fail = failures.shift();
    if (fail !== undefined) return jsonResponse({ detail: "boom" }, fail);
    const u = new URL(url);
    const limit = Number(u.searchParams.get("limit"));
    const offset = Number(u.searchParams.get("offset"));
    return jsonResponse({ total: all.length, limit, offset, items: all.slice(offset, offset + limit) });
  };
  return { fetchImpl, calls };
}

export const noSleep = async () => {};
