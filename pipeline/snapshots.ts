import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DailySnapshot } from "./types";

const ROOT = join(import.meta.dir, "..");

export function snapshotsDir(slug: string, dataDir = join(ROOT, "data", "snapshots")): string {
  return join(dataDir, slug);
}

export function writeSnapshot(slug: string, snap: DailySnapshot, dataDir?: string): string {
  const dir = snapshotsDir(slug, dataDir);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${snap.date}.json`);
  writeFileSync(p, `${JSON.stringify(snap, null, 2)}\n`);
  return p;
}

/** All committed snapshots for a chain, oldest first. */
export function listSnapshots(slug: string, dataDir?: string): DailySnapshot[] {
  const dir = snapshotsDir(slug, dataDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as DailySnapshot);
}
