import { describe, expect, test } from "bun:test";
import { PAGE_SIZE, queryAgents, syncAgentsFromGraph, toAgentRecord, uriHostOf, type RawGraphAgent } from "../pipeline/graph";
import { AgentStore } from "../pipeline/store";
import { CFG, jsonResponse } from "./helpers";

const noSleep = async () => {};
const cfg = { ...CFG, subgraphId: "D6aWqowLkWqBgcqmpNKXuNikPkob24ADXCciiP8Hvn1K" };

function graphAgent(n: number, overrides: Partial<RawGraphAgent> = {}): RawGraphAgent {
  return {
    id: `56:${String(n).padStart(8, "0")}`,
    agentId: String(n),
    owner: `0x${n.toString(16).padStart(40, "0").toUpperCase()}`,
    createdAt: String(1_770_000_000 + n),
    updatedAt: null,
    agentURI: "https://termix-platform-prod.s3.ap-southeast-1.amazonaws.com/platform/agents/x.json",
    totalFeedback: "2",
    registrationFile: { name: `Agent#${n}`, description: "registered through TermiX" },
    ...overrides,
  };
}

/** Fake gateway: serves `all` sorted by id, honouring id_gt / createdAt_gte / first. */
function fakeGateway(all: RawGraphAgent[], opts: { fail429First?: number; unauthorizedOnHeader?: boolean } = {}) {
  const calls: { url: string; variables: Record<string, unknown>; auth?: string }[] = [];
  let remaining429 = opts.fail429First ?? 0;
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as { variables: { first: number; cursor: string; since: string } };
    const auth = (init?.headers as Record<string, string>)?.authorization;
    calls.push({ url, variables: body.variables, auth });
    if (opts.unauthorizedOnHeader && !url.includes("/api/key-")) return new Response("no", { status: 401 });
    if (remaining429 > 0) {
      remaining429--;
      return new Response("slow down", { status: 429, headers: { "retry-after": "1" } });
    }
    const { first, cursor, since } = body.variables;
    const sorted = [...all].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const items = sorted.filter((a) => a.id > cursor && Number(a.createdAt) >= Number(since)).slice(0, first);
    return jsonResponse({ data: { agents: items } });
  };
  return { fetchImpl, calls };
}

describe("graph record conversion", () => {
  test("converts unix createdAt, lowercases owner, derives uriHost", () => {
    const r = toAgentRecord(graphAgent(7));
    expect(r.tokenId).toBe(7);
    expect(r.owner).toBe(`0x${"7".padStart(40, "0")}`);
    expect(r.createdAt).toBe(new Date((1_770_000_000 + 7) * 1000).toISOString());
    expect(r.uriHost).toBe("termix-platform-prod.s3.ap-southeast-1.amazonaws.com");
    expect(r.name).toBe("Agent#7");
    expect(r.feedbacks).toBe(2);
    expect(r.protocols).toEqual([]);
  });

  test("null registrationFile and missing URI are tolerated", () => {
    const r = toAgentRecord(graphAgent(3, { registrationFile: null, agentURI: null, totalFeedback: null }));
    expect(r.name).toBe("");
    expect(r.description).toBe("");
    expect(r.uriHost).toBeUndefined();
    expect(r.feedbacks).toBe(0);
  });

  test("a missing required field fails with a clear message naming it", () => {
    const bad = { ...graphAgent(1) } as Partial<RawGraphAgent>;
    delete bad.owner;
    expect(() => toAgentRecord(bad as RawGraphAgent)).toThrow(/missing field "owner"/);
  });

  test("uriHostOf handles schemes, ports and data URIs", () => {
    expect(uriHostOf("https://Example.com:8443/a")).toBe("example.com");
    expect(uriHostOf("ipfs://bafy123/x")).toBe("bafy123");
    expect(uriHostOf("data:application/json;base64,eyJ9")).toBeUndefined();
    expect(uriHostOf("")).toBeUndefined();
  });
});

describe("queryAgents", () => {
  test("retries on 429 honouring retry-after, then succeeds", async () => {
    const gw = fakeGateway([graphAgent(1)], { fail429First: 2 });
    const waits: number[] = [];
    const items = await queryAgents(cfg.subgraphId!, "key-1", { first: 10, cursor: "", since: "0" }, { fetchImpl: gw.fetchImpl, sleepImpl: async (ms) => void waits.push(ms) });
    expect(items.length).toBe(1);
    expect(gw.calls.length).toBe(3);
    expect(waits).toEqual([1000, 1000]);
  });

  test("falls back to the legacy key-in-path URL on 401", async () => {
    const gw = fakeGateway([graphAgent(1)], { unauthorizedOnHeader: true });
    const items = await queryAgents(cfg.subgraphId!, "key-1", { first: 10, cursor: "", since: "0" }, { fetchImpl: gw.fetchImpl, sleepImpl: noSleep });
    expect(items.length).toBe(1);
    expect(gw.calls[0].auth).toBe("Bearer key-1");
    expect(gw.calls[1].url).toContain("/api/key-1/subgraphs/id/");
  });

  test("GraphQL errors surface with their message", async () => {
    const fetchImpl = async () => jsonResponse({ errors: [{ message: "Type `Agent` has no field `agentURI`" }] });
    await expect(queryAgents(cfg.subgraphId!, "k", { first: 1, cursor: "", since: "0" }, { fetchImpl, sleepImpl: noSleep })).rejects.toThrow(/no field `agentURI`/);
  });
});

describe("syncAgentsFromGraph", () => {
  test("full walk pages by id cursor until a short page and stores every agent", async () => {
    const all = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => graphAgent(i));
    const gw = fakeGateway(all);
    const store = AgentStore.memory();
    const res = await syncAgentsFromGraph({ cfg, store, apiKey: "k", fetchImpl: gw.fetchImpl, sleepImpl: noSleep, rules: [{ match: "description", value: "termix", project: "TermiX" }] });
    expect(res.pages).toBe(3);
    expect(res.newAgents).toBe(all.length);
    expect(store.count()).toBe(all.length);
    expect(res.maxTokenId).toBe(all.length - 1);
    expect(gw.calls[0].variables.cursor).toBe("");
    expect(gw.calls[1].variables.cursor).toBe(all[PAGE_SIZE - 1].id);
    expect(store.projectCounts()[0]).toEqual({ project: "TermiX", agents: all.length });
    const one = [...store.all()][0];
    expect(one.uriHost).toBe("termix-platform-prod.s3.ap-southeast-1.amazonaws.com");
  });

  test("incremental run only asks for agents created since the last known day", async () => {
    const all = Array.from({ length: 10 }, (_, i) => graphAgent(i));
    const gw = fakeGateway(all);
    const store = AgentStore.memory();
    await syncAgentsFromGraph({ cfg, store, apiKey: "k", fetchImpl: gw.fetchImpl, sleepImpl: noSleep });
    const later = graphAgent(10, { createdAt: String(1_770_000_000 + 200_000) });
    all.push(later);
    const res = await syncAgentsFromGraph({ cfg, store, apiKey: "k", fetchImpl: gw.fetchImpl, sleepImpl: noSleep });
    const lastCall = gw.calls[gw.calls.length - 1];
    const expectedSince = Math.floor(Date.parse(new Date((1_770_000_000 + 9) * 1000).toISOString()) / 1000) - 86_400;
    expect(lastCall.variables.since).toBe(String(expectedSince));
    expect(res.newAgents).toBe(1);
    expect(store.count()).toBe(11);
  });

  test("fails clearly when the chain has no subgraphId", async () => {
    const store = AgentStore.memory();
    await expect(syncAgentsFromGraph({ cfg: CFG, store, apiKey: "k", fetchImpl: async () => jsonResponse({}) })).rejects.toThrow(/no subgraphId/);
  });
});
