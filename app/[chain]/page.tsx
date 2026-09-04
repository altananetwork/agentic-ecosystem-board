import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { KpiCard } from "@/components/KpiCard";
import { Donut } from "@/components/Donut";
import { DashboardNotes } from "@/components/DashboardNotes";
import { Hero } from "@/components/Hero";
import { ChainTabs, type ChainTab } from "@/components/ChainTabs";
import { configuredSlugs, knownSlugs, readBoard, readIndex } from "@/lib/board";
import { SITE_NAME } from "@/lib/site";
import { formatInt, formatUsd, formatUsdCompact, formatUtc } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-static";
export const dynamicParams = false;

type Params = { chain: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await knownSlugs();
  return slugs.map((chain) => ({ chain }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { chain } = await params;
  const board = await readBoard(chain);
  if (!board) return { title: "Board" };
  return {
    title: board.chain.name,
    description: `${formatInt(board.totals.agents)} ERC-8004 agents on ${board.chain.name}, owned by ${formatInt(board.totals.uniqueOwners)} wallets holding ${formatUsdCompact(board.totals.totalAssetsUsd)}. Refreshed daily.`,
    alternates: { canonical: `/${chain}` },
    openGraph: { title: `${board.chain.name} · ${SITE_NAME}` },
  };
}

/** Published chains first, then configured chains that have no payload yet (disabled). */
async function chainTabs(index: Awaited<ReturnType<typeof readIndex>>): Promise<ChainTab[]> {
  const published: ChainTab[] = (index?.chains ?? []).map((c) => ({ slug: c.slug, name: c.name, color: c.color, published: true }));
  const seen = new Set(published.map((c) => c.slug));
  const pending: ChainTab[] = (await configuredSlugs())
    .filter((slug) => !seen.has(slug))
    .map((slug) => ({ slug, name: slug.toUpperCase(), color: "var(--text-tertiary)", published: false }));
  return [...published, ...pending];
}

export default async function ChainBoardPage({ params }: { params: Promise<Params> }) {
  const { chain } = await params;
  const [index, board] = await Promise.all([readIndex(), readBoard(chain)]);
  const chains = (index?.chains ?? []).map((c) => ({ slug: c.slug, name: c.name, color: c.color }));
  const tabs = await chainTabs(index);

  if (!board) {
    const slugs = await knownSlugs();
    if (!slugs.includes(chain)) notFound();
    return (
      <>
        <SiteHeader chains={chains} active={chain} />
        <main className="wrap">
          <Hero>
            <div className={styles.top}>
              <h1>{chain.toUpperCase()}</h1>
            </div>
            <div className={styles.tabs}>
              <ChainTabs chains={tabs} active={chain} />
            </div>
          </Hero>
          <section className={`card ${styles.notice}`}>
            This chain is configured but has no published data yet. The daily pipeline writes the first payload after its first run.
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { totals, activity } = board;
  const tokens = totals.byToken.map((t) => t.symbol);
  const tokenList = tokens.join(", ");
  // Activity needs two snapshots to compare; the first day has nothing to measure yet.
  const pending = activity.daysCovered < 2;
  const name = board.chain.name;
  const asOf = board.asOf;

  return (
    <>
      <SiteHeader chains={chains} active={chain} />
      <main className="wrap">
        <Hero>
          <div className={styles.top}>
            <div>
              <h1>
                <span className={styles.dot} style={{ background: board.chain.color }} aria-hidden />
                {name}
              </h1>
              <div className={styles.meta}>
                Data as of {formatUtc(asOf)}
                <span className={styles.links}>
                  <a href={board.chain.scanUrl} target="_blank" rel="noreferrer">Agents on 8004scan</a>
                  <a href={`${board.chain.explorerUrl}/address/${board.chain.registry}`} target="_blank" rel="noreferrer">Identity registry</a>
                </span>
              </div>
            </div>
          </div>
          <div className={styles.tabs}>
            <ChainTabs chains={tabs} active={chain} />
          </div>
        </Hero>

        <section className={`card ${styles.block}`}>
          <DashboardNotes chainName={name} tokens={tokens} agentsSource={board.sources?.agents.name} crossCheck={board.sources?.crossCheck?.name} />
        </section>

        <section className={styles.grid}>
          <KpiCard title="Total agents" description="Registered ERC-8004 agents" value={formatInt(totals.agents)} chainName={name} asOf={asOf} />
          <KpiCard title="Unique wallets" description="Distinct owner wallets across registered agents" value={formatInt(totals.uniqueOwners)} chainName={name} asOf={asOf} />
          <KpiCard title="Wallets with assets" description={`Wallets holding ${tokenList}`} value={formatInt(totals.walletsWithAssets)} chainName={name} asOf={asOf} />
          <KpiCard title="Total assets (USD)" description={tokens.join(" + ")} value={formatUsd(totals.totalAssetsUsd)} chainName={name} asOf={asOf} />
          {pending ? (
            <>
              <KpiCard title="30D total volume (USD)" description="Measured from the second daily run onwards" value="Pending" chainName={name} asOf={asOf} />
              <KpiCard title="Active agent wallets, 30D" description="Measured from the second daily run onwards" value="Pending" chainName={name} asOf={asOf} />
            </>
          ) : (
            <>
              <KpiCard title="30D total volume (USD)" description="Gross balance movement across agent wallets, last 30 days" value={formatUsd(activity.volumeUsd)} chainName={name} asOf={asOf} />
              <KpiCard title="Active agent wallets, 30D" description="Wallets whose balances moved in the last 30 days" value={formatInt(activity.activeWallets)} chainName={name} asOf={asOf} />
            </>
          )}
        </section>

        <section className={styles.grid}>
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <div className={styles.panelTitle}>Top projects by agent count</div>
              <div className={styles.panelDesc}>Named projects by registered ERC-8004 agents</div>
            </div>
            <Donut projects={board.topProjects} label={`Top projects on ${name} by agent count`} />
          </div>
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <div className={styles.panelTitle}>Top projects</div>
              <div className={styles.panelDesc}>Named projects ranked by registered agent count</div>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Project</th>
                  <th className={styles.num}>Agents</th>
                </tr>
              </thead>
              <tbody>
                {board.topProjects
                  .filter((p) => p.project !== "Other")
                  .map((p, i) => (
                    <tr key={p.project}>
                      <td>{i + 1}</td>
                      <td>{p.project}</td>
                      <td className={styles.num}>{formatInt(p.agents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
