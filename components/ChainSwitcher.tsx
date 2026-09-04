import Link from "next/link";
import styles from "./ChainSwitcher.module.css";

export type ChainLink = { slug: string; name: string; color: string };

export function ChainSwitcher({ chains, active }: { chains: ChainLink[]; active?: string }) {
  if (chains.length === 0) return null;
  return (
    <nav className={styles.nav} aria-label="Chains">
      <Link href="/" className={`${styles.link} ${active ? "" : styles.active}`}>All chains</Link>
      {chains.map((c) => (
        <Link
          key={c.slug}
          href={`/${c.slug}`}
          className={`${styles.link} ${active === c.slug ? styles.active : ""}`}
          aria-current={active === c.slug ? "page" : undefined}
        >
          <span className={styles.dot} style={{ background: c.color }} aria-hidden />
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
