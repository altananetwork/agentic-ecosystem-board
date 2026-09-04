import { sleep } from "./cli";
import { attribute } from "./projects";
import type { AgentStore } from "./store";
import type { AgentRecord, ProjectRule } from "./types";

export const SCAN_API_BASE = "https://api.8004scan.io/api/v1";
export const MAX_LIMIT = 100;
/** Pages re-read when resuming an interrupted full walk. */
export const RESUME_OVERLAP = 300;

/** Shape of one item from GET /agents (only the fields we use). */
export type RawAgent = {
  token_id: string | number;
  owner_address: string;
  name?: string | null;
  description?: string | null;
  supported_protocols?: string[] | null;
  x402_supported?: boolean | null;
  total_feedbacks?: number | null;
  created_at: string;
};

export type Page = { total: number; limit: number; offset: number; items: RawAgent[] };

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class ScanError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(
  url: string,
  fetchImpl: FetchLike,
  { tries = 10, baseMs = 500, sleepImpl = sleep }: { tries?: number; baseMs?: number; sleepImpl?: (ms: number) => Promise<void> } = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    let waitMs = Math.min(60_000, baseMs * 2 ** attempt);
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "agentic-ecosystem-board/0.1" } });
      if (res.ok) return res;
      if (!retryable(res.status)) throw new ScanError(`8004scan ${res.status} for ${url}`, res.status);
      lastErr = new ScanError(`8004scan ${res.status} for ${url}`, res.status);
      if (res.status === 429) {
        // Rate limited: honour Retry-After when present, otherwise back off in 15s steps up to 2 minutes.
        const ra = Number(res.headers.get("retry-after"));
        waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(120_000, 15_000 * (attempt + 1));
      }
    } catch (e) {
      if (e instanceof ScanError && e.status !== undefined && !retryable(e.status)) throw e;
      lastErr = e;
    }
    if (attempt < tries - 1) await sleepImpl(waitMs);
  }
  throw lastErr instanceof Error ? lastErr : new ScanError(String(lastErr));
}

export async function fetchPage(chainId: number, offset: number, limit = MAX_LIMIT, fetchImpl: FetchLike = fetch, opts: Parameters<typeof fetchWithRetry>[2] = {}): Promise<Page> {
  const lim = Math.min(Math.max(1, limit), MAX_LIMIT);
  const url = `${SCAN_API_BASE}/agents?chain_id=${chainId}&limit=${lim}&offset=${offset}`;
  const res = await fetchWithRetry(url, fetchImpl, opts);
  const body = (await res.json()) as { total?: number; limit?: number; offset?: number; items?: RawAgent[] };
  return { total: body.total ?? 0, limit: body.limit ?? lim, offset: body.offset ?? offset, items: body.items ?? [] };
}

export function toAgentRecord(raw: RawAgent): AgentRecord {
  const tokenId = Number(raw.token_id);
  if (!Number.isInteger(tokenId) || tokenId < 0) throw new ScanError(`bad token_id ${String(raw.token_id)}`);
  const owner = String(raw.owner_address ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(owner)) throw new ScanError(`bad owner_address for token ${tokenId}`);
  const created = new Date(raw.created_at);
  return {
    tokenId,
    owner,
    name: raw.name ?? "",
    description: raw.description ?? "",
    project: "",
    protocols: Array.isArray(raw.supported_protocols) ? raw.supported_protocols.map(String) : [],
    x402: raw.x402_supported === true,
    feedbacks: Number(raw.total_feedbacks ?? 0) || 0,
    createdAt: Number.isNaN(created.getTime()) ? "1970-01-01T00:00:00.000Z" : created.toISOString(),
  };
}

export type SyncOptions = {
  chainId: number;
  store: AgentStore;
  rules?: ProjectRule[];
  fetchImpl?: FetchLike;
  sleepMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
  full?: boolean;
  log?: (msg: string) => void;
};

export type SyncResult = { fetchedPages: number; newAgents: number; updatedAgents: number; total: number };

/**
 * Walks the API newest-first.
 * - Full mode reads every page until offset >= total. With a partially filled store it resumes near
 *   the end of what is stored (small overlap), so an interrupted backfill picks up where it stopped.
 * - Incremental mode (store within 0.5% of total) stops at the first page where every token id is
 *   already stored. A store with a bigger gap is treated as a resume of a full run.
 * Offsets shift while new agents register mid-run; that only causes duplicates, which upsert absorbs,
 * and the next incremental run catches anything that shifted past the top.
 */
export async function syncAgents(opts: SyncOptions): Promise<SyncResult> {
  const { chainId, store, rules = [], fetchImpl = fetch, sleepMs = 1000, sleepImpl = sleep, log = () => {} } = opts;
  let incremental = !opts.full && store.count() > 0;
  let offset = 0;
  let fetchedPages = 0;
  let newAgents = 0;
  let updatedAgents = 0;
  let total = 0;
  let resumed = false;
  for (;;) {
    const page = await fetchPage(chainId, offset, MAX_LIMIT, fetchImpl, { sleepImpl });
    fetchedPages++;
    total = page.total;
    if (page.items.length === 0) break;
    const records = page.items.map((raw) => {
      const r = toAgentRecord(raw);
      r.project = attribute(r, rules);
      return r;
    });
    const fresh = records.filter((r) => !store.has(r.tokenId));
    store.upsertMany(records, rules);
    newAgents += fresh.length;
    updatedAgents += records.length - fresh.length;
    if (fetchedPages % 25 === 0 || fresh.length > 0) {
      log(`page ${fetchedPages} offset ${offset}: ${fresh.length} new, ${records.length} seen, total ${total}`);
    }
    if (incremental && fresh.length === 0) {
      // Newest agents are all in. If the store is still short of the total, an earlier backfill was
      // interrupted: switch to a full walk resuming near the end of what is stored.
      const stored = store.count();
      const tolerance = Math.max(MAX_LIMIT, Math.floor(total * 0.001));
      if (stored + tolerance >= total || resumed) break;
      incremental = false;
      resumed = true;
      offset = Math.max(0, Math.floor((stored - RESUME_OVERLAP) / MAX_LIMIT) * MAX_LIMIT);
      log(`store has ${stored} of ${total}; resuming full walk from offset ${offset}`);
      if (sleepMs > 0) await sleepImpl(sleepMs);
      continue;
    }
    offset += page.items.length;
    if (offset >= total) break;
    if (sleepMs > 0) await sleepImpl(sleepMs);
  }
  return { fetchedPages, newAgents, updatedAgents, total };
}

export function gapCheck(store: AgentStore, total: number): { stored: number; total: number; missing: number } {
  const stored = store.count();
  return { stored, total, missing: Math.max(0, total - stored) };
}
