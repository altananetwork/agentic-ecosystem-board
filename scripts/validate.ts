import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadChains, validateChain } from "../pipeline/chains";
import { validateRules } from "../pipeline/projects";

const root = join(import.meta.dir, "..");
const problems: string[] = [];

const chains = loadChains();
if (chains.length === 0) problems.push("chains/: no chain configs found");
const slugs = new Set<string>();
for (const c of chains) {
  problems.push(...validateChain(c));
  if (slugs.has(c.slug)) problems.push(`chains/: duplicate slug ${c.slug}`);
  slugs.add(c.slug);
}
const chainIds = new Set<number>();
for (const c of chains) {
  if (chainIds.has(c.chainId)) problems.push(`chains/: duplicate chainId ${c.chainId}`);
  chainIds.add(c.chainId);
}

const projDir = join(root, "data", "projects");
for (const f of readdirSync(projDir).filter((f) => f.endsWith(".json"))) {
  const slug = f.replace(/\.json$/, "");
  if (!slugs.has(slug)) problems.push(`data/projects/${f}: no matching chains/${slug}.json`);
  let parsed: { rules?: unknown };
  try {
    parsed = JSON.parse(readFileSync(join(projDir, f), "utf8"));
  } catch (e) {
    problems.push(`data/projects/${f}: invalid JSON (${(e as Error).message})`);
    continue;
  }
  for (const p of validateRules(parsed.rules ?? [])) problems.push(`data/projects/${f}: ${p}`);
}

if (problems.length > 0) {
  console.error("Validation failed:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`OK: ${chains.length} chain config(s) and their project rules are valid.`);
