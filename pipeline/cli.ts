/** Tiny argv parser: `--chain bnb --full` -> { chain: "bnb", full: true }. */
export type CliArgs = { chain?: string; full: boolean; flags: Record<string, string | boolean> };

export function parseArgs(argv: string[]): CliArgs {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return {
    chain: typeof flags.chain === "string" ? flags.chain : undefined,
    full: flags.full === true,
    flags,
  };
}

export function log(...parts: unknown[]): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}]`, ...parts);
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
