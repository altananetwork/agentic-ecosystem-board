import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { chainLinks, chainLogo, readBoard, readIndex } from "@/lib/board";
import { ChainMark } from "@/components/ChainMark";
import { REPO_URL } from "@/lib/site";
import { formatUtc } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How this is measured",
  description: "Where each number on the board comes from, what it counts, and what it leaves out.",
  alternates: { canonical: "/methodology" },
};

export default async function MethodologyPage() {
  const index = await readIndex();
  const chains = index?.chains ?? [];
  const boards = (await Promise.all(chains.map((c) => readBoard(c.slug)))).filter((b) => b !== null);
  const logos = Object.fromEntries(await Promise.all(boards.map(async (b) => [b.chain.slug, await chainLogo(b.chain.slug)] as const)));

  return (
    <>
      <SiteHeader chains={await chainLinks(index)} />
      <main className={`wrap ${styles.page}`}>
        <h1>How this is measured</h1>
        <p className={styles.lead}>
          Every number is rebuilt once a day by a public pipeline and committed to the repository, so the full history is reproducible. Nothing on the site calls an external service at read time.
        </p>

        <h2>Metrics</h2>
        <dl className={styles.defs}>
          <dt>Total agents</dt>
          <dd>Registered ERC-8004 agents, counted from the identity registry on each chain.</dd>
          <dt>Unique wallets</dt>
          <dd>Distinct current owners of those agents. One wallet can own many agents. Burn addresses are excluded.</dd>
          <dt>Wallets with assets</dt>
          <dd>Owner wallets holding at least one tracked asset at the time of the snapshot.</dd>
          <dt>Total assets (USD)</dt>
          <dd>Current balances of the tracked assets across all owner wallets, read directly from the chain and priced at the native token spot price.</dd>
          <dt>Total volume (USD)</dt>
          <dd>Gross change in tracked balances between one daily snapshot and the next, summed over the window. It is a lower bound: moves that net out within a day are not visible. The window grows one day per run until it covers 30 days.</dd>
          <dt>Active agent wallets</dt>
          <dd>Owner wallets whose tracked balances changed at least once inside the window.</dd>
          <dt>Top projects</dt>
          <dd>Agents grouped by the name they registered with, or by the host of their metadata URI, using the rules file in the repository. Anything unmatched is Other.</dd>
        </dl>

        {boards.map((b) => (
          <section key={b.chain.slug} className={styles.chain}>
            <h2>
              <ChainMark name={b.chain.name} color={b.chain.color} logo={logos[b.chain.slug]} size={18} />
              {b.chain.name}
            </h2>
            <dl className={styles.defs}>
              <dt>Tracked assets</dt>
              <dd>{b.totals.byToken.map((t) => t.symbol).join(", ")}</dd>
              {b.sources ? (
                <>
                  <dt>Agent index</dt>
                  <dd>
                    <a href={b.sources.agents.url} target="_blank" rel="noreferrer">{b.sources.agents.name}</a>
                    {b.sources.crossCheck ? (
                      <>
                        , cross-checked against <a href={b.sources.crossCheck.url} target="_blank" rel="noreferrer">{b.sources.crossCheck.name}</a>. Counts can differ slightly between indexers.
                      </>
                    ) : "."}
                  </dd>
                  <dt>Balances</dt>
                  <dd><a href={b.sources.holdings.url} target="_blank" rel="noreferrer">{b.sources.holdings.name}</a>, {b.sources.holdings.detail}.</dd>
                  <dt>Prices</dt>
                  <dd><a href={b.sources.prices.url} target="_blank" rel="noreferrer">{b.sources.prices.name}</a>, {b.sources.prices.detail}.</dd>
                </>
              ) : null}
              <dt>Registry</dt>
              <dd><a href={`${b.chain.explorerUrl}/address/${b.chain.registry}`} target="_blank" rel="noreferrer">{b.chain.registry}</a></dd>
              <dt>Last run</dt>
              <dd>{formatUtc(b.asOf)}</dd>
            </dl>
          </section>
        ))}

        <h2>Contribute</h2>
        <p>
          Chain configs, project rules and the pipeline are open source under MIT. Add a chain or fix an attribution with a pull request to the <a href={REPO_URL} target="_blank" rel="noreferrer">repository</a>.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
