import { formatInt, formatPercent } from "@/lib/format";
import styles from "./Donut.module.css";

type Slice = { project: string; agents: number; share: number };

/** Accent first, then a muted categorical set that reads in light and dark. Other is neutral. */
const PALETTE = ["var(--accent)", "#e2622e", "#f2cb45", "#5aa89b", "#b08bd9", "#7c8fe0"];

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a0 = from * 2 * Math.PI - Math.PI / 2;
  const a1 = to * 2 * Math.PI - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Donut of the top projects: up to six named slices plus Other, legend on the right. */
export function Donut({ projects, label }: { projects: Slice[]; label: string }) {
  const named = projects.filter((p) => p.project !== "Other").slice(0, 6);
  const otherFromPayload = projects.find((p) => p.project === "Other");
  const beyond = projects.filter((p) => p.project !== "Other").slice(6).reduce((s, p) => s + p.agents, 0);
  const otherAgents = (otherFromPayload?.agents ?? 0) + beyond;
  const total = named.reduce((s, p) => s + p.agents, 0) + otherAgents;
  const slices = [...named.map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }))];
  if (otherAgents > 0) slices.push({ project: "Other", agents: otherAgents, share: 0, color: "var(--text-tertiary)" });

  const R = 54;
  const C = 70;
  let acc = 0;
  const paths = slices.map((s) => {
    const frac = total > 0 ? s.agents / total : 0;
    const from = acc;
    acc += frac;
    // A full circle cannot be drawn as one arc; nudge the end.
    const to = frac >= 0.9999 ? from + 0.9999 : acc;
    return { ...s, frac, d: frac > 0 ? arc(C, C, R, from, to) : "" };
  });

  const desc = paths.map((p) => `${p.project} ${formatPercent(p.frac)}`).join(", ");

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 140 140" className={styles.svg} role="img" aria-label={label}>
        <title>{label}</title>
        <desc>{desc}</desc>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--bg-inset)" strokeWidth="22" />
        {paths.map((p) =>
          p.d ? <path key={p.project} d={p.d} fill="none" stroke={p.color} strokeWidth="22" className={styles.slice} /> : null,
        )}
      </svg>
      <ul className={styles.legend}>
        {paths.map((p) => (
          <li key={p.project} className={styles.item} title={`${formatInt(p.agents)} agents`}>
            <span className={styles.swatch} style={{ background: p.color }} aria-hidden />
            <span className={styles.name}>{p.project}</span>
            <span className={styles.pct}>{formatPercent(p.frac)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
