import Link from "next/link";
import styles from "./ChainTabs.module.css";

export type ChainTab = { slug: string; name: string; color: string; published: boolean };

/** Segmented control for the chain being viewed. Configured chains without data are shown disabled. */
export function ChainTabs({ chains, active }: { chains: ChainTab[]; active: string }) {
  if (chains.length === 0) return null;
  return (
    <div className={styles.wrap}>
      <span className={styles.caption}>Chain</span>
      <div className={styles.group} role="tablist" aria-label="Chain">
        {chains.map((c) => {
          const isActive = c.slug === active;
          const cls = `${styles.tab} ${isActive ? styles.active : ""} ${c.published ? "" : styles.disabled}`;
          const inner = (
            <>
              <span className={styles.dot} style={{ background: c.color }} aria-hidden />
              {c.name}
            </>
          );
          return c.published ? (
            <Link key={c.slug} href={`/${c.slug}`} className={cls} role="tab" aria-selected={isActive} aria-current={isActive ? "page" : undefined}>
              {inner}
            </Link>
          ) : (
            <span key={c.slug} className={cls} role="tab" aria-selected={false} aria-disabled title="No data yet">
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
