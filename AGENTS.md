# Repo rules for agents and humans

- Public, open-source repo. Never commit secrets, private RPC URLs, or personal data. The pipeline must run with zero keys.
- Chain-agnostic. Anything chain-specific goes in `chains/<slug>.json` or `data/projects/<slug>.json`, never in code.
- The site reads committed JSON in `public/data/`. No live external calls from pages or API routes.
- Pipeline code in `pipeline/` is pure and unit-tested; `scripts/` are thin entry points. Tests use `bun test` with mocked fetch and RPC, no network.
- Branding: neutral. Altana appears only as a contributor credit. Follow the Altana design tokens and the brand hard rules: no eyebrows, no monospace, no em dashes, body never bold, badges squared.
- Branch flow: feature branch -> `staging` -> `main`. PRs target `staging`. The daily workflow commits data to the default branch only.
- Before a PR: `bun run validate && bun run typecheck && bun test && bun run build`.
