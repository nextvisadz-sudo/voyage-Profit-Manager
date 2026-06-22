import { Router, type IRouter } from "express";
import { db, commissionConfigTable, searchStatsTable } from "@workspace/db";
import { SearchHotelsQueryParams, SearchHotelsResponse } from "@workspace/api-zod";
import { DESTINATIONS } from "./destinations";

const router: IRouter = Router();

async function getCommissionPercent(): Promise<number> {
  const rows = await db.select().from(commissionConfigTable).limit(1);
  return rows[0]?.percent ?? 10;
}

async function getOrCreateStats() {
  const rows = await db.select().from(searchStatsTable).limit(1);
  if (rows.length === 0) {
    const [stats] = await db.insert(searchStatsTable).values({}).returning();
    return stats;
  }
  return rows[0];
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
  const rooms: Array<{ boardName: string; originalAmount: number; amount: number }> = [];
  if (Array.isArray(raw.rooms)) {
    for (const room of raw.rooms) {
      if (Array.isArray(room.rates) && room.rates.length > 0) {
        // Each rate = a board type variant for this room type
        for (const rate of room.rates) {
          const rawAmt = rate.amount ?? room.amount ?? 0;
          rooms.push({
            boardName: rate.boardName ?? "Standard",
            originalAmount: rawAmt,
            amount: applyCommission(rawAmt, commissionPercent),
          });
        }
      } else if (typeof room.amount === "number") {
        rooms.push({
          boardName: room.name ?? "Chambre Standard",
          originalAmount: room.amount,
          amount: applyCommission(room.amount, commissionPercent),
        });
      }
    }
  }

  // Deduplicate by boardName (keep lowest originalAmount per board type)
  const seen = new Map<string, { boardName: string; originalAmount: number; amount: number }>();
  for (const r of rooms) {
    const existing = seen.get(r.boardName);
    if (!existing || r.originalAmount < existing.originalAmount) {
      seen.set(r.boardName, r);
    }
  }
  const dedupedRooms = Array.from(seen.values());

  // Use first photo from the real photos array
  const image = (Array.isArray(raw.photos) && raw.photos[0]) ? raw.photos[0] : "";

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
    stars: raw.rating ?? 0,
    image,
    description: raw.marketingText ?? (raw.address ? `${raw.name} — ${raw.address}` : ""),
    originalPrice,
    price,
    currency: raw.currency ?? "DZD",
    rating: raw.review?.rating != null ? raw.review.rating / 20 : undefined, // convert 0-20 → 0-5 if needed
    reviewCount: raw.review?.count ?? undefined,
    amenities,
    roomType: dedupedRooms[0]?.boardName ?? "Chambre Standard",
    mealPlan: dedupedRooms[0]?.boardName ?? "",
    nights: undefined,
    rooms: dedupedRooms,
  };
}

router.get("/hotels/search", async (req, res): Promise<void> => {
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
    if (!resolvedId) {
      throw new Error("No destinationId resolved — falling back to mock data");
    }

    const paxParams = buildPaxParams(Number(rooms), Number(adults));
    paxParams.set("destinationId", String(resolvedId));
    if (checkin) paxParams.set("arrDate", toH24Date(checkin));
    if (checkout) paxParams.set("depDate", toH24Date(checkout));

    const url = `https://www.h24voyages.com/fr/hotels/api/Search/?${paxParams.toString()}`;
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
      req.log.warn({ status: response.status }, "H24Voyages non-200, using mock data");
      hotels = generateMockHotels(resolvedCity, commissionPercent);
    } else {
      const data = await response.json() as {
        status?: string;
        hotels?: RawHotel[];
        total?: number;
        nights?: number;
      };

      if (data.status === "error" || !Array.isArray(data.hotels) || data.hotels.length === 0) {
        req.log.warn({ status: data.status }, "H24Voyages returned no hotels, using mock data");
        hotels = generateMockHotels(resolvedCity, commissionPercent);
      } else {
        req.log.info({ count: data.hotels.length, nights: data.nights }, "H24Voyages hotels fetched");
        hotels = data.hotels.map((h) => parseH24Hotel(h, commissionPercent));
      }
    }
  } catch (err) {
    req.log.warn({ err }, "H24Voyages fetch failed, using mock data");
    hotels = generateMockHotels(resolvedCity || destination, commissionPercent);
  }

  const stats = await getOrCreateStats();
  await db.update(searchStatsTable).set({
    totalSearches: (stats.totalSearches ?? 0) + 1,
    totalHotelsServed: (stats.totalHotelsServed ?? 0) + hotels.length,
    lastSearchAt: new Date(),
  });

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

// ---------------------------------------------------------------------------
// Mock fallback — DZD prices, rooms array matching real API structure
// ---------------------------------------------------------------------------
function generateMockHotels(destination: string, commissionPercent: number) {
  const dest = destination || "Tunis";
  const templates = [
    {
      name: `Grand Palais ${dest}`, stars: 5, minRate: 48000, rating: 4.8, reviews: 1240,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 48000 },
        { boardName: "Petit Déjeuner", originalAmount: 54000 },
        { boardName: "Demi pension", originalAmount: 62000 },
        { boardName: "Pension complète", originalAmount: 74000 },
      ],
    },
    {
      name: `Hôtel ${dest} Central`, stars: 4, minRate: 27000, rating: 4.5, reviews: 876,
      image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 27000 },
        { boardName: "Petit Déjeuner", originalAmount: 31000 },
        { boardName: "Demi pension", originalAmount: 38000 },
      ],
    },
    {
      name: `${dest} Garden Resort`, stars: 5, minRate: 68000, rating: 4.9, reviews: 2100,
      image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 68000 },
        { boardName: "Petit Déjeuner", originalAmount: 75000 },
        { boardName: "Demi pension", originalAmount: 88000 },
        { boardName: "All Inclusive", originalAmount: 105000 },
      ],
    },
    {
      name: `${dest} Boutique Suites`, stars: 4, minRate: 32000, rating: 4.6, reviews: 543,
      image: "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 32000 },
        { boardName: "Petit Déjeuner", originalAmount: 36500 },
        { boardName: "Demi pension", originalAmount: 44000 },
      ],
    },
    {
      name: `Premier Hôtel ${dest}`, stars: 3, minRate: 14000, rating: 4.2, reviews: 3200,
      image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 14000 },
        { boardName: "Petit Déjeuner", originalAmount: 17000 },
      ],
    },
    {
      name: `${dest} Palace Hotel`, stars: 5, minRate: 85000, rating: 4.7, reviews: 890,
      image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 85000 },
        { boardName: "Petit Déjeuner", originalAmount: 93000 },
        { boardName: "Demi pension", originalAmount: 108000 },
        { boardName: "Pension complète", originalAmount: 122000 },
        { boardName: "All Inclusive", originalAmount: 145000 },
      ],
    },
    {
      name: `${dest} Riviera Spa`, stars: 4, minRate: 30000, rating: 4.6, reviews: 420,
      image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 30000 },
        { boardName: "Petit Déjeuner", originalAmount: 34000 },
        { boardName: "Demi pension", originalAmount: 42000 },
      ],
    },
    {
      name: `Holiday ${dest} Bay`, stars: 3, minRate: 18000, rating: 4.1, reviews: 1800,
      image: "https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 18000 },
        { boardName: "Petit Déjeuner", originalAmount: 21000 },
        { boardName: "Demi pension", originalAmount: 27000 },
      ],
    },
    {
      name: `${dest} Luxury Retreat`, stars: 5, minRate: 58000, rating: 4.8, reviews: 980,
      image: "https://images.unsplash.com/photo-1549294413-26f195200c16?w=800",
      rooms: [
        { boardName: "Logement simple", originalAmount: 58000 },
        { boardName: "Petit Déjeuner", originalAmount: 65000 },
        { boardName: "Demi pension", originalAmount: 78000 },
        { boardName: "All Inclusive", originalAmount: 98000 },
      ],
    },
  ];

  return templates.map((t, i) => {
    const rooms = t.rooms.map((r) => ({
      boardName: r.boardName,
      originalAmount: r.originalAmount,
      amount: applyCommission(r.originalAmount, commissionPercent),
    }));
    return {
      id: `mock-${i + 1}`,
      name: t.name,
      destination: dest,
      stars: t.stars,
      image: t.image,
      description: `${t.name} — ${dest}`,
      originalPrice: t.minRate,
      price: applyCommission(t.minRate, commissionPercent),
      currency: "DZD",
      rating: t.rating,
      reviewCount: t.reviews,
      amenities: [] as string[],
      roomType: rooms[0].boardName,
      mealPlan: rooms[0].boardName,
      nights: undefined,
      rooms,
    };
  });
}

export default router;
