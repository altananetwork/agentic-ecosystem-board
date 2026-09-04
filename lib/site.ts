export const SITE_NAME = "Agentic Ecosystem Board";
export const TAGLINE = "Open data on ERC-8004 agents, their wallets and holdings, per chain";

export const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/altananetwork/agentic-ecosystem-board";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
  "http://localhost:3000";
