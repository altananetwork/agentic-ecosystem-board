import { promises as fs } from "node:fs";
import path from "node:path";
import type { BoardPayload, IndexPayload } from "@/pipeline/types";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const CHAINS_DIR = path.join(process.cwd(), "chains");
const SLUG = /^[a-z0-9-]+$/;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Cross-chain index written by the pipeline. Null when nothing has been published. */
export async function readIndex(): Promise<IndexPayload | null> {
  return readJson<IndexPayload>(path.join(DATA_DIR, "index.json"));
}

/** Per-chain board payload. Null for unknown slugs or before the first pipeline run. */
export async function readBoard(slug: string): Promise<BoardPayload | null> {
  if (!SLUG.test(slug)) return null;
  return readJson<BoardPayload>(path.join(DATA_DIR, `${slug}.json`));
}

/** Slugs that have a chain config, whether or not a payload exists yet. */
export async function configuredSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(CHAINS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .filter((s) => SLUG.test(s))
      .sort();
  } catch {
    return [];
  }
}

/** Union of published and configured slugs, published first. */
export async function knownSlugs(): Promise<string[]> {
  const index = await readIndex();
  const published = index?.chains.map((c) => c.slug) ?? [];
  const configured = await configuredSlugs();
  return Array.from(new Set([...published, ...configured]));
}
