import { describe, expect, test } from "bun:test";
import { AgentStore } from "../pipeline/store";
import type { AgentRecord } from "../pipeline/types";

function rec(tokenId: number, o: Partial<AgentRecord> = {}): AgentRecord {
  return { tokenId, owner: "0xAbC", name: `N#${tokenId}`, description: "", project: "", protocols: [], x402: false, feedbacks: 0, createdAt: "2026-09-04T10:00:00.000Z", ...o };
}

describe("AgentStore", () => {
  test("upsert is idempotent and lowercases owners", () => {
    const s = AgentStore.memory();
    s.upsertMany([rec(1), rec(2, { owner: "0xDEF" })]);
    s.upsertMany([rec(1, { name: "renamed" })]);
    expect(s.count()).toBe(2);
    expect(s.maxTokenId()).toBe(2);
    expect(s.has(1)).toBe(true);
    expect(s.has(3)).toBe(false);
    expect(s.owners()).toEqual(["0xabc", "0xdef"]);
    expect(s.uniqueOwners()).toBe(2);
    expect([...s.all()].map((a) => a.name)).toEqual(["renamed", "N#2"]);
  });

  test("registrationsByDay zero-fills and is oldest first", () => {
    const s = AgentStore.memory();
    s.upsertMany([rec(1, { createdAt: "2026-09-04T01:00:00.000Z" }), rec(2, { createdAt: "2026-09-04T23:00:00.000Z" }), rec(3, { createdAt: "2026-09-02T12:00:00.000Z" }), rec(4, { createdAt: "2026-08-01T12:00:00.000Z" })]);
    const days = s.registrationsByDay(3, "2026-09-04");
    expect(days).toEqual([
      { date: "2026-09-02", count: 1 },
      { date: "2026-09-03", count: 0 },
      { date: "2026-09-04", count: 2 },
    ]);
    expect(s.registrationsOn("2026-09-04")).toBe(2);
    expect(s.registrationsByDay(31, "2026-09-04").length).toBe(31);
  });

  test("projectCounts and reattributeAll", () => {
    const s = AgentStore.memory();
    s.upsertMany([rec(1, { name: "Ave.ai Trading Agent#1" }), rec(2, { name: "Ave.ai Trading Agent#2" }), rec(3, { name: "Solo#3" })]);
    expect(s.projectCounts()).toEqual([
      { project: "Ave.ai Trading Agent", agents: 2 },
      { project: "Solo", agents: 1 },
    ]);
    const changed = s.reattributeAll([{ match: "name", value: "Ave.ai", project: "Ave.ai" }]);
    expect(changed).toBe(2);
    expect(s.projectCounts()[0]).toEqual({ project: "Ave.ai", agents: 2 });
    expect(s.reattributeAll([{ match: "name", value: "Ave.ai", project: "Ave.ai" }])).toBe(0);
  });
});
