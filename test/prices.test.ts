import { describe, expect, test } from "bun:test";
import { baseAsset, nativePriceUsd } from "../pipeline/prices";
import { jsonResponse } from "./helpers";

describe("prices", () => {
  test("baseAsset strips the quote", () => {
    expect(baseAsset("BNBUSDT")).toBe("BNB");
    expect(baseAsset("celousdt")).toBe("CELO");
  });

  test("binance first, coingecko fallback, clear error when both fail", async () => {
    const ok = await nativePriceUsd("BNBUSDT", async () => jsonResponse({ symbol: "BNBUSDT", price: "612.30000000" }));
    expect(ok).toBe(612.3);
    const fallback = await nativePriceUsd("BNBUSDT", async (url) => (url.includes("api.binance.com") ? jsonResponse({}, 451) : jsonResponse({ binancecoin: { usd: 600.5 } })));
    expect(fallback).toBe(600.5);
    await expect(nativePriceUsd("BNBUSDT", async () => jsonResponse({}, 500))).rejects.toThrow(/Could not price BNBUSDT: binance: HTTP 500; coingecko: HTTP 500/);
    await expect(nativePriceUsd("XYZUSDT", async () => jsonResponse({}, 500))).rejects.toThrow(/no id mapping/);
  });
});
