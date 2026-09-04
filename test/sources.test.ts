import { describe, expect, test } from "bun:test";
import { loadChain } from "../pipeline/chains";
import { holdingsSource, priceSource, scanSource, subgraphSource } from "../pipeline/sources";

const cfg = loadChain("bnb");
const at = "2026-09-04T14:00:00.000Z";

describe("sources", () => {
  test("subgraph source links to the explorer and carries the count", () => {
    const s = subgraphSource(cfg, 333972, at);
    expect(s.url).toContain(cfg.subgraphId ?? "missing");
    expect(s.value).toBe(333972);
    expect(s.detail).toContain(cfg.registry);
  });
  test("8004scan source links to the chain page", () => {
    const s = scanSource(cfg, 302519, at);
    expect(s.url).toBe(cfg.scanUrl);
    expect(s.value).toBe(302519);
  });
  test("holdings source names the RPC host, wallet count and tokens", () => {
    const s = holdingsSource(cfg, "https://bsc-rpc.publicnode.com", 270064, at);
    expect(s.detail).toBe("RPC bsc-rpc.publicnode.com, 270,064 wallets, BNB, USDT, USDC");
    expect(s.url).toContain(cfg.multicall3);
  });
  test("price source links to the Binance pair", () => {
    const s = priceSource(cfg, 715.02, at);
    expect(s.url).toBe("https://www.binance.com/en/trade/BNB_USDT");
    expect(s.value).toBe(715.02);
  });
});
