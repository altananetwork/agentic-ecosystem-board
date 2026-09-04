import { describe, expect, test } from "bun:test";
import { loadChains, rpcUrls, validateChain } from "../pipeline/chains";
import { CFG } from "./helpers";

describe("chains", () => {
  test("shipped configs are valid", () => {
    for (const c of loadChains()) expect(validateChain(c)).toEqual([]);
  });

  test("valid fixture passes", () => {
    expect(validateChain(CFG)).toEqual([]);
  });

  test("rejects non-checksummed addresses", () => {
    const bad = { ...CFG, registry: CFG.registry.toLowerCase() as `0x${string}` };
    expect(validateChain(bad).join("\n")).toMatch(/registry must be a checksummed address/);
  });

  test("rejects duplicate tokens and bad decimals", () => {
    const bad = { ...CFG, tokens: [CFG.tokens[0], { ...CFG.tokens[0], decimals: 40 }] };
    const out = validateChain(bad).join("\n");
    expect(out).toMatch(/duplicate token symbol USDT/);
    expect(out).toMatch(/duplicate token address/);
    expect(out).toMatch(/decimals must be 0\.\.36/);
  });

  test("rejects bad dates, slugs, rpcs and colors", () => {
    const bad = { ...CFG, liveSince: "03/02/2026", slug: "BNB Chain", rpcs: ["http://insecure"], color: "yellow" };
    const out = validateChain(bad).join("\n");
    expect(out).toMatch(/liveSince must be YYYY-MM-DD/);
    expect(out).toMatch(/slug must be kebab-case/);
    expect(out).toMatch(/must start with https/);
    expect(out).toMatch(/color must be/);
  });

  test("rpcUrls prepends private endpoints from env", () => {
    expect(rpcUrls(CFG, {})).toEqual(CFG.rpcs);
    expect(rpcUrls(CFG, { RPC_URLS_BNB: "https://p1.example, https://b.example" })).toEqual(["https://p1.example", "https://b.example", "https://a.example"]);
  });
});
