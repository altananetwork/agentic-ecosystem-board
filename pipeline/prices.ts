import type { FetchLike } from "./scan";

const COINGECKO_IDS: Record<string, string> = { BNB: "binancecoin", ETH: "ethereum", CELO: "celo", MATIC: "matic-network", POL: "polygon-ecosystem-token", AVAX: "avalanche-2" };

/** Symbol like "BNBUSDT" -> base asset "BNB". */
export function baseAsset(priceSymbol: string): string {
  return priceSymbol.replace(/(USDT|USDC|USD|BUSD)$/i, "").toUpperCase();
}

export async function nativePriceUsd(priceSymbol: string, fetchImpl: FetchLike = fetch): Promise<number> {
  const errors: string[] = [];
  try {
    const res = await fetchImpl(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(priceSymbol)}`);
    if (res.ok) {
      const body = (await res.json()) as { price?: string };
      const p = Number(body.price);
      if (Number.isFinite(p) && p > 0) return p;
      errors.push(`binance: unusable price "${body.price}"`);
    } else errors.push(`binance: HTTP ${res.status}`);
  } catch (e) {
    errors.push(`binance: ${(e as Error).message}`);
  }
  const id = COINGECKO_IDS[baseAsset(priceSymbol)];
  if (id) {
    try {
      const res = await fetchImpl(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      if (res.ok) {
        const body = (await res.json()) as Record<string, { usd?: number }>;
        const p = Number(body[id]?.usd);
        if (Number.isFinite(p) && p > 0) return p;
        errors.push(`coingecko: unusable price`);
      } else errors.push(`coingecko: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`coingecko: ${(e as Error).message}`);
    }
  } else errors.push(`coingecko: no id mapping for ${priceSymbol}`);
  throw new Error(`Could not price ${priceSymbol}: ${errors.join("; ")}`);
}
