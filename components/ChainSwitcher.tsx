import Link from "next/link";
import { ChainMark } from "./ChainMark";
import styles from "./ChainSwitcher.module.css";

export type ChainLink = { slug: string; name: string; color: string; logo?: string };

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
          <ChainMark name={c.name} color={c.color} logo={c.logo} size={14} />
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
