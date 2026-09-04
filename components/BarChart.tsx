import { formatCompact, formatDayShort, formatInt } from "@/lib/format";
import styles from "./Charts.module.css";

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Daily bars. One accent series, muted gridlines, compact axis labels, full values in titles. */
export function BarChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  if (data.length === 0) {
    return <div className={styles.single}><div className={styles.note}>No daily data yet.</div></div>;
  }
  const max = niceMax(Math.max(...data.map((d) => d.count)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(2, slot * 0.68);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const total = data.reduce((a, d) => a + d.count, 0);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      <div className={styles.body}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${label}. ${formatInt(total)} in total across ${data.length} days.`}
        >
          <title>{label}</title>
          <desc>
            Bars for each day from {data[0].date} to {data[data.length - 1].date}. Highest day: {formatInt(Math.max(...data.map((d) => d.count)))}.
          </desc>
          {ticks.map((t) => {
            const y = PAD.top + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line className={styles.gridLine} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
                <text className={styles.axisText} x={PAD.left - 6} y={y + 4} textAnchor="end">{formatCompact(t)}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = (d.count / max) * innerH;
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const y = PAD.top + innerH - h;
            return (
              <g key={d.date}>
                <rect className={styles.bar} x={x} y={y} width={barW} height={h} rx={2}>
                  <title>{`${formatDayShort(d.date)}: ${formatInt(d.count)}`}</title>
                </rect>
                {i % labelEvery === 0 ? (
                  <text className={styles.axisText} x={x + barW / 2} y={H - 8} textAnchor="middle">{formatDayShort(d.date)}</text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className={styles.caption}>
        <span>{formatInt(total)} new agents over {data.length} days</span>
        <span>{formatDayShort(data[0].date)} to {formatDayShort(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
