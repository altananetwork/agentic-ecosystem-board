import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelativeTime } from "@/components/RelativeTime";
import { Hero } from "@/components/Hero";
import { KpiCard } from "@/components/KpiCard";
import { chainLinks, readIndex } from "@/lib/board";
import { ChainMark } from "@/components/ChainMark";
import { formatCompact, formatInt, formatUsd, formatUsdCompact } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-static";

export default async function OverviewPage() {
  const index = await readIndex();
  const chains = index?.chains ?? [];
  const links = await chainLinks(index);
  const agents = chains.reduce((s, c) => s + c.agents, 0);
  const owners = chains.reduce((s, c) => s + c.uniqueOwners, 0);
  const assets = chains.reduce((s, c) => s + c.totalAssetsUsd, 0);
  const scope = chains.length === 1 ? chains[0].name : `${chains.length} chains`;

  return (
    <>
      <SiteHeader chains={links} />
      <main className="wrap">
        <Hero>
          <section className={styles.intro}>
            <h1>Onchain agents, chain by chain</h1>
            <p>
              Daily counts of ERC-8004 agents, their owner wallets and what those wallets hold, on every chain the board covers.
            </p>
          </section>
        </Hero>

        {chains.length === 0 ? (
          <section className="card">
            <div className={styles.empty}>No data published yet. The daily pipeline writes the first payload after its first run.</div>
          </section>
        ) : (
          <>
            <section className={styles.grid}>
              <KpiCard id="agents" title="Total agents" definition={`Registered ERC-8004 agents across ${scope}.`} value={formatInt(agents)} />
              <KpiCard id="owners" title="Unique wallets" definition={`Distinct owner wallets across registered agents on ${scope}. A wallet active on two chains counts once per chain.`} value={formatInt(owners)} />
              <KpiCard id="assets" title="Total assets (USD)" definition={`Current value of tracked assets held by owner wallets across ${scope}. Each chain page lists its tracked assets.`} value={formatUsd(assets)} fullValue={formatUsd(assets)} />
            </section>

            <section className="card">
              <div className={styles.rows}>
                <div className={`${styles.row} ${styles.head}`} aria-hidden>
                  <span>Chain</span><span>Agents</span><span>Unique wallets</span><span>Total assets</span><span>Updated</span><span />
                </div>
                {links.map((c, i) => (
                  <Link key={c.slug} href={`/${c.slug}`} className={styles.row}>
                    <span className={styles.chainName}>
                      <ChainMark name={c.name} color={c.color} logo={c.logo} size={18} />
                      {c.name}
                    </span>
                    <span className={styles.n} title={formatInt(chains[i].agents)}>{formatCompact(chains[i].agents)}</span>
                    <span className={styles.n} title={formatInt(chains[i].uniqueOwners)}>{formatCompact(chains[i].uniqueOwners)}</span>
                    <span className={styles.n} title={formatUsd(chains[i].totalAssetsUsd)}>{formatUsdCompact(chains[i].totalAssetsUsd)}</span>
                    <span className={styles.updated}><RelativeTime iso={chains[i].asOf} /></span>
                    <span className={styles.open}>Open</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
