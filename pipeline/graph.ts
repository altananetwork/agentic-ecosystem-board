/**
 * Agent0 ERC-8004 subgraph on The Graph: the fast source for the one-time backfill and for daily
 * incremental syncs. Needs GRAPH_API_KEY (free at https://thegraph.com/studio/apikeys/). Without a
 * key the pipeline falls back to 8004scan (see scan.ts).
 */
import { sleep } from "./cli";
import { attribute } from "./projects";
import type { AgentStore } from "./store";
import type { AgentRecord, ChainConfig, ProjectRule } from "./types";
import type { FetchLike } from "./scan";

export const GRAPH_GATEWAY = "https://gateway.thegraph.com/api";
export const PAGE_SIZE = 1000;

export class GraphError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type RawGraphAgent = {
  id: string;
  agentId: string | number;
  owner: string;
  createdAt: string | number;
  updatedAt?: string | number | null;
  agentURI?: string | null;
  totalFeedback?: string | number | null;
  registrationFile?: { name?: string | null; description?: string | null } | null;
};

const QUERY = `query Agents($first: Int!, $cursor: String!, $since: BigInt!) {
  agents(first: $first, where: { id_gt: $cursor, createdAt_gte: $since }, orderBy: id, orderDirection: asc) {
    id
    agentId
    owner
    createdAt
    updatedAt
    agentURI
    totalFeedback
    registrationFile { name description }
  }
}`;

export function uriHostOf(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(uri.trim());
  return m ? m[1].toLowerCase() : undefined;
}

const REQUIRED: (keyof RawGraphAgent)[] = ["id", "agentId", "owner", "createdAt"];

export function toAgentRecord(raw: RawGraphAgent): AgentRecord {
  for (const f of REQUIRED) {
    if (raw[f] === undefined || raw[f] === null) throw new GraphError(`subgraph agent is missing field "${f}" (got keys: ${Object.keys(raw).join(", ")})`);
  }
  const tokenId = Number(raw.agentId);
  if (!Number.isInteger(tokenId) || tokenId < 0) throw new GraphError(`bad agentId ${String(raw.agentId)}`);
  const created = Number(raw.createdAt);
  return {
    tokenId,
    owner: String(raw.owner).toLowerCase(),
    name: raw.registrationFile?.name ?? "",
    description: raw.registrationFile?.description ?? "",
    project: "",
    protocols: [],
    x402: false,
    feedbacks: Number(raw.totalFeedback ?? 0) || 0,
    createdAt: Number.isFinite(created) ? new Date(created * 1000).toISOString() : "1970-01-01T00:00:00.000Z",
    uriHost: uriHostOf(raw.agentURI),
  };
}

type GqlBody = { data?: { agents?: RawGraphAgent[] }; errors?: { message: string }[] };

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export type GraphClientOptions = {
  fetchImpl?: FetchLike;
  sleepImpl?: (ms: number) => Promise<void>;
  tries?: number;
};

/** One GraphQL call with retry on 429/5xx. Falls back once to the legacy key-in-path URL on 401/403. */
export async function queryAgents(
  subgraphId: string,
  apiKey: string,
  variables: { first: number; cursor: string; since: string },
  opts: GraphClientOptions = {},
): Promise<RawGraphAgent[]> {
  const { fetchImpl = fetch, sleepImpl = sleep, tries = 6 } = opts;
  const headerUrl = `${GRAPH_GATEWAY}/subgraphs/id/${subgraphId}`;
  const legacyUrl = `${GRAPH_GATEWAY}/${apiKey}/subgraphs/id/${subgraphId}`;
  let url = headerUrl;
  let triedLegacy = false;
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    let waitMs = Math.min(30_000, 1000 * 2 ** attempt);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: QUERY, variables }),
      });
      if ((res.status === 401 || res.status === 403) && !triedLegacy) {
        triedLegacy = true;
        url = legacyUrl;
        continue;
      }
      if (!res.ok) {
        lastErr = new GraphError(`subgraph HTTP ${res.status}`, res.status);
        if (!retryable(res.status)) throw lastErr;
        const ra = Number(res.headers.get("retry-after"));
        if (Number.isFinite(ra) && ra > 0) waitMs = ra * 1000;
      } else {
        const body = (await res.json()) as GqlBody;
        if (body.errors?.length) throw new GraphError(`subgraph error: ${body.errors.map((e) => e.message).join("; ")}`);
        if (!body.data || !Array.isArray(body.data.agents)) throw new GraphError('subgraph response has no "agents" field');
        return body.data.agents;
      }
    } catch (e) {
      if (e instanceof GraphError && e.status !== undefined && !retryable(e.status)) throw e;
      if (e instanceof GraphError && e.status === undefined) throw e;
      lastErr = e;
    }
    if (attempt < tries - 1) await sleepImpl(waitMs);
  }
  throw lastErr instanceof Error ? lastErr : new GraphError(String(lastErr));
}

export type GraphSyncOptions = GraphClientOptions & {
  cfg: ChainConfig;
  store: AgentStore;
  apiKey: string;
  rules?: ProjectRule[];
  full?: boolean;
  log?: (msg: string) => void;
};

export type GraphSyncResult = { pages: number; newAgents: number; updatedAgents: number; maxTokenId: number | null };

/**
 * Walks the subgraph ordered by id with an id cursor. First run: every agent. Later runs: only
 * agents created at or after the latest stored createdAt minus one day (overlap; upsert dedupes).
 */
export async function syncAgentsFromGraph(opts: GraphSyncOptions): Promise<GraphSyncResult> {
  const { cfg, store, apiKey, rules = [], log = () => {} } = opts;
  if (!cfg.subgraphId) throw new GraphError(`chains/${cfg.slug}.json has no subgraphId`);
  const latest = opts.full ? null : store.maxCreatedAt();
  const since = latest ? Math.max(0, Math.floor(Date.parse(latest) / 1000) - 86_400) : 0;
  let cursor = "";
  let pages = 0;
  let newAgents = 0;
  let updatedAgents = 0;
  for (;;) {
    const raws = await queryAgents(cfg.subgraphId, apiKey, { first: PAGE_SIZE, cursor, since: String(since) }, opts);
    pages++;
    if (raws.length === 0) break;
    const records = raws.map((r) => {
      const rec = toAgentRecord(r);
      rec.project = attribute(rec, rules);
      return rec;
    });
    const fresh = records.filter((r) => !store.has(r.tokenId)).length;
    store.upsertMany(records, rules);
    newAgents += fresh;
    updatedAgents += records.length - fresh;
    cursor = raws[raws.length - 1].id;
    if (pages % 10 === 0 || fresh > 0) log(`subgraph page ${pages}: ${fresh} new, ${records.length} seen, cursor ${cursor}`);
    if (raws.length < PAGE_SIZE) break;
  }
  return { pages, newAgents, updatedAgents, maxTokenId: store.maxTokenId() };
}
