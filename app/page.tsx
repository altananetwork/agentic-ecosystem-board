import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelativeTime } from "@/components/RelativeTime";
import { Hero } from "@/components/Hero";
import { readIndex } from "@/lib/board";
import { formatCompact, formatInt, formatUsd, formatUsdCompact } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-static";

export default async function OverviewPage() {
  const index = await readIndex();
  const chains = index?.chains ?? [];

  return (
    <>
      <SiteHeader chains={chains.map((c) => ({ slug: c.slug, name: c.name, color: c.color }))} />
      <main className="wrap">
        <Hero>
          <section className={styles.intro}>
            <h1>The agentic ecosystem, chain by chain</h1>
            <p>
              This board tracks ERC-8004 agents on every chain it is configured for: how many exist, the wallets that own
              them, what those wallets hold, and which projects register the most agents. A pipeline refreshes the numbers
              once a day from public agent indexes and direct on-chain reads. The
              code, the chain configs and the project rules are open source, and anyone can add a chain or improve
              attribution with a pull request.
            </p>
          </section>
        </Hero>

        <section className="card">
          {chains.length === 0 ? (
            <div className={styles.empty}>No data published yet. The daily pipeline writes the first payload after its first run.</div>
          ) : (
            <div className={styles.rows}>
              <div className={`${styles.row} ${styles.head}`} aria-hidden>
                <span>Chain</span><span>Agents</span><span>Owner wallets</span><span>Total assets</span><span>Updated</span><span />
              </div>
              {chains.map((c) => (
                <Link key={c.slug} href={`/${c.slug}`} className={styles.row}>
                  <span className={styles.chainName}>
                    <span className={styles.dot} style={{ background: c.color }} aria-hidden />
                    {c.name}
                  </span>
                  <span>
                    <span className={styles.n} title={formatInt(c.agents)}>{formatCompact(c.agents)}</span>
                    <div className={styles.sub}>agents</div>
                  </span>
                  <span>
                    <span className={styles.n} title={formatInt(c.uniqueOwners)}>{formatCompact(c.uniqueOwners)}</span>
                    <div className={styles.sub}>unique owners</div>
                  </span>
                  <span>
                    <span className={styles.n} title={formatUsd(c.totalAssetsUsd)}>{formatUsdCompact(c.totalAssetsUsd)}</span>
                    <div className={styles.sub}>held by owners</div>
                  </span>
                  <span className={styles.updated}><RelativeTime iso={c.asOf} prefix="updated " /></span>
                  <span className={styles.open}>Open board</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
