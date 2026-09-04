import { describe, expect, test } from "bun:test";
import { fetchBalances, type MulticallClient } from "../pipeline/balances";
import { CFG } from "./helpers";

function owners(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`);
}

/** Fake client: returns balance = index of the call; optionally fails the first `failures` calls per rpc. */
function fakeFactory(failing: Set<string>) {
  const calls: { rpc: string; n: number }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const factory = (rpc: string): MulticallClient => ({
    multicall: async ({ contracts }) => {
      calls.push({ rpc, n: contracts.length });
      if (failing.has(rpc)) throw new Error(`rpc ${rpc} down`);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return contracts.map((_, i) => (i % 7 === 6 ? { status: "failure" as const } : { status: "success" as const, result: BigInt(i) }));
    },
  });
  return { factory, calls, maxInFlight: () => maxInFlight };
}

describe("fetchBalances", () => {
  test("batches owners, caps concurrency, maps results per symbol", async () => {
    const f = fakeFactory(new Set());
    const res = await fetchBalances(CFG, owners(1000), { rpcs: ["https://a"], batchSize: 200, concurrency: 3, clientFactory: f.factory, sleepImpl: async () => {} });
    expect(f.calls.length).toBe(5);
    expect(f.calls[0].n).toBe(600); // 200 owners x (native + 2 tokens)
    expect(f.maxInFlight()).toBeLessThanOrEqual(3);
    expect(res.size).toBe(1000);
    const first = res.get(owners(1)[0])!;
    expect(first).toEqual({ BNB: 0n, USDT: 1n, USDC: 2n });
    // call index 6 fails -> third owner's native (index 6) is 0n
    expect(res.get(owners(3)[2])!.BNB).toBe(0n);
  });

  test("rotates to the next rpc on failure", async () => {
    const f = fakeFactory(new Set(["https://a"]));
    const log: string[] = [];
    const res = await fetchBalances(CFG, owners(10), { rpcs: ["https://a", "https://b"], batchSize: 5, concurrency: 1, clientFactory: f.factory, sleepImpl: async () => {}, log: (m) => log.push(m) });
    expect(res.size).toBe(10);
    expect(f.calls[0].rpc).toBe("https://a");
    expect(f.calls.filter((c) => c.rpc === "https://b").length).toBe(2);
    expect(log.some((l) => l.includes("rotating"))).toBe(true);
  });

  test("throws when every rpc keeps failing", async () => {
    const f = fakeFactory(new Set(["https://a", "https://b"]));
    await expect(fetchBalances(CFG, owners(3), { rpcs: ["https://a", "https://b"], clientFactory: f.factory, sleepImpl: async () => {} })).rejects.toThrow(/down/);
  });
});
