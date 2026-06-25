import { Router, type IRouter } from "express";
import { db, commissionConfigTable, searchStatsTable } from "@workspace/db";
import { SearchHotelsQueryParams, SearchHotelsResponse } from "@workspace/api-zod";
import { DESTINATIONS } from "./destinations";
import { requireAuth } from "../lib/auth-service";
import { mockCommission, mockStats } from "./commission";


const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Simple in-memory response cache for H24Voyages API (5-min TTL)
// ---------------------------------------------------------------------------
interface CacheEntry { data: unknown; expiresAt: number }
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { responseCache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: unknown): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function getCommissionPercent(): Promise<number> {
  if (!db) return mockCommission.percent;
  try {
    const rows = await db.select().from(commissionConfigTable).limit(1);
    return rows[0]?.percent ?? 10;
  } catch (err) {
    console.error("Failed to query commission from database:", err);
    return mockCommission.percent;
  }
}

async function getOrCreateStats() {
  if (!db) return mockStats;
  try {
    const rows = await db.select().from(searchStatsTable).limit(1);
    if (rows.length === 0) {
      const [stats] = await db.insert(searchStatsTable).values({}).returning();
      return stats;
    }
    return rows[0];
  } catch (err) {
    console.error("Failed to get/create stats from database:", err);
    return mockStats;
  }
}


/** Apply commission on top of raw DZD amount — no currency conversion. */
function applyCommission(amount: number, percent: number): number {
  return Math.round(amount * (1 + percent / 100));
}

/** Convert YYYY-MM-DD → DD/MM/YYYY as H24Voyages expects. */
function toH24Date(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Build the adults/children/infant per-room params (adults1=2&children1=0&infant1=0 …). */
function buildPaxParams(roomCount: number, adultsPerRoom: number): URLSearchParams {
  const p = new URLSearchParams();
  p.set("rooms", String(roomCount));
  for (let i = 1; i <= roomCount; i++) {
    p.set(`adults${i}`, String(adultsPerRoom));
    p.set(`children${i}`, "0");
    p.set(`infant${i}`, "0");
  }
  return p;
}

interface RawRate {
  boardCode?: number;
  boardName?: string;
  amount?: number;
  rateType?: string;
}

interface RawRoom {
  index?: number;
  code?: number | string;
  name?: string;
  amount?: number;
  rates?: RawRate[];
}

interface RawReview {
  rating?: number;
  count?: number;
}

interface RawHotel {
  hotelId?: string | number;
  name?: string;
  city?: string;
  country?: string;
  address?: string;
  rating?: number;          // star rating 1-5
  score?: string | number;
  minRate?: number;
  maxRate?: number;
  currency?: string;
  photos?: string[];
  marketingText?: string;
  review?: RawReview;
  rooms?: RawRoom[];
  themes?: Array<{ id: number; name: string }>;
  facilities?: Array<{ id: number; name: string }>;
  lat?: number;
  long?: number;
}

function parseH24Hotel(raw: RawHotel, commissionPercent: number): Record<string, unknown> {
  // Prices are already in DZD — apply commission only
  const originalPrice = raw.minRate ?? 0;
  const price = applyCommission(originalPrice, commissionPercent);

  // Build rooms array from the real API rooms[].rates[].boardName structure
  const rooms: Array<{ roomName?: string; boardName: string; originalAmount: number; amount: number; rateType?: string }> = [];
  if (Array.isArray(raw.rooms)) {
    for (const room of raw.rooms) {
      if (Array.isArray(room.rates) && room.rates.length > 0) {
        // Each rate = a board type variant for this room type
        for (const rate of room.rates) {
          const rawAmt = rate.amount ?? room.amount ?? 0;
          rooms.push({
            roomName: room.name ?? "Chambre Standard",
            boardName: rate.boardName ?? "Standard",
            originalAmount: rawAmt,
            amount: applyCommission(rawAmt, commissionPercent),
            rateType: rate.rateType ?? "BOOKABLE",
          });
        }
      } else if (typeof room.amount === "number") {
        rooms.push({
          roomName: room.name ?? "Chambre Standard",
          boardName: room.name ?? "Chambre Standard",
          originalAmount: room.amount,
          amount: applyCommission(room.amount, commissionPercent),
          rateType: "BOOKABLE",
        });
      }
    }
  }

  // Preserve all photos; first one is the primary image
  const allPhotos: string[] = Array.isArray(raw.photos) ? raw.photos.filter(Boolean) : [];
  const image = allPhotos[0] ?? "";

  // Amenities from themes when facilities is empty
  const amenities: string[] = [];
  if (Array.isArray(raw.facilities) && raw.facilities.length > 0) {
    raw.facilities.slice(0, 8).forEach((f) => amenities.push(f.name));
  } else if (Array.isArray(raw.themes) && raw.themes.length > 0) {
    raw.themes.slice(0, 5).forEach((t) => amenities.push(t.name));
  }

  return {
    id: String(raw.hotelId ?? Math.random().toString(36).slice(2)),
    name: raw.name ?? "Hôtel",
    destination: raw.city ?? "",
    address: raw.address ?? "",
    stars: raw.rating ?? 0,
    image,
    photos: allPhotos,
    description: raw.marketingText ?? "",
    originalPrice,
    price,
    currency: raw.currency ?? "DZD",
    rating: raw.review?.rating != null ? Number(raw.review.rating) / 20 : undefined,
    reviewCount: raw.review?.count != null ? Number(raw.review.count) : undefined,
    amenities,
    roomType: rooms[0]?.boardName ?? "Chambre Standard",
    mealPlan: rooms[0]?.boardName ?? "",
    nights: undefined,
    rooms: rooms,
    lat: raw.lat,
    long: raw.long,
    isStopSales: !rooms || rooms.length === 0 || raw.minRate === 0,
    restrictions: raw.themes?.filter(t => t.name.toLowerCase().includes("celib") || t.name.toLowerCase().includes("couple")).map(t => t.name) ?? [],
    marketingBadges: raw.themes?.slice(0, 2).map(t => t.name) ?? [],
  };
}

router.get("/hotels/search", requireAuth, async (req, res): Promise<void> => {
  const parsed = SearchHotelsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters", message: parsed.error.message });
    return;
  }

  const {
    destinationId,
    destination = "",
    checkin,
    checkout,
    adults = 2,
    rooms = 1,
  } = parsed.data;

  const commissionPercent = await getCommissionPercent();
  let hotels: ReturnType<typeof parseH24Hotel>[] = [];

  // Resolve destination ID: prefer explicit destinationId, else fuzzy-match by name
  let resolvedId = destinationId;
  let resolvedCity = destination;

  if (!resolvedId && destination) {
    const match = DESTINATIONS.find(
      (d) => d.city.toLowerCase() === destination.toLowerCase() ||
             d.label.toLowerCase().includes(destination.toLowerCase())
    );
    if (match) {
      resolvedId = match.id;
      resolvedCity = match.city;
    }
  } else if (resolvedId) {
    const match = DESTINATIONS.find((d) => d.id === resolvedId);
    if (match) resolvedCity = match.city;
  }

  try {
    if (resolvedId) {
      const paxParams = buildPaxParams(Number(rooms), Number(adults));
      paxParams.set("destinationId", String(resolvedId));
      if (checkin) paxParams.set("arrDate", toH24Date(checkin));
      if (checkout) paxParams.set("depDate", toH24Date(checkout));

      const url = `https://www.h24voyages.com/fr/hotels/api/Search/?${paxParams.toString()}`;
      const cacheKey = url;

      const cachedRaw = getCached(cacheKey) as { hotels?: RawHotel[] } | null;
      if (cachedRaw?.hotels && cachedRaw.hotels.length > 0) {
        req.log.info({ count: cachedRaw.hotels.length }, "H24Voyages hotels served from cache");
        hotels = cachedRaw.hotels.map((h) => parseH24Hotel(h, commissionPercent));
      } else {
        req.log.info({ url }, "Fetching hotels from H24Voyages");

        const response = await fetch(url, {
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://www.h24voyages.com/fr/hotels/recherche",
          },
          signal: AbortSignal.timeout(12000),
        });

        if (!response.ok) {
          req.log.warn({ status: response.status }, "H24Voyages non-200, returning empty search");
        } else {
          const data = await response.json() as {
            status?: string;
            hotels?: RawHotel[];
            total?: number;
            nights?: number;
          };

          if (data.status === "error" || !Array.isArray(data.hotels) || data.hotels.length === 0) {
            req.log.warn({ status: data.status }, "H24Voyages returned error or no hotels");
          } else {
            req.log.info({ count: data.hotels.length, nights: data.nights }, "H24Voyages hotels fetched");
            setCache(cacheKey, data);
            hotels = data.hotels.map((h) => parseH24Hotel(h, commissionPercent));
          }
        }
      }
    } else {
      req.log.warn("No destinationId resolved for search query");
    }
  } catch (err) {
    req.log.warn({ err }, "H24Voyages fetch failed");
  }

  if (db) {
    try {
      const stats = await getOrCreateStats();
      await db.update(searchStatsTable).set({
        totalSearches: (stats.totalSearches ?? 0) + 1,
        totalHotelsServed: (stats.totalHotelsServed ?? 0) + hotels.length,
        lastSearchAt: new Date(),
      });
    } catch (err) {
      console.error("Failed to update database search stats:", err);
    }
  } else {
    mockStats.totalSearches += 1;
    mockStats.totalHotelsServed += hotels.length;
    mockStats.lastSearchAt = new Date();
  }

  const result = SearchHotelsResponse.parse({
    hotels,
    total: hotels.length,
    page: 1,
    limit: hotels.length,
    commissionPercent,
    destination: resolvedCity || destination || undefined,
    checkin: checkin || undefined,
    checkout: checkout || undefined,
  });

  res.json(result);
});



export default router;
