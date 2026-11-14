export const SITE_NAME = "Onchain Agents Ecosystem";
export const TAGLINE = "ERC-8004 agents, wallets and holdings by chain";
export const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/altananetwork/agentic-ecosystem-board";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
  "http://localhost:3000";
