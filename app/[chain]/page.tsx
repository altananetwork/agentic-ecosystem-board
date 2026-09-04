import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { AreaChart } from "@/components/AreaChart";
import { TopProjects } from "@/components/TopProjects";
import { Methodology } from "@/components/Methodology";
import { Hero } from "@/components/Hero";
import { Sources } from "@/components/Sources";
import { ChainTabs, type ChainTab } from "@/components/ChainTabs";
import { configuredSlugs, knownSlugs, readBoard, readIndex } from "@/lib/board";
import { SITE_NAME } from "@/lib/site";
import {
  formatAmount,
  formatCompact,
  formatInt,
  formatSignedUsd,
  formatUsd,
  formatUsdCompact,
  formatUtc,
} from "@/lib/format";
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
  const partial = activity.daysCovered < activity.windowDays;
  // Activity needs two snapshots to compare; the first day has nothing to measure yet.
  const pending = activity.daysCovered < 2;
  const windowNote = partial ? `since ${activity.since}, ${activity.daysCovered} of ${activity.windowDays} days covered` : `since ${activity.since}`;
  const breakdown = totals.byToken.map((t) => formatAmount(t.amount, t.symbol)).join(", ");
  const history = board.history.map((h) => ({ date: h.date, value: h.totalAssetsUsd }));
  const agentsSource = board.sources ? { name: board.sources.agents.name, url: board.sources.agents.url } : undefined;
  const holdingsSource = board.sources ? { name: board.sources.holdings.name, url: board.sources.holdings.url } : undefined;

  return (
    <>
      <SiteHeader chains={chains} active={chain} />
      <main className="wrap">
        <Hero>
          <div className={styles.top}>
            <div>
              <h1>
                <span className={styles.dot} style={{ background: board.chain.color }} aria-hidden />
                {board.chain.name}
              </h1>
              <div className={styles.meta}>
                Data as of {formatUtc(board.asOf)}
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

        {board.sources ? (
          <section className={styles.sources}>
            <Sources sources={board.sources} />
            <p className={styles.volumeNote}>
              This board does not track transfer volume. Holdings are balances at read time and can fall while activity rises.
            </p>
          </section>
        ) : null}

        <section className={styles.tiles}>
          <StatTile label="Total agents" value={formatCompact(totals.agents)} title={formatInt(totals.agents)} sub="registered in the ERC-8004 identity registry" source={agentsSource} />
          <StatTile label="Unique owner wallets" value={formatCompact(totals.uniqueOwners)} title={formatInt(totals.uniqueOwners)} sub="wallets that currently own at least one agent" source={agentsSource} />
          <StatTile label="Wallets with assets" value={formatCompact(totals.walletsWithAssets)} title={formatInt(totals.walletsWithAssets)} sub="owner wallets holding tracked tokens" source={holdingsSource} />
          <StatTile label="Assets held now (USD)" value={formatUsdCompact(totals.totalAssetsUsd)} title={formatUsd(totals.totalAssetsUsd)} sub={`${breakdown}, held in owner wallets at read time, not volume`} source={holdingsSource} />
          {pending ? (
            <>
              <StatTile label="Active wallets, last 30 days" value="Pending" sub="measured from the second daily run onwards" source={holdingsSource} />
              <StatTile label="Net flow, last 30 days" value="Pending" sub="measured from the second daily run onwards" source={holdingsSource} />
            </>
          ) : (
            <>
              <StatTile label="Active wallets, last 30 days" value={formatCompact(activity.activeWallets)} title={formatInt(activity.activeWallets)} sub={windowNote} source={holdingsSource} />
              <StatTile label="Net flow, last 30 days" value={formatSignedUsd(activity.netFlowUsd)} title={formatUsd(activity.netFlowUsd)} sub={windowNote} source={holdingsSource} />
            </>
          )}
        </section>

        <section className={`section ${styles.charts}`}>
          <div className={`card ${styles.chartCard}`}>
            <h2>New agents per day, last 31 days</h2>
            <BarChart data={board.registrationsDaily} label="New agents per day" />
          </div>
          <div className={`card ${styles.chartCard}`}>
            <h2>Assets held (USD) over time</h2>
            <AreaChart data={history} label="Total assets held by owner wallets" />
          </div>
        </section>

        <section className="section">
          <div className="section-h">
            <h2>Top projects by agent count</h2>
            <p>Attribution from agent names, descriptions and metadata hosts. Improve it by pull request.</p>
          </div>
          <div className="card">
            <TopProjects projects={board.topProjects} />
          </div>
        </section>

        <section className="section">
          <div className="section-h">
            <h2>How the numbers are computed</h2>
          </div>
          <div className="card">
            <Methodology items={board.methodology} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
