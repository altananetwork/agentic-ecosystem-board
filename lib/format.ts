/** Number formatting shared by the board. Locale is fixed to en-US so server and client agree. */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");
const usdFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 302k, 1.2M */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return compact.format(n);
}

/** 301,996 */
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return full.format(Math.round(n));
}

/** $11.8M */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return usdCompact.format(n);
}

/** $11,771,394 */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return usdFull.format(n);
}

const usdPrecise = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $715.02, for prices */
export function formatUsdPrecise(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return usdPrecise.format(n);
}

/** +$1.2M, -$340k, $0 */
export function formatSignedUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const sign = n > 0 ? "+" : "-";
  return `${sign}${usdCompact.format(Math.abs(n))}`;
}

/** 21.5% */
export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "0%";
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Token amounts: 3,412.5 BNB style, trimmed to a sensible precision. */
export function formatAmount(n: number, symbol: string): string {
  if (!Number.isFinite(n)) return `0 ${symbol}`;
  const digits = n >= 1000 ? 0 : n >= 1 ? 2 : 4;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n)} ${symbol}`;
}

/** "2 hours ago", "just now", "3 days ago". `now` is injectable for tests and hydration safety. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  const diff = Math.max(0, now.getTime() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

/** "4 Sep 2026, 04:12 UTC" */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/** "4 Sep" for chart axes; input YYYY-MM-DD */
export function formatDayShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
