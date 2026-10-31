"use client";

import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "system" | "light" | "dark";
const KEY = "theme";
const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "Follow system",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * System, light or dark. "System" leaves the choice to prefers-color-scheme, so the page
 * follows the OS live. The chosen value persists in localStorage and is applied before
 * hydration by the inline script in the root layout.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {}
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <div className={styles.group} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          className={`${styles.btn} ${theme === o.value ? styles.active : ""}`}
          onClick={() => choose(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
