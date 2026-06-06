import { Router, type IRouter, type Request, type Response } from "express";
import { getSetting } from "./settings";

const router: IRouter = Router();

const PROXY_TICKER = "RKLB";

interface CacheEntry<T> { data: T; expiresAt: number; }
const cache = new Map<string, CacheEntry<unknown>>();
function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e || Date.now() > e.expiresAt) return null;
  return e.data as T;
}
function setCache<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

interface OHLCPoint {
  date: string; label: string;
  open: number; high: number; low: number; close: number; volume: number;
}

interface YFChartResponse {
  chart: {
    result?: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

async function fetchYFChart(ticker: string, range: string, interval: string): Promise<OHLCPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}&includePrePost=false`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Yahoo Finance HTTP ${r.status}`);
  const json = await r.json() as YFChartResponse;
  if (json.chart.error || !json.chart.result?.[0]) throw new Error("No data from Yahoo Finance");

  const { timestamp, indicators } = json.chart.result[0];
  const q = indicators.quote[0];
  const points: OHLCPoint[] = [];

  for (let i = 0; i < timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i];
    if (o == null || h == null || l == null || c == null || c <= 0) continue;
    const d = new Date(timestamp[i] * 1000);
    points.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      open: parseFloat(o.toFixed(4)),
      high: parseFloat(h.toFixed(4)),
      low: parseFloat(l.toFixed(4)),
      close: parseFloat(c.toFixed(4)),
      volume: v ?? 0,
    });
  }
  return points;
}

function scalePoints(points: OHLCPoint[], platformPrice: number): OHLCPoint[] {
  if (!points.length) return points;
  const latestClose = points[points.length - 1].close;
  const scale = platformPrice / latestClose;
  return points.map((p, i) => ({
    ...p,
    open: parseFloat((p.open * scale).toFixed(2)),
    high: parseFloat((p.high * scale).toFixed(2)),
    low: parseFloat((p.low * scale).toFixed(2)),
    close: i === points.length - 1 ? platformPrice : parseFloat((p.close * scale).toFixed(2)),
  }));
}

router.get("/price/history", async (_req: Request, res: Response): Promise<void> => {
  const cached = getCached<{ points: OHLCPoint[] }>("history");
  if (cached) { res.json(cached); return; }

  try {
    const raw = await fetchYFChart(PROXY_TICKER, "1y", "1d");
    if (!raw.length) throw new Error("Empty response");

    const sharePriceSetting = await getSetting("share_price");
    const platformPrice = Number(sharePriceSetting ?? "130");
    const points = scalePoints(raw, platformPrice);

    const result = { points };
    setCache("history", result, 4 * 60 * 60 * 1000);
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: "Price history unavailable", detail: (err as Error).message });
  }
});

router.get("/price/quote", async (_req: Request, res: Response): Promise<void> => {
  const cached = getCached<{ price: number; prevClose: number; change: number; changePercent: number }>("quote");
  if (cached) { res.json(cached); return; }

  try {
    const raw = await fetchYFChart(PROXY_TICKER, "5d", "1d");
    if (!raw.length) throw new Error("Empty response");

    const sharePriceSetting = await getSetting("share_price");
    const platformPrice = Number(sharePriceSetting ?? "130");
    const scaled = scalePoints(raw, platformPrice);

    const price = platformPrice;
    const prevClose = scaled.length > 1 ? scaled[scaled.length - 2].close : platformPrice;
    const change = parseFloat((price - prevClose).toFixed(2));
    const changePercent = parseFloat(((change / prevClose) * 100).toFixed(2));

    const result = { price, prevClose, change, changePercent };
    setCache("quote", result, 60 * 1000);
    res.json(result);
  } catch (err) {
    const sharePriceSetting = await getSetting("share_price").catch(() => "130");
    const platformPrice = Number(sharePriceSetting ?? "130");
    res.json({ price: platformPrice, prevClose: platformPrice, change: 0, changePercent: 0 });
  }
});

export default router;
