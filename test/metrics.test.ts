import { describe, expect, test } from "bun:test";
import { activityWindow, buildIndex, buildPayload, buildSnapshot, methodology, topProjects } from "../pipeline/metrics";
import type { DailySnapshot, WalletStateFile } from "../pipeline/types";
import { CFG } from "./helpers";

function snap(date: string, o: Partial<DailySnapshot> = {}): DailySnapshot {
  return { date, agents: 100, uniqueOwners: 80, walletsWithAssets: 50, totalAssetsUsd: 1000, byToken: [], nativePriceUsd: 500, netFlowUsd: 10, changedWallets: 5, grossFlowUsd: 25, registrations: 3, ...o };
}

const state: WalletStateFile = {
  schemaVersion: 1,
  chain: "bnb",
  asOf: "2026-09-04",
  nativePriceUsd: 500,
  wallets: {
    "0xa": { raw: {}, usd: 1, firstSeen: "2026-08-01", lastChanged: "2026-09-04" },
    "0xb": { raw: {}, usd: 1, firstSeen: "2026-08-01", lastChanged: "2026-08-20" },
    "0xc": { raw: {}, usd: 1, firstSeen: "2026-08-01", lastChanged: "2026-07-01" },
  },
};

describe("metrics", () => {
  test("topProjects keeps 10 and aggregates the rest as Other with shares", () => {
    const counts = Array.from({ length: 12 }, (_, i) => ({ project: `P${i}`, agents: 12 - i }));
    const total = counts.reduce((s, c) => s + c.agents, 0);
    const top = topProjects(counts, total);
    expect(top.length).toBe(11);
    expect(top[0]).toEqual({ project: "P0", agents: 12, share: Math.round((12 / total) * 10000) / 10000 });
    expect(top[10].project).toBe("Other");
    expect(top[10].agents).toBe(3);
    const sum = top.reduce((s, t) => s + t.share, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThanOrEqual(1.0001);
    expect(topProjects([{ project: "A", agents: 1 }], 4)[0].share).toBe(0.25);
  });

  test("activity window with partial history", () => {
    const snaps = [snap("2026-08-30"), snap("2026-09-01", { netFlowUsd: -4 }), snap("2026-09-04")];
    const a = activityWindow(snaps, state, "2026-09-04");
    expect(a).toEqual({ windowDays: 30, since: "2026-08-30", daysCovered: 3, activeWallets: 1, netFlowUsd: 16, volumeUsd: 75 });
    const b = activityWindow([snap("2026-07-01")], state, "2026-09-04");
    expect(b.daysCovered).toBe(0);
    expect(b.since).toBe("2026-09-04");
    expect(b.activeWallets).toBe(1);
    expect(b.netFlowUsd).toBe(0);
    const full = activityWindow(Array.from({ length: 40 }, (_, i) => snap(`2026-08-${String(i + 1).padStart(2, "0")}`.slice(0, 10))).filter((s) => Number(s.date.slice(8)) <= 31), state, "2026-08-31");
    expect(full.since).toBe("2026-08-02");
    expect(full.daysCovered).toBe(30);
  });

  test("buildPayload holds the board invariants", () => {
    const snaps = [snap("2026-09-03", { agents: 90 }), snap("2026-09-04", { agents: 100, walletsWithAssets: 60 })];
    const registrationsDaily = Array.from({ length: 31 }, (_, i) => ({ date: `d${i}`, count: i }));
    const p = buildPayload({
      cfg: CFG,
      snapshots: snaps,
      registrationsDaily,
      projectCounts: [{ project: "A", agents: 70 }, { project: "B", agents: 30 }],
      state,
      totals: { agents: 100, uniqueOwners: 80 },
      asOf: "2026-09-04T12:00:00.000Z",
      today: "2026-09-04",
    });
    expect(p.schemaVersion).toBe(1);
    expect(p.chain.slug).toBe("bnb");
    expect(p.totals.uniqueOwners).toBeLessThanOrEqual(p.totals.agents);
    expect(p.totals.walletsWithAssets).toBeLessThanOrEqual(p.totals.uniqueOwners);
    expect(p.totals.walletsWithAssets).toBe(60);
    expect(p.registrationsDaily.length).toBe(31);
    expect(p.history.map((h) => h.date)).toEqual(["2026-09-03", "2026-09-04"]);
    expect(p.topProjects.reduce((s, t) => s + t.agents, 0)).toBeLessThanOrEqual(p.totals.agents);
    expect(p.methodology.length).toBeGreaterThan(3);
    for (const m of [...p.methodology, ...Object.values(p.chain)]) expect(String(m)).not.toContain("—");
    expect(p.activity.activeWallets).toBe(1);
  });

  test("buildPayload with no snapshots yet", () => {
    const p = buildPayload({ cfg: CFG, snapshots: [], registrationsDaily: [], projectCounts: [], state: null, totals: { agents: 0, uniqueOwners: 0 }, asOf: "x", today: "2026-09-04" });
    expect(p.totals.totalAssetsUsd).toBe(0);
    expect(p.topProjects).toEqual([]);
    expect(p.activity.daysCovered).toBe(0);
  });

  test("buildSnapshot rounds and buildIndex sorts by agents", () => {
    const s = buildSnapshot({ date: "2026-09-04", agents: 10, uniqueOwners: 9, nativePriceUsd: 500, registrations: 2, update: { next: state, netFlowUsd: 1.005, grossFlowUsd: 0, changedWallets: 2, walletsWithAssets: 3, totalAssetsUsd: 123.456, byToken: [{ symbol: "BNB", amount: 0.1234567, usd: 61.7283 }] } });
    expect(s.totalAssetsUsd).toBe(123.46);
    expect(s.byToken[0]).toEqual({ symbol: "BNB", amount: 0.123457, usd: 61.73 });
    const p1 = buildPayload({ cfg: CFG, snapshots: [], registrationsDaily: [], projectCounts: [], state: null, totals: { agents: 5, uniqueOwners: 5 }, asOf: "x", today: "2026-09-04" });
    const p2 = { ...p1, chain: { ...p1.chain, slug: "base", name: "Base" }, totals: { ...p1.totals, agents: 50 } };
    const idx = buildIndex([p1, p2], "2026-09-04T00:00:00.000Z");
    expect(idx.chains.map((c) => c.slug)).toEqual(["base", "bnb"]);
    expect(methodology(CFG)[0]).toContain(CFG.registry);
  });
});
