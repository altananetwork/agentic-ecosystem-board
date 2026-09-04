# Runbook

## What runs by itself

Every day at 04:17 UTC the `Daily data refresh` workflow runs in GitHub Actions. For each chain in `chains/` it:

1. pulls new agents from 8004scan into the local database (incremental, newest first),
2. reads the owner wallets' balances on-chain through Multicall3 and prices them,
3. writes a small summary to `data/snapshots/<slug>/<date>.json` and the board payload to `public/data/<slug>.json`,
4. commits both. Vercel redeploys on the commit, so the site updates a minute later.

The working database and wallet state live in the Actions cache and are backed up to a GitHub release called `data-backup` after every run. If both are lost, the next run rebuilds from scratch (about an hour for BNB) and the 30-day activity metrics start over. The committed snapshots keep the history that the charts use.

## One-time setup

1. Create the Vercel project from the GitHub repo. Framework: Next.js. No environment variables needed. Optionally set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_REPO_URL`.
2. Allow Actions to write, so the daily job can commit data and update the backup release. Organisation first: Organisation settings > Actions > General > Workflow permissions > "Read and write permissions" (if the organisation locks this to read-only, the repository setting cannot override it). Then the same in the repository: Settings > Actions > General > Workflow permissions.
3. The workflow only appears under Actions once it exists on the default branch (`main`), so release `staging` to `main` first. Then trigger the first run: Actions > Daily data refresh > Run workflow. With the `GRAPH_API_KEY` secret the BNB backfill takes a few minutes; without it, hours. A cache backup already exists on the `data-backup` release, so the first run starts incremental.
4. Optional: add a repository secret `RPC_URLS_BNB` with your own endpoints, comma separated. Public endpoints work without it.

## Faster backfill with The Graph

8004scan throttles deep page reads, so a first backfill from it takes hours for a large chain. The Agent0 subgraph on The Graph serves the same agents in minutes. Create a free API key at https://thegraph.com/studio/apikeys/, add it as the repository secret `GRAPH_API_KEY`, and put it in your local `.env` as `GRAPH_API_KEY=...`. With the key set, the sync reads the subgraph first and then a few 8004scan pages to cross-check the total. Without the key everything still works from 8004scan alone; only the first backfill is slow.

## Run it by hand

```
bun install
bun run all --chain bnb        # sync, balances, build for one chain
bun run sync --chain bnb       # only the 8004scan sync (prints unmapped names)
bun run balances --chain bnb   # only balances and today's snapshot
bun run build:data             # only the payloads
bun run dev                    # site on http://localhost:3000
```

The local cache is in `cache/` (gitignored). Delete it to force a full backfill.

## Add a chain or a project rule

See CONTRIBUTING.md. After merging a new chain, run the workflow by hand once so the first backfill does not wait for the schedule.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Workflow fails on RPC errors | The public endpoints were rate limited. Rerun; the balances step retries and rotates endpoints. For a permanent fix add `RPC_URLS_<SLUG>` as a secret. |
| Workflow fails on 8004scan 5xx | Rerun. The sync is resumable and picks up where it stopped. |
| Agents on the board are far below 8004scan | Check the workflow log for "gap"; run the workflow by hand with the chain slug to finish the backfill. |
| Active wallets dropped to a small number | The wallet state was rebuilt from scratch (cache and backup both lost). The tile shows how many days are covered; it recovers over 30 days. |
| Site shows "No data published yet" | The first workflow run has not committed a payload. Trigger it. |
| A project is missing from Top projects | Add a rule in `data/projects/<slug>.json` and open a PR. Attribution is recomputed on the next run. |
