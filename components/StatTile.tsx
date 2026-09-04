import styles from "./StatTile.module.css";

export function StatTile({
  label,
  value,
  title,
  sub,
}: {
  label: string;
  value: string;
  /** full-precision value for the hover title */
  title?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} title={title}>{value}</div>
      {sub ? <div className={styles.sub}>{sub}</div> : null}
    </div>
  );
}
