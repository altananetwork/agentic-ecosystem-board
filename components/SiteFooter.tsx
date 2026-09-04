import { REPO_URL } from "@/lib/site";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <span className={styles.credit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/contributors/altana.svg" alt="" width={16} height={16} />
          Contributors: <a href="https://altana.network" target="_blank" rel="noreferrer">Altana</a>
        </span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">Open source, MIT</a>
        <span>Data: The Graph, 8004scan and on-chain reads</span>
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
          Add a chain or a project rule by pull request
        </a>
      </div>
    </footer>
  );
}
