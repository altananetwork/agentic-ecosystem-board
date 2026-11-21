import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { KpiCard } from "@/components/KpiCard";
import { Donut } from "@/components/Donut";
import { Hero } from "@/components/Hero";
import { chainLinks, chainLogo, knownSlugs, readBoard, readIndex } from "@/lib/board";
import { ChainMark } from "@/components/ChainMark";
import { SITE_NAME } from "@/lib/site";
import { formatDate, formatDayShort, formatInt, formatUsd, formatUsdCompact } from "@/lib/format";
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

/** "BNB, USDT or USDC" for membership, "BNB, USDT, USDC" for a plain list. */
function orList(tokens: string[]): string {
  if (tokens.length < 2) return tokens.join("");
  return `${tokens.slice(0, -1).join(", ")} or ${tokens[tokens.length - 1]}`;
}

export default async function ChainBoardPage({ params }: { params: Promise<Params> }) {
  const { chain } = await params;
  const [index, board] = await Promise.all([readIndex(), readBoard(chain)]);
  const chains = await chainLinks(index);
  const logo = await chainLogo(chain);

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
  const tokenOr = orList(tokens);

  // Activity needs two snapshots to compare; the first day has nothing to measure yet.
  const pending = activity.daysCovered < 2;
  // Name the window the cards actually cover. It only says "30 days" once 30 snapshots exist.
  const days = Math.min(activity.daysCovered, activity.windowDays);
  const full = days >= activity.windowDays;
  const windowLabel = full ? "30 days" : `${days} ${days === 1 ? "day" : "days"}`;
  const windowNote = full ? "" : ` Window started ${formatDayShort(activity.since)} and grows to ${activity.windowDays} days.`;

  const name = board.chain.name;

  return (
    <>
      <SiteHeader chains={chains} active={chain} />
      <main className="wrap">
        <Hero>
          <div className={styles.top}>
            <div>
              <h1>
                <ChainMark name={name} color={board.chain.color} logo={logo} size={28} />
                {name}
              </h1>
              <div className={styles.meta}>
                Data as of {formatDate(board.asOf)}
                <span className={styles.links}>
                  <a href={board.chain.scanUrl} target="_blank" rel="noreferrer">Agents on 8004scan</a>
                  <a href={`${board.chain.explorerUrl}/address/${board.chain.registry}`} target="_blank" rel="noreferrer">Identity registry</a>
                </span>
              </div>
            </div>
          </div>
        </Hero>

        <section className={styles.grid3}>
          <KpiCard id="agents" title="Total agents" definition="Registered ERC-8004 agents." value={formatInt(totals.agents)} />
          <KpiCard id="owners" title="Unique wallets" definition="Distinct owner wallets across registered agents." value={formatInt(totals.uniqueOwners)} />
          <KpiCard id="funded" title="Wallets with assets" definition={`Wallets holding ${tokenOr}.`} value={formatInt(totals.walletsWithAssets)} />
          <KpiCard id="assets" title="Total assets (USD)" definition={`Current value held in ${tokenList}.`} value={formatUsd(totals.totalAssetsUsd)} />
          {pending ? (
            <>
              <KpiCard id="volume" title="Total volume (USD)" definition={`Gross movement of ${tokenList} balances across agent wallets, measured between daily snapshots. Needs two snapshots. Available after the next run.`} value="Pending" />
              <KpiCard id="active" title="Active agent wallets" definition={`Wallets whose ${tokenOr} balances moved between daily snapshots. Needs two snapshots. Available after the next run.`} value="Pending" />
            </>
          ) : (
            <>
              <KpiCard
                id="volume"
                title={`Total volume, last ${windowLabel} (USD)`}
                definition={`Gross movement of ${tokenList} balances across agent wallets, measured between daily snapshots. Lower bound: moves that net out within a day are not counted.${windowNote}`}
                value={formatUsd(activity.volumeUsd)}
              />
              <KpiCard
                id="active"
                title={`Active agent wallets, last ${windowLabel}`}
                definition={`Wallets whose ${tokenOr} balances moved.${windowNote}`}
                value={formatInt(activity.activeWallets)}
              />
            </>
          )}
        </section>

        <section className={`card ${styles.panel}`}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Top projects by agent count</div>
            <div className={styles.panelDesc}>Named projects ranked by registered agents. Agents without a recognised project are grouped as Other.</div>
          </div>
          <div className={styles.split}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.rank}>Rank</th>
                  <th>Project</th>
                  <th className={styles.num}>Agents</th>
                </tr>
              </thead>
              <tbody>
                {board.topProjects
                  .filter((p) => p.project !== "Other")
                  .map((p, i) => (
                    <tr key={p.project}>
                      <td className={styles.rank}>{i + 1}</td>
                      <td>{p.project}</td>
                      <td className={styles.num}>{formatInt(p.agents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className={styles.donut}>
              <Donut projects={board.topProjects} label={`Top projects on ${name} by agent count`} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
