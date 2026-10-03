import styles from "./ChainMark.module.css";

/** A chain's logo when one is committed under public/chains, otherwise a coloured dot. */
export function ChainMark({ name, color, logo, size = 16 }: { name: string; color: string; logo?: string; size?: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className={styles.logo} aria-hidden />;
  }
  return <span className={styles.dot} style={{ background: color, width: size * 0.6, height: size * 0.6 }} aria-hidden title={name} />;
}
