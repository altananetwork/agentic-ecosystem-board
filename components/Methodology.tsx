import styles from "./Methodology.module.css";

export function Methodology({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ol className={styles.list}>
      {items.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  );
}
