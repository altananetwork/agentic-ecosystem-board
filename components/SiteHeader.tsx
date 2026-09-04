import Link from "next/link";
import { SITE_NAME, TAGLINE } from "@/lib/site";
import { ChainSwitcher, type ChainLink } from "./ChainSwitcher";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ chains, active }: { chains: ChainLink[]; active?: string }) {
  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className={styles.title}>{SITE_NAME}</Link>
          <span className={styles.tagline}>{TAGLINE}</span>
        </div>
        <ChainSwitcher chains={chains} active={active} />
      </div>
    </header>
  );
}
