import styles from "./InfoTip.module.css";

/**
 * A small "i" control that reveals a definition on hover, focus or tap.
 * CSS only, so it renders on the server and needs no client bundle.
 */
export function InfoTip({ id, text }: { id: string; text: string }) {
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label="What this measures" aria-describedby={id}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <span role="tooltip" id={id} className={styles.tip}>{text}</span>
    </span>
  );
}
