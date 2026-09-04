import { RelativeTime } from "./RelativeTime";
import styles from "./KpiCard.module.css";

/**
 * A Dune-style counter: title and short description up top, one big centred number
 * with the title repeated under it, and a footer with the chain name and freshness.
 */
export function KpiCard({
  title,
  description,
  value,
  fullValue,
  chainName,
  asOf,
}: {
  title: string;
  description: string;
  value: string;
  /** full-precision value for the hover title */
  fullValue?: string;
  chainName: string;
  asOf: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.title}>{title}</div>
        <div className={styles.desc}>{description}</div>
      </div>
      <div className={styles.body}>
        <div className={styles.value} title={fullValue}>{value}</div>
        <div className={styles.repeat}>{title}</div>
      </div>
      <div className={styles.foot}>
        <span className={styles.chain}>{chainName}</span>
        <span className={styles.fresh}>
          <RelativeTime iso={asOf} prefix="Updated " />
          <span className={styles.badge} aria-hidden>
            <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </span>
      </div>
    </div>
  );
}
