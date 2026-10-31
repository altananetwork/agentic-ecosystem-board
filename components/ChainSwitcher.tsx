"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChainMark } from "./ChainMark";
import styles from "./ChainSwitcher.module.css";

export type ChainLink = { slug: string; name: string; color: string; logo?: string };

/**
 * One control for the scope being viewed. Reads "All chains" on the overview and the chain
 * name on a chain page; opens a list of every published chain plus the overview.
 */
export function ChainSwitcher({ chains, active }: { chains: ChainLink[]; active?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = chains.find((c) => c.slug === active);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (chains.length === 0) return null;

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {current ? <ChainMark name={current.name} color={current.color} logo={current.logo} size={16} /> : null}
        <span>{current ? current.name : "All chains"}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={styles.caret}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Chains" className={styles.menu}>
          <Link href="/" role="menuitem" className={`${styles.item} ${current ? "" : styles.active}`} aria-current={current ? undefined : "page"} onClick={() => setOpen(false)}>
            <span className={styles.all} aria-hidden />
            All chains
          </Link>
          {chains.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              role="menuitem"
              className={`${styles.item} ${c.slug === active ? styles.active : ""}`}
              aria-current={c.slug === active ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <ChainMark name={c.name} color={c.color} logo={c.logo} size={16} />
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
