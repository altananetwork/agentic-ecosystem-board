import { describe, expect, test } from "bun:test";
import { pricesFor, toAmount, updateState, usdOf } from "../pipeline/state";
import type { Balances } from "../pipeline/balances";
import { CFG } from "./helpers";

const E18 = 10n ** 18n;
const prices = pricesFor(CFG, 500);

function bal(entries: [string, Record<string, bigint>][]): Balances {
  return new Map(entries);
}

describe("state", () => {
  test("pricesFor uses fixed stablecoin prices and the native spot", () => {
    expect(prices).toEqual({ BNB: 500, USDT: 1, USDC: 1 });
  });

  test("usd math with 18 decimals", () => {
    expect(toAmount(CFG, "BNB", 15n * E18 / 10n)).toBe(1.5);
    expect(usdOf(CFG, { BNB: 2n * E18, USDT: 100n * E18, USDC: 0n }, prices)).toBe(1100);
  });

  test("first run: zero flow and change count, totals computed", () => {
    const today = bal([
      ["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }],
      ["0xb", { BNB: 0n, USDT: 0n, USDC: 0n }],
    ]);
    const u = updateState(null, today, prices, CFG, "2026-09-04");
    expect(u.netFlowUsd).toBe(0);
    expect(u.changedWallets).toBe(0);
    expect(u.walletsWithAssets).toBe(1);
    expect(u.totalAssetsUsd).toBe(500);
    expect(u.byToken).toEqual([
      { symbol: "BNB", amount: 1, usd: 500 },
      { symbol: "USDT", amount: 0, usd: 0 },
      { symbol: "USDC", amount: 0, usd: 0 },
    ]);
    expect(u.next.wallets["0xa"]).toEqual({ raw: { BNB: E18.toString(), USDT: "0", USDC: "0" }, usd: 500, firstSeen: "2026-09-04", lastChanged: null });
  });

  test("second run: detects moves, signed net flow, keeps lastChanged for idle wallets", () => {
    const d1 = updateState(null, bal([
      ["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }],
      ["0xb", { BNB: 0n, USDT: 50n * E18, USDC: 0n }],
    ]), prices, CFG, "2026-09-04");
    const d2 = updateState(d1.next, bal([
      ["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }], // idle
      ["0xb", { BNB: 0n, USDT: 20n * E18, USDC: 0n }], // -30
      ["0xc", { BNB: 0n, USDT: 0n, USDC: 10n * E18 }], // new +10
    ]), prices, CFG, "2026-09-05");
    expect(d2.netFlowUsd).toBe(-30); // only 0xb moved; a wallet joining the set brings no flow
    expect(d2.changedWallets).toBe(1);
    expect(d2.next.wallets["0xa"].lastChanged).toBeNull(); // never observed moving
    expect(d2.next.wallets["0xb"].lastChanged).toBe("2026-09-05");
    expect(d2.next.wallets["0xc"].firstSeen).toBe("2026-09-05");
    expect(d2.next.wallets["0xc"].lastChanged).toBeNull();
    expect(d2.walletsWithAssets).toBe(3);
    expect(d2.totalAssetsUsd).toBe(530);
  });

  test("a price move alone changes usd but not flow or lastChanged", () => {
    const d1 = updateState(null, bal([["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }]]), prices, CFG, "2026-09-04");
    const d2 = updateState(d1.next, bal([["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }]]), pricesFor(CFG, 600), CFG, "2026-09-05");
    expect(d2.netFlowUsd).toBe(0);
    expect(d2.next.wallets["0xa"].usd).toBe(600);
    expect(d2.changedWallets).toBe(0);
    expect(d2.next.wallets["0xa"].lastChanged).toBeNull();
  });

  test("wallets that no longer own an agent drop out of the state and the totals", () => {
    const d1 = updateState(null, bal([
      ["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }],
      ["0xdead", { BNB: 1000n * E18, USDT: 0n, USDC: 0n }],
    ]), prices, CFG, "2026-09-04");
    const d2 = updateState(d1.next, bal([["0xa", { BNB: 1n * E18, USDT: 0n, USDC: 0n }]]), prices, CFG, "2026-09-05");
    expect(Object.keys(d2.next.wallets)).toEqual(["0xa"]);
    expect(d2.totalAssetsUsd).toBe(500);
    expect(d2.netFlowUsd).toBe(0);
  });
});
