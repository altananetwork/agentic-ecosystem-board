import type { BoardSources, SourceRef } from "@/pipeline/types";
import { formatInt, formatUsdPrecise } from "@/lib/format";
import { RelativeTime } from "./RelativeTime";
import styles from "./Sources.module.css";

type Row = { key: keyof BoardSources; label: string; ref: SourceRef; kind: "count" | "price" | "none" };

export function sourceRows(sources: BoardSources): Row[] {
  const rows: Row[] = [{ key: "agents", label: "Agents", ref: sources.agents, kind: "count" }];
  if (sources.crossCheck) rows.push({ key: "crossCheck", label: "Cross-check", ref: sources.crossCheck, kind: "count" });
  rows.push({ key: "holdings", label: "Holdings", ref: sources.holdings, kind: "none" });
  rows.push({ key: "prices", label: "Prices", ref: sources.prices, kind: "price" });
  return rows;
}

function valueText(row: Row): string | null {
  const v = row.ref.value;
  if (v === undefined || v === null) return null;
  if (row.kind === "price") return formatUsdPrecise(v);
  if (row.kind === "count") return `${formatInt(v)} agents`;
  return null;
}

/** Where every number on the board comes from, one row per source, like query provenance on Dune. */
export function Sources({ sources }: { sources?: BoardSources }) {
  if (!sources) return null;
  return (
    <div className={`card ${styles.card}`} data-testid="sources">
      <div className={styles.heading}>Sources</div>
      <ul className={styles.list}>
        {sourceRows(sources).map((row) => {
          const value = valueText(row);
          return (
            <li key={row.key} className={styles.row}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.main}>
                <a href={row.ref.url} target="_blank" rel="noreferrer" className={styles.name}>{row.ref.name}</a>
                {row.ref.detail ? <span className={styles.detail}>{row.ref.detail}</span> : null}
              </span>
              <span className={styles.value}>{value ?? ""}</span>
              <span className={styles.when}><RelativeTime iso={row.ref.asOf} prefix="read " /></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
