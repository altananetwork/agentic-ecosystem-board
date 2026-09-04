import styles from "./StatTile.module.css";

export type TileSource = { name: string; url: string };

export function StatTile({
  label,
  value,
  title,
  sub,
  source,
}: {
  label: string;
  value: string;
  /** full-precision value for the hover title */
  title?: string;
  sub?: React.ReactNode;
  /** where this number comes from, shown as a small link */
  source?: TileSource;
}) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} title={title}>{value}</div>
      {sub ? <div className={styles.sub}>{sub}</div> : null}
      {source ? (
        <div className={styles.source}>
          Source: <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
        </div>
      ) : null}
    </div>
  );
}
