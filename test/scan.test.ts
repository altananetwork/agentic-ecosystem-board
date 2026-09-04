import { describe, expect, test } from "bun:test";
import { fetchPage, gapCheck, syncAgents, toAgentRecord } from "../pipeline/scan";
import { AgentStore } from "../pipeline/store";
import { fakeScan, noSleep, rawAgent } from "./helpers";

function agents(n: number, start = n - 1) {
  return Array.from({ length: n }, (_, i) => rawAgent(start - i));
}

describe("toAgentRecord", () => {
  test("normalises the real API field names", () => {
    const r = toAgentRecord({
      token_id: "333329",
      owner_address: "0x6C97502F7191CAB4D57D1DEE7700A3A4E025D9D9",
      name: "hyper-dp21a.agent",
      description: "Autonomous automation & ops agent registered through TermiX.",
      supported_protocols: ["A2A"],
      x402_supported: null,
      total_feedbacks: 3,
      created_at: "2026-09-04T12:29:28Z",
    });
    expect(r.tokenId).toBe(333329);
    expect(r.owner).toBe("0x6c97502f7191cab4d57d1dee7700a3a4e025d9d9");
    expect(r.protocols).toEqual(["A2A"]);
    expect(r.x402).toBe(false);
    expect(r.feedbacks).toBe(3);
    expect(r.createdAt).toBe("2026-09-04T12:29:28.000Z");
  });

  test("defaults missing name/description and rejects bad owners", () => {
    const r = toAgentRecord(rawAgent(5, { name: null, description: undefined, supported_protocols: null }));
    expect(r.name).toBe("");
    expect(r.description).toBe("");
    expect(r.protocols).toEqual([]);
    expect(() => toAgentRecord(rawAgent(1, { owner_address: "nope" }))).toThrow(/bad owner_address/);
  });
});

describe("fetchPage", () => {
  test("caps limit at 100", async () => {
    const { fetchImpl, calls } = fakeScan(agents(5));
    await fetchPage(56, 0, 500, fetchImpl, { sleepImpl: noSleep });
    expect(calls[0]).toContain("limit=100");
    expect(calls[0]).toContain("chain_id=56");
  });

  test("retries 500 then succeeds; gives up on 404", async () => {
    const { fetchImpl, calls } = fakeScan(agents(3), [500, 503, 429]);
    const page = await fetchPage(56, 0, 100, fetchImpl, { sleepImpl: noSleep });
    expect(page.items.length).toBe(3);
    expect(calls.length).toBe(4);
    const dead = fakeScan(agents(3), Array(10).fill(429));
    await expect(fetchPage(56, 0, 100, dead.fetchImpl, { sleepImpl: noSleep })).rejects.toThrow(/429/);
    expect(dead.calls.length).toBe(10);
    const bad = fakeScan(agents(3), [404]);
    await expect(fetchPage(56, 0, 100, bad.fetchImpl, { sleepImpl: noSleep })).rejects.toThrow(/404/);
    expect(bad.calls.length).toBe(1);
  });
});

describe("syncAgents", () => {
  test("full run walks every page until total", async () => {
    const all = agents(250);
    const { fetchImpl, calls } = fakeScan(all);
    const store = AgentStore.memory();
    const res = await syncAgents({ chainId: 56, store, fetchImpl, sleepImpl: noSleep });
    expect(res.fetchedPages).toBe(3);
    expect(res.newAgents).toBe(250);
    expect(res.total).toBe(250);
    expect(store.count()).toBe(250);
    expect(calls.map((c) => new URL(c).searchParams.get("offset"))).toEqual(["0", "100", "200"]);
    expect(gapCheck(store, 250)).toEqual({ stored: 250, total: 250, missing: 0 });
  });

  test("incremental run stops at the first fully-known page", async () => {
    const old = agents(250);
    const store = AgentStore.memory();
    await syncAgents({ chainId: 56, store, fetchImpl: fakeScan(old).fetchImpl, sleepImpl: noSleep });
    // 30 new agents registered since (ids 250..279), newest first
    const now = [...agents(30, 279), ...old];
    const { fetchImpl, calls } = fakeScan(now);
    const res = await syncAgents({ chainId: 56, store, fetchImpl, sleepImpl: noSleep });
    expect(res.newAgents).toBe(30);
    expect(res.total).toBe(280);
    // page 1 has 30 new + 70 known -> continue; page 2 fully known -> stop
    expect(calls.length).toBe(2);
    expect(store.count()).toBe(280);
    expect(store.maxTokenId()).toBe(279);
  });

  test("--full on a populated store re-reads everything", async () => {
    const all = agents(120);
    const store = AgentStore.memory();
    await syncAgents({ chainId: 56, store, fetchImpl: fakeScan(all).fetchImpl, sleepImpl: noSleep });
    const { fetchImpl, calls } = fakeScan(all);
    const res = await syncAgents({ chainId: 56, store, fetchImpl, sleepImpl: noSleep, full: true });
    expect(calls.length).toBe(2);
    expect(res.newAgents).toBe(0);
    expect(res.updatedAgents).toBe(120);
  });

  test("applies project rules at insert time", async () => {
    const all = [rawAgent(2, { name: "Ave.ai Trading Agent#2" }), rawAgent(1, { name: "x", description: "registered through TermiX" }), rawAgent(0, { name: "Solo#0" })];
    const store = AgentStore.memory();
    const rules = [
      { match: "name" as const, value: "Ave.ai Trading Agent", project: "Ave.ai" },
      { match: "description" as const, value: "registered through termix", project: "TermiX" },
    ];
    await syncAgents({ chainId: 56, store, rules, fetchImpl: fakeScan(all).fetchImpl, sleepImpl: noSleep });
    expect(store.projectCounts()).toEqual([
      { project: "Ave.ai", agents: 1 },
      { project: "Solo", agents: 1 },
      { project: "TermiX", agents: 1 },
    ]);
  });
});

describe("syncAgents resume", () => {
  test("a store with a gap resumes the full walk instead of stopping early", async () => {
    const all = agents(1000);
    const store = AgentStore.memory();
    // simulate an interrupted backfill: only the newest 400 stored
    store.upsertMany(all.slice(0, 400).map(toAgentRecord));
    const { fetchImpl, calls } = fakeScan(all);
    const res = await syncAgents({ chainId: 56, store, fetchImpl, sleepImpl: noSleep });
    expect(store.count()).toBe(1000);
    expect(res.newAgents).toBe(600);
    const offsets = calls.map((c) => Number(new URL(c).searchParams.get("offset")));
    // incremental pages 0..300 are fully known (stops at page 1), then resumes at (400 - 300) = 100
    expect(offsets.slice(0, 2)).toEqual([0, 100]);
    expect(offsets[offsets.length - 1]).toBe(900);
    expect(res.fetchedPages).toBe(10);
  });
});
