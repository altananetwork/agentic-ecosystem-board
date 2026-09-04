import { describe, expect, test } from "bun:test";
import { attribute, cleanName, loadRules, topUnmapped, validateRules } from "../pipeline/projects";
import type { ProjectRule } from "../pipeline/types";

const rules: ProjectRule[] = [
  { match: "name", value: "Ave.ai Trading Agent", project: "Ave.ai" },
  { match: "description", value: "registered through TermiX", project: "TermiX" },
  { match: "host", value: "amazonaws.com", project: "S3 hosted" },
  { match: "name", value: "ave", project: "Should never win" },
];

describe("projects", () => {
  test("cleanName strips a trailing #id", () => {
    expect(cleanName("Ave.ai Trading Agent#333149")).toBe("Ave.ai Trading Agent");
    expect(cleanName("Agent #12 ")).toBe("Agent");
    expect(cleanName("C#Sharp")).toBe("C#Sharp");
    expect(cleanName("")).toBe("");
  });

  test("first rule wins, name match is case-insensitive startsWith", () => {
    expect(attribute({ name: "AVE.AI TRADING AGENT#1", description: "" }, rules)).toBe("Ave.ai");
    expect(attribute({ name: "hyper.agent", description: "Ops agent registered through TERMIX." }, rules)).toBe("TermiX");
    expect(attribute({ name: "x", description: "", uriHost: "bucket.s3.amazonaws.com" }, rules)).toBe("S3 hosted");
  });

  test("falls back to the cleaned name, then Unknown", () => {
    expect(attribute({ name: "Debot Trading Agent#77", description: "" }, rules)).toBe("Debot Trading Agent");
    expect(attribute({ name: "", description: "" }, rules)).toBe("Unknown");
    expect(attribute({ name: "  #5", description: "" }, rules)).toBe("Unknown");
  });

  test("topUnmapped ranks names no rule catches", () => {
    const agents = [
      { name: "Ave.ai Trading Agent#1", description: "" },
      { name: "Debot Trading Agent#1", description: "" },
      { name: "Debot Trading Agent#2", description: "" },
      { name: "MevX Trading Agent#9", description: "" },
    ];
    expect(topUnmapped(agents, rules, 5)).toEqual([
      { name: "Debot Trading Agent", agents: 2 },
      { name: "MevX Trading Agent", agents: 1 },
    ]);
  });

  test("validateRules flags malformed and duplicate rules", () => {
    expect(validateRules(rules)).toEqual([]);
    const out = validateRules([{ match: "regex", value: "", project: "" }, { match: "name", value: "A", project: "P" }, { match: "name", value: "a", project: "Q" }]);
    expect(out.join("\n")).toMatch(/match must be/);
    expect(out.join("\n")).toMatch(/value is required/);
    expect(out.join("\n")).toMatch(/duplicate rule/);
  });

  test("shipped rules load and are valid", () => {
    const shipped = loadRules("bnb");
    expect(shipped.length).toBeGreaterThan(0);
    expect(validateRules(shipped)).toEqual([]);
    expect(attribute({ name: "Ave.ai Trading Agent#333149", description: "" }, shipped)).toBe("Ave.ai");
    expect(attribute({ name: "hyper-dp21a.agent", description: "Autonomous automation & ops agent registered through TermiX." }, shipped)).toBe("TermiX");
    expect(attribute({ name: "@p4qcheng · Ensoul", description: "" }, shipped)).toBe("@p4qcheng · Ensoul");
    expect(loadRules("does-not-exist")).toEqual([]);
  });
});
