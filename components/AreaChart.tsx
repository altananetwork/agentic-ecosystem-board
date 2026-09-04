import { formatDayShort, formatUsd, formatUsdCompact } from "@/lib/format";
import styles from "./Charts.module.css";

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

/** Single-series USD history. Falls back to a single value while history builds up. */
export function AreaChart({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  if (data.length === 0) {
    return <div className={styles.single}><div className={styles.note}>No history yet.</div></div>;
  }
  if (data.length < 2) {
    return (
      <div className={styles.single}>
        <div className={styles.n} title={formatUsd(data[0].value)}>{formatUsdCompact(data[0].value)}</div>
        <div className={styles.note}>{formatDayShort(data[0].date)}. History builds up daily.</div>
      </div>
    );
  }
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = data.map((d) => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  const span = rawMax - rawMin || rawMax || 1;
  const max = rawMax + span * 0.15;
  const min = Math.max(0, rawMin - span * 0.15);
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <div>
      <div className={styles.body}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${label}. From ${formatUsd(first.value)} on ${first.date} to ${formatUsd(last.value)} on ${last.date}.`}
        >
          <title>{label}</title>
          <desc>Line of daily values across {data.length} days.</desc>
          {ticks.map((t) => (
            <g key={t}>
              <line className={styles.gridLine} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className={styles.axisText} x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{formatUsdCompact(t)}</text>
            </g>
          ))}
          <path className={styles.area} d={area} />
          <path className={styles.line} d={path} />
          {data.map((d, i) => (
            <g key={d.date}>
              <circle className={styles.point} cx={x(i)} cy={y(d.value)} r={3}>
                <title>{`${formatDayShort(d.date)}: ${formatUsd(d.value)}`}</title>
              </circle>
              {i % labelEvery === 0 || i === data.length - 1 ? (
                <text className={styles.axisText} x={x(i)} y={H - 8} textAnchor="middle">{formatDayShort(d.date)}</text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <div className={styles.caption}>
        <span>Now {formatUsdCompact(last.value)}</span>
        <span>{formatDayShort(first.date)} to {formatDayShort(last.date)}</span>
      </div>
    </div>
  );
}
