import { promises as fs } from "node:fs";
import path from "node:path";
import type { BoardPayload, IndexPayload } from "@/pipeline/types";

/** Payload directory, resolved per call so BOARD_DATA_DIR can point tests at fixtures. */
function dataDir(): string {
  return process.env.BOARD_DATA_DIR ?? path.join(process.cwd(), "public", "data");
}
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
  return readJson<IndexPayload>(path.join(dataDir(), "index.json"));
}

/** Per-chain board payload. Null for unknown slugs or before the first pipeline run. */
export async function readBoard(slug: string): Promise<BoardPayload | null> {
  if (!SLUG.test(slug)) return null;
  return readJson<BoardPayload>(path.join(dataDir(), `${slug}.json`));
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

/** Public path of a committed chain logo (public/chains/<slug>.svg), or undefined when there is none. */
export async function chainLogo(slug: string): Promise<string | undefined> {
  if (!SLUG.test(slug)) return undefined;
  try {
    await fs.access(path.join(process.cwd(), "public", "chains", `${slug}.svg`));
    return `/chains/${slug}.svg`;
  } catch {
    return undefined;
  }
}

/** Chain links for the header switcher, with logos resolved. */
export async function chainLinks(index: IndexPayload | null): Promise<{ slug: string; name: string; color: string; logo?: string }[]> {
  return Promise.all((index?.chains ?? []).map(async (c) => ({ slug: c.slug, name: c.name, color: c.color, logo: await chainLogo(c.slug) })));
}
