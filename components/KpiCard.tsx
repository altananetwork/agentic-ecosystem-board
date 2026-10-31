import { InfoTip } from "./InfoTip";
import styles from "./KpiCard.module.css";

/** One number per card. The title names it, the info control explains it. */
export function KpiCard({
  id,
  title,
  definition,
  value,
  fullValue,
}: {
  /** stable id for the tooltip, unique on the page */
  id: string;
  title: string;
  /** what the number measures, one or two short sentences */
  definition: string;
  value: string;
  /** full-precision value for the hover title */
  fullValue?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <InfoTip id={`tip-${id}`} text={definition} />
      </div>
      <div className={styles.value} title={fullValue}>{value}</div>
    </div>
  );
}
