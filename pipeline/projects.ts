import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRecord, ProjectRule } from "./types";

const ROOT = join(import.meta.dir, "..");

export function loadRules(slug: string, dir = join(ROOT, "data", "projects")): ProjectRule[] {
  let raw: string;
  try {
    raw = readFileSync(join(dir, `${slug}.json`), "utf8");
  } catch {
    return [];
  }
  const parsed = JSON.parse(raw) as { rules?: ProjectRule[] };
  return validateRules(parsed.rules ?? []).length === 0 ? (parsed.rules ?? []) : (parsed.rules ?? []);
}

export function validateRules(rules: unknown): string[] {
  const p: string[] = [];
  if (!Array.isArray(rules)) return ["rules must be a list"];
  const seen = new Set<string>();
  rules.forEach((r, i) => {
    if (!r || typeof r !== "object") return void p.push(`rule ${i}: must be an object`);
    const rule = r as ProjectRule;
    if (!["name", "description", "host"].includes(rule.match)) p.push(`rule ${i}: match must be name, description or host`);
    if (typeof rule.value !== "string" || rule.value.trim().length === 0) p.push(`rule ${i}: value is required`);
    if (typeof rule.project !== "string" || rule.project.trim().length === 0) p.push(`rule ${i}: project is required`);
    const key = `${rule.match}|${String(rule.value).toLowerCase()}`;
    if (seen.has(key)) p.push(`rule ${i}: duplicate rule ${rule.match}="${rule.value}"`);
    seen.add(key);
  });
  return p;
}

/** "Ave.ai Trading Agent#333149" -> "Ave.ai Trading Agent" */
export function cleanName(name: string): string {
  return (name ?? "").replace(/\s*#\d+\s*$/, "").trim();
}

type Attributable = Pick<AgentRecord, "name" | "description"> & { uriHost?: string };

/** First matching rule wins; otherwise the cleaned name; otherwise "Unknown". */
export function attribute(agent: Attributable, rules: ProjectRule[]): string {
  const matched = matchRule(agent, rules);
  if (matched) return matched.project;
  const cleaned = cleanName(agent.name);
  return cleaned.length > 0 ? cleaned : "Unknown";
}

export function matchRule(agent: Attributable, rules: ProjectRule[]): ProjectRule | undefined {
  const name = (agent.name ?? "").toLowerCase();
  const desc = (agent.description ?? "").toLowerCase();
  const host = (agent.uriHost ?? "").toLowerCase();
  for (const r of rules) {
    const v = r.value.toLowerCase();
    if (r.match === "name" && name.startsWith(v)) return r;
    if (r.match === "description" && desc.includes(v)) return r;
    if (r.match === "host" && host.length > 0 && host.endsWith(v)) return r;
  }
  return undefined;
}

/** Most frequent cleaned names that no rule catches. Useful for growing the rules file. */
export function topUnmapped(agents: Iterable<Attributable>, rules: ProjectRule[], n = 10): { name: string; agents: number }[] {
  const counts = new Map<string, number>();
  for (const a of agents) {
    if (matchRule(a, rules)) continue;
    const key = cleanName(a.name) || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, agents]) => ({ name, agents }))
    .sort((a, b) => b.agents - a.agents || a.name.localeCompare(b.name))
    .slice(0, n);
}
