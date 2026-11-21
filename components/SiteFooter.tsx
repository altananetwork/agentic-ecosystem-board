import Link from "next/link";
import { REPO_URL } from "@/lib/site";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <span className={styles.credit}>
          Contributors
          <a href="https://altana.network" target="_blank" rel="noreferrer" className={styles.logo} aria-label="Altana">
            {/* Lockup for light grounds; the white one takes over in dark mode. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/contributors/altana-logo-dark.svg" alt="Altana" height={18} className={styles.onLight} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/contributors/altana-logo-white.svg" alt="Altana" height={18} className={styles.onDark} />
          </a>
        </span>
        <Link href="/methodology">How this is measured</Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer">Open source, MIT</a>
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer" className={styles.cta}>
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Add a chain or a project rule
        </a>
      </div>
    </footer>
  );
}
