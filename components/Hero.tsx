import { BrandField } from "./BrandField";
import styles from "./Hero.module.css";

/** Title area with the brand field behind it. Children render above the field. */
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section className={styles.hero}>
      <BrandField />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
