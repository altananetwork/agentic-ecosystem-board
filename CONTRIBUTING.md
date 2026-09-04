# Contributing

Thanks for helping. Three kinds of contribution, from easiest to hardest.

## 1. Add a chain

Copy `chains/bnb.json` to `chains/<slug>.json` and fill it in:

- `slug`: short lowercase id, used in the URL (`/base`, `/celo`).
- `chainId`, `name`, `shortName`, `color` (the chain's brand color, used for the dot on the overview).
- `explorerUrl` and `scanUrl` (the 8004scan agents page for that chain id).
- `registry`: the ERC-8004 IdentityRegistry. It is `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on every EVM chain deployed by the ERC-8004 team.
- `multicall3`: `0xcA11bde05977b3631167028862bE2a173976CA11` on most chains.
- `rpcs`: public HTTPS endpoints. Keyless. The pipeline rotates through them.
- `native` and `tokens`: what to count as holdings. Stablecoins get a fixed `priceUsd: 1`; the native coin is priced from the Binance ticker symbol in `priceSymbol`.
- `liveSince`: the date the registry went live on that chain.

Create an empty rules file at `data/projects/<slug>.json` (`{"rules": []}`) and run `bun run validate`. The daily job picks the chain up automatically after merge. The first run backfills every agent from 8004scan, which takes about a second per hundred agents.

## 2. Map agents to a project

Agents register with a display name, and most projects register thousands of agents with the same name prefix. `data/projects/<slug>.json` holds ordered rules; the first match wins:

```json
{ "match": "name", "value": "Ave.ai Trading Agent", "project": "Ave.ai" }
{ "match": "description", "value": "registered through TermiX", "project": "TermiX" }
{ "match": "host", "value": "example.com", "project": "Example" }
```

`name` matches the start of the agent name (case-insensitive), `description` matches anywhere in the description, `host` matches the end of the agentURI host. Agents with no rule keep their cleaned name (a trailing `#123` is stripped). Run `bun run sync -- --chain <slug>` locally and it prints the most frequent unmapped names, which is where new rules come from.

## 3. Change the pipeline or the site

- Pipeline code lives in `pipeline/` (pure functions) and `scripts/` (entry points). Add or update tests in `test/`.
- The site lives in `app/` and `components/`. It only reads `public/data/*.json`; it never calls external services at request time.
- Run `bun run validate`, `bun run typecheck`, `bun test`, and `bun run build` before opening a PR.

## Style rules for copy and UI

- Plain sentences. No em dashes. No small uppercase labels above headings. No monospace type, not even for addresses.
- Numbers on the board are computed, never typed in.
- Do not add API keys or secrets anywhere in the repo. The pipeline must keep working keyless.

## Branches

Open pull requests against `staging`. `main` is release-only and receives `staging` when a release is cut.
