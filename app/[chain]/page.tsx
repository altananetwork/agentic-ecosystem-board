import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { AreaChart } from "@/components/AreaChart";
import { TopProjects } from "@/components/TopProjects";
import { Methodology } from "@/components/Methodology";
import { knownSlugs, readBoard, readIndex } from "@/lib/board";
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

export default async function ChainBoardPage({ params }: { params: Promise<Params> }) {
  const { chain } = await params;
  const [index, board] = await Promise.all([readIndex(), readBoard(chain)]);
  const chains = (index?.chains ?? []).map((c) => ({ slug: c.slug, name: c.name, color: c.color }));

  if (!board) {
    const slugs = await knownSlugs();
    if (!slugs.includes(chain)) notFound();
    return (
      <>
        <SiteHeader chains={chains} active={chain} />
        <main className="wrap">
          <section className={`card ${styles.notice}`} style={{ marginTop: 32 }}>
            This chain is configured but has no published data yet. The daily pipeline writes the first payload after its first run.
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { totals, activity } = board;
  const partial = activity.daysCovered < activity.windowDays;
  const windowNote = partial ? `since ${activity.since}, ${activity.daysCovered} of ${activity.windowDays} days covered` : `since ${activity.since}`;
  const breakdown = totals.byToken.map((t) => formatAmount(t.amount, t.symbol)).join(", ");
  const history = board.history.map((h) => ({ date: h.date, value: h.totalAssetsUsd }));

  return (
    <>
      <SiteHeader chains={chains} active={chain} />
      <main className="wrap">
        <div className={styles.top}>
          <div>
            <h1>
              <span className={styles.dot} style={{ background: board.chain.color }} aria-hidden />
              {board.chain.name}
            </h1>
            <div className={styles.meta}>Data as of {formatUtc(board.asOf)}</div>
          </div>
          <div className={styles.links}>
            <a href={board.chain.scanUrl} target="_blank" rel="noreferrer">Agents on 8004scan</a>
            <a href={`${board.chain.explorerUrl}/address/${board.chain.registry}`} target="_blank" rel="noreferrer">Identity registry</a>
          </div>
        </div>

        <section className={styles.tiles}>
          <StatTile label="Total agents" value={formatCompact(totals.agents)} title={formatInt(totals.agents)} sub="registered in the ERC-8004 identity registry" />
          <StatTile label="Unique owner wallets" value={formatCompact(totals.uniqueOwners)} title={formatInt(totals.uniqueOwners)} sub="wallets that currently own at least one agent" />
          <StatTile label="Wallets with assets" value={formatCompact(totals.walletsWithAssets)} title={formatInt(totals.walletsWithAssets)} sub="owner wallets holding tracked tokens" />
          <StatTile label="Total assets (USD)" value={formatUsdCompact(totals.totalAssetsUsd)} title={formatUsd(totals.totalAssetsUsd)} sub={breakdown} />
          <StatTile label="Active wallets, last 30 days" value={formatCompact(activity.activeWallets)} title={formatInt(activity.activeWallets)} sub={windowNote} />
          <StatTile label="Net flow, last 30 days" value={formatSignedUsd(activity.netFlowUsd)} title={formatUsd(activity.netFlowUsd)} sub={windowNote} />
        </section>

        <section className={`section ${styles.charts}`}>
          <div className={`card ${styles.chartCard}`}>
            <h2>New agents per day, last 31 days</h2>
            <BarChart data={board.registrationsDaily} label="New agents per day" />
          </div>
          <div className={`card ${styles.chartCard}`}>
            <h2>Total assets (USD) over time</h2>
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
