# Agentic Ecosystem Board

Open data on ERC-8004 agents, their owner wallets and holdings, per chain. Public site, public data, refreshed daily by a keyless pipeline that anyone can run.

Live board: (add the Vercel URL after the first deploy)

## What it shows, per chain

- Total agents registered in the ERC-8004 Identity Registry
- Unique owner wallets and wallets holding at least one tracked asset
- Total assets held in the native coin plus configured stablecoins, in USD
- 30-day total volume, measured as gross balance movement across agent wallets between daily snapshots
- Active agent wallets over the last 30 days
- Top projects by agent count

BNB Chain is the first chain. Base and Celo are next; adding a chain is one JSON file.

## How it works

Two halves in one repo. A GitHub Actions job runs once a day: it pulls agents from the public 8004scan API, reads balances on-chain through Multicall3, computes the metrics, and commits one JSON file per chain into `public/data/`. A static Next.js site on Vercel renders those files. Nothing runs continuously and nothing needs a key.

```
chains/<slug>.json          chain config (registry, RPCs, tokens)
data/projects/<slug>.json   rules that map agent names to projects
data/snapshots/<slug>/      one small summary per day (history for the charts)
public/data/<slug>.json     the payload the site renders
pipeline/, scripts/         the job (bun + TypeScript, unit tested)
app/, components/           the site (Next.js, Altana design tokens)
```

## Run it locally

```
bun install
bun run all --chain bnb    # first run backfills every agent, about an hour for BNB
bun run dev
```

## Contribute

Add a chain, add a project rule, or improve the pipeline or the site. See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests go to `staging`.

Contributors: [Altana](https://altana.network). License: MIT.
