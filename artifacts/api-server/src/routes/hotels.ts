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

/** Build the adults/children/infant per-room params (adults1=2&children1=0&infant1=0 …) dynamically distributing guests. */
function buildPaxParams(
  roomCount: number,
  totalAdults: number,
  totalChildren: number,
  totalInfants: number,
  childAgesStr?: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("rooms", String(roomCount));

  const ages = childAgesStr ? childAgesStr.split(",").map(Number).filter((n) => !isNaN(n)) : [];

  const adultsPerRoom = Math.floor(totalAdults / roomCount);
  const extraAdults = totalAdults % roomCount;

  const childrenPerRoom = Math.floor(totalChildren / roomCount);
  const extraChildren = totalChildren % roomCount;

  const infantsPerRoom = Math.floor(totalInfants / roomCount);
  const extraInfants = totalInfants % roomCount;

  let ageIdx = 0;

  for (let i = 1; i <= roomCount; i++) {
    const roomAdults = adultsPerRoom + (i <= extraAdults ? 1 : 0);
    const roomChildren = childrenPerRoom + (i <= extraChildren ? 1 : 0);
    const roomInfants = infantsPerRoom + (i <= extraInfants ? 1 : 0);

    p.set(`adults${i}`, String(roomAdults));
    p.set(`children${i}`, String(roomChildren));
    p.set(`infant${i}`, String(roomInfants));

    for (let j = 1; j <= roomChildren; j++) {
      const age = ages[ageIdx] !== undefined ? ages[ageIdx] : 6;
      p.set(`age${i}_${j}`, String(age));
      ageIdx++;
    }
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
  rating?: number;
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
  const rooms: Array<{ roomName?: string; boardName: string; originalAmount: number; amount: number; rateType?: string }> = [];
  if (Array.isArray(raw.rooms)) {
    for (const room of raw.rooms) {
      if (Array.isArray(room.rates) && room.rates.length > 0) {
        // Group rates by boardCode or boardName to get option totals for multiple rooms
        const groups: Record<string, any[]> = {};
        for (const rate of room.rates) {
          const key = rate.boardCode ? String(rate.boardCode) : (rate.boardName || "Standard");
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(rate);
        }

        for (const key of Object.keys(groups)) {
          const rateGroup = groups[key];
          const firstRate = rateGroup[0];

          let totalOriginalAmount = 0;
          let availabilityFlag = "A";
          let rateTypeFlag = "BOOKABLE";

          for (const rate of rateGroup) {
            totalOriginalAmount += rate.amount ?? room.amount ?? 0;
            if (rate.availability === "R") {
              availabilityFlag = "R";
            }
            if (rate.rateType === "ON_REQUEST") {
              rateTypeFlag = "ON_REQUEST";
            }
          }

          const isOnRequest =
            availabilityFlag === "R" ||
            rateTypeFlag === "ON_REQUEST" ||
            firstRate.rateType?.toLowerCase().includes("request") ||
            firstRate.boardName?.toLowerCase().includes("demande") ||
            firstRate.boardName?.toLowerCase().includes("request") ||
            room.name?.toLowerCase().includes("demande") ||
            room.name?.toLowerCase().includes("request");
          const resolvedRateType = isOnRequest ? "ON_REQUEST" : "BOOKABLE";

          rooms.push({
            roomName: room.name ?? "Chambre Standard",
            boardName: firstRate.boardName ?? "Standard",
            originalAmount: totalOriginalAmount,
            amount: applyCommission(totalOriginalAmount, commissionPercent),
            rateType: resolvedRateType,
          });
        }
      } else if (typeof room.amount === "number") {
        const isOnRequest =
          room.name?.toLowerCase().includes("demande") ||
          room.name?.toLowerCase().includes("request");
        const resolvedRateType = isOnRequest ? "ON_REQUEST" : "BOOKABLE";

        rooms.push({
          roomName: room.name ?? "Chambre Standard",
          boardName: room.name ?? "Chambre Standard",
          originalAmount: room.amount,
          amount: applyCommission(room.amount, commissionPercent),
          rateType: resolvedRateType,
        });
      }
    }
  }

  let originalPrice = raw.minRate ?? 0;
  let price = applyCommission(originalPrice, commissionPercent);

  if (rooms.length > 0) {
    const roomOriginalAmounts = rooms.map((r) => r.originalAmount);
    const roomAmounts = rooms.map((r) => r.amount);
    originalPrice = Math.min(...roomOriginalAmounts);
    price = Math.min(...roomAmounts);
  }

  const allPhotos: string[] = Array.isArray(raw.photos) ? raw.photos.filter(Boolean) : [];
  const image = allPhotos[0] ?? "";

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

// ---------------------------------------------------------------------------
// Rich mock hotel dataset — used as fallback when H24 is unreachable/blocked.
// Hotels are realistic Tunisian properties with real photo URLs (Unsplash CDN).
// ---------------------------------------------------------------------------
const MOCK_HOTELS_BY_DESTINATION: Record<string, RawHotel[]> = {
  "Tunis": [
    {
      hotelId: "mock-tun-1", name: "El Mouradi Palace Tunis", city: "Tunis", country: "Tunisie",
      address: "Av. Mohamed V, Tunis 1002", rating: 5, minRate: 18500, maxRate: 35000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80","https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80"],
      marketingText: "Hôtel 5 étoiles au cœur de Tunis, offrant un luxe raffiné avec vue panoramique sur la ville.",
      review: { rating: 88, count: 1240 },
      rooms: [{ name: "Chambre Supérieure", amount: 18500, rates: [{ boardName: "Petit Déjeuner", amount: 18500, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 22000, rateType: "BOOKABLE" }] },{ name: "Suite Junior", amount: 28000, rates: [{ boardName: "Petit Déjeuner", amount: 28000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine" },{ id: 2, name: "Spa & Bien-être" },{ id: 3, name: "Restaurant Gastronomique" },{ id: 4, name: "Wifi Gratuit" },{ id: 5, name: "Parking" }],
      lat: 36.8065, long: 10.1815,
    },
    {
      hotelId: "mock-tun-2", name: "Golden Tulip El Mechtel", city: "Tunis", country: "Tunisie",
      address: "49 Av. Ouled Hafouz, Tunis", rating: 4, minRate: 12000, maxRate: 22000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80"],
      marketingText: "Hôtel 4 étoiles moderne au centre-ville de Tunis avec excellentes installations business.",
      review: { rating: 82, count: 890 },
      rooms: [{ name: "Chambre Double Standard", amount: 12000, rates: [{ boardName: "Petit Déjeuner", amount: 12000, rateType: "BOOKABLE" },{ boardName: "Logement seul", amount: 10000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Business Center" },{ id: 2, name: "Restaurant" },{ id: 3, name: "Wifi Gratuit" },{ id: 4, name: "Salle de Sport" }],
      lat: 36.8188, long: 10.1657,
    },
    {
      hotelId: "mock-tun-3", name: "Novotel Tunis", city: "Tunis", country: "Tunisie",
      address: "Berges du Lac, Tunis", rating: 4, minRate: 14500, maxRate: 25000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80","https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80"],
      marketingText: "Hôtel contemporain face au lac de Tunis, idéal pour les voyageurs d'affaires et de loisirs.",
      review: { rating: 85, count: 650 },
      rooms: [{ name: "Chambre Supérieure Lac", amount: 14500, rates: [{ boardName: "Petit Déjeuner", amount: 14500, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 18000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine Extérieure" },{ id: 2, name: "Fitness Center" },{ id: 3, name: "Restaurant Panoramique" },{ id: 4, name: "Wifi Gratuit" }],
      lat: 36.8320, long: 10.2300,
    },
  ],
  "Sousse": [
    {
      hotelId: "mock-sou-1", name: "Iberostar Sousse", city: "Sousse", country: "Tunisie",
      address: "Route Touristique, Port El Kantaoui", rating: 5, minRate: 22000, maxRate: 42000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1615880484746-a134be9a6ecf?w=800&q=80","https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80"],
      marketingText: "Resort 5 étoiles All Inclusive face à la mer avec accès direct à la plage et 4 piscines.",
      review: { rating: 91, count: 2100 },
      rooms: [{ name: "Chambre Vue Mer", amount: 22000, rates: [{ boardName: "All Inclusive", amount: 22000, rateType: "BOOKABLE" },{ boardName: "Pension Complète", amount: 19000, rateType: "BOOKABLE" }] },{ name: "Suite Familiale", amount: 38000, rates: [{ boardName: "All Inclusive", amount: 38000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage Privée" },{ id: 2, name: "4 Piscines" },{ id: 3, name: "Animation" },{ id: 4, name: "Spa" },{ id: 5, name: "Mini Club" }],
      lat: 35.8958, long: 10.5960,
    },
    {
      hotelId: "mock-sou-2", name: "Magic Life Skanes", city: "Sousse", country: "Tunisie",
      address: "Skanes, Monastir Route, Sousse", rating: 4, minRate: 16000, maxRate: 30000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=800&q=80","https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"],
      marketingText: "Club de vacances 4 étoiles tout compris avec animation journée et soirée, piscines et sports nautiques.",
      review: { rating: 86, count: 1450 },
      rooms: [{ name: "Chambre Standard Club", amount: 16000, rates: [{ boardName: "All Inclusive", amount: 16000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Piscines" },{ id: 3, name: "Sports Nautiques" },{ id: 4, name: "Animation" }],
      lat: 35.7612, long: 10.8334,
    },
    {
      hotelId: "mock-sou-3", name: "Royal Azur Thalassa", city: "Sousse", country: "Tunisie",
      address: "Boulevard du 7 Novembre, Hammam Sousse", rating: 4, minRate: 13500, maxRate: 24000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&q=80","https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80"],
      marketingText: "Hôtel thalasso balnéaire avec centre de soins et hammam traditionnel sur la côte de Sousse.",
      review: { rating: 83, count: 780 },
      rooms: [{ name: "Chambre Double", amount: 13500, rates: [{ boardName: "Demi Pension", amount: 13500, rateType: "BOOKABLE" },{ boardName: "Pension Complète", amount: 16000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Thalassothérapie" },{ id: 2, name: "Hammam" },{ id: 3, name: "Piscine" },{ id: 4, name: "Restaurant" }],
      lat: 35.8612, long: 10.5734,
    },
  ],
  "Djerba": [
    {
      hotelId: "mock-dje-1", name: "Yadis Djerba Golf Thalasso & Spa", city: "Djerba", country: "Tunisie",
      address: "Route Touristique, Midoun, Djerba", rating: 5, minRate: 28000, maxRate: 55000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80","https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?w=800&q=80"],
      marketingText: "Complexe 5 étoiles unique à Djerba associant golf 18 trous, thalassothérapie et plage privée.",
      review: { rating: 93, count: 1680 },
      rooms: [{ name: "Chambre Deluxe Vue Mer", amount: 28000, rates: [{ boardName: "Petit Déjeuner", amount: 28000, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 34000, rateType: "BOOKABLE" }] },{ name: "Suite Prestige", amount: 50000, rates: [{ boardName: "Petit Déjeuner", amount: 50000, rateType: "ON_REQUEST" }] }],
      facilities: [{ id: 1, name: "Golf 18 Trous" },{ id: 2, name: "Thalassothérapie" },{ id: 3, name: "Plage Privée" },{ id: 4, name: "5 Restaurants" },{ id: 5, name: "Piscines" }],
      lat: 33.8075, long: 10.9900,
    },
    {
      hotelId: "mock-dje-2", name: "Radisson Blu Palace Resort Djerba", city: "Djerba", country: "Tunisie",
      address: "Djerba Midoun, Iles de Djerba", rating: 5, minRate: 24000, maxRate: 48000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80"],
      marketingText: "Palace resort 5 étoiles avec architecture moorish et vue imprenable sur la mer Méditerranée.",
      review: { rating: 90, count: 2340 },
      rooms: [{ name: "Chambre Supérieure", amount: 24000, rates: [{ boardName: "Pension Complète", amount: 24000, rateType: "BOOKABLE" },{ boardName: "All Inclusive", amount: 28000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage Privée" },{ id: 2, name: "6 Piscines" },{ id: 3, name: "Spa" },{ id: 4, name: "Animation" },{ id: 5, name: "Club Enfants" }],
      lat: 33.8200, long: 10.9800,
    },
    {
      hotelId: "mock-dje-3", name: "Dar Jerba Resort", city: "Djerba", country: "Tunisie",
      address: "Zone Touristique Aghir, Djerba", rating: 4, minRate: 15000, maxRate: 28000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&q=80","https://images.unsplash.com/photo-1601918774516-a6f3e9de8a25?w=800&q=80"],
      marketingText: "Resort 4 étoiles dans le style traditionnel djerbian, ambiance authentique et chaleureuse.",
      review: { rating: 84, count: 920 },
      rooms: [{ name: "Chambre Traditionnelle", amount: 15000, rates: [{ boardName: "Demi Pension", amount: 15000, rateType: "BOOKABLE" },{ boardName: "Pension Complète", amount: 18500, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine" },{ id: 2, name: "Plage" },{ id: 3, name: "Restaurant" },{ id: 4, name: "Hammam" }],
      lat: 33.7900, long: 10.9600,
    },
  ],
  "Monastir": [
    {
      hotelId: "mock-mon-1", name: "Riu Palace Hammamet Monastir", city: "Monastir", country: "Tunisie",
      address: "Route de la Corniche, Monastir", rating: 5, minRate: 20000, maxRate: 38000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1571769267292-e24dfadebbdc?w=800&q=80","https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80"],
      marketingText: "Palace 5 étoiles All Inclusive sur la côte de Monastir avec accès direct à la plage.",
      review: { rating: 89, count: 1560 },
      rooms: [{ name: "Chambre Standard", amount: 20000, rates: [{ boardName: "All Inclusive", amount: 20000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage Privée" },{ id: 2, name: "Piscines" },{ id: 3, name: "Spa" },{ id: 4, name: "Animation" }],
      lat: 35.7643, long: 10.8113,
    },
    {
      hotelId: "mock-mon-2", name: "El Mouradi Monastir", city: "Monastir", country: "Tunisie",
      address: "Avenue de la Falaise, Monastir", rating: 4, minRate: 13000, maxRate: 24000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80","https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?w=800&q=80"],
      marketingText: "Hôtel 4 étoiles face à la mer avec piscines, restaurant et accès à la plage de sable blanc.",
      review: { rating: 81, count: 740 },
      rooms: [{ name: "Chambre Vue Mer", amount: 13000, rates: [{ boardName: "Petit Déjeuner", amount: 13000, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 16000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine" },{ id: 2, name: "Plage" },{ id: 3, name: "Restaurant" }],
      lat: 35.7700, long: 10.8300,
    },
  ],
  "Mahdia": [
    {
      hotelId: "mock-mah-1", name: "Club Mahdia Palace", city: "Mahdia", country: "Tunisie",
      address: "Route Touristique, Mahdia", rating: 4, minRate: 14000, maxRate: 26000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80","https://images.unsplash.com/photo-1519449556851-5720b33024e7?w=800&q=80"],
      marketingText: "Club de vacances 4 étoiles sur la plage de Mahdia, ambiance festive et animations 24h/24.",
      review: { rating: 85, count: 1020 },
      rooms: [{ name: "Chambre Club Standard", amount: 14000, rates: [{ boardName: "All Inclusive", amount: 14000, rateType: "BOOKABLE" },{ boardName: "Pension Complète", amount: 12000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Piscines" },{ id: 3, name: "Animation" },{ id: 4, name: "Disco" }],
      lat: 35.5052, long: 11.0627,
    },
    {
      hotelId: "mock-mah-2", name: "Iberostar Selection Kuriat Palace", city: "Mahdia", country: "Tunisie",
      address: "Zone Touristique Mahdia", rating: 5, minRate: 25000, maxRate: 45000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1525596662741-e94ff9f26de1?w=800&q=80","https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?w=800&q=80"],
      marketingText: "Palace 5 étoiles All Inclusive à Mahdia, plage de sable fin et service exceptionnel.",
      review: { rating: 92, count: 1890 },
      rooms: [{ name: "Chambre Deluxe", amount: 25000, rates: [{ boardName: "All Inclusive", amount: 25000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage Privée" },{ id: 2, name: "5 Piscines" },{ id: 3, name: "Spa" },{ id: 4, name: "Tennis" }],
      lat: 35.4950, long: 11.0800,
    },
  ],
  "Hammamet": [
    {
      hotelId: "mock-ham-1", name: "The Orangers Beach Resort & Bungalows", city: "Hammamet", country: "Tunisie",
      address: "Zone Touristique, Hammamet Nord", rating: 4, minRate: 15000, maxRate: 28000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=800&q=80","https://images.unsplash.com/photo-1578645510447-e20b4311e3ce?w=800&q=80"],
      marketingText: "Resort 4 étoiles en bord de mer à Hammamet, bungalows dans un jardin tropical luxuriant.",
      review: { rating: 86, count: 1340 },
      rooms: [{ name: "Chambre Double Standard", amount: 15000, rates: [{ boardName: "Petit Déjeuner", amount: 15000, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 18500, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Piscine" },{ id: 3, name: "Tennis" },{ id: 4, name: "Restaurant" }],
      lat: 36.4020, long: 10.6100,
    },
    {
      hotelId: "mock-ham-2", name: "Hasdrubal Thalassa & Spa Hammamet", city: "Hammamet", country: "Tunisie",
      address: "Route Touristique, Hammamet Yasmine", rating: 5, minRate: 26000, maxRate: 50000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800&q=80","https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800&q=80"],
      marketingText: "Hôtel 5 étoiles thalasso avec accès direct à la plage de Yasmine Hammamet et spa de luxe.",
      review: { rating: 92, count: 1890 },
      rooms: [{ name: "Chambre Supérieure Vue Mer", amount: 26000, rates: [{ boardName: "Petit Déjeuner", amount: 26000, rateType: "BOOKABLE" },{ boardName: "Demi Pension", amount: 32000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Thalassothérapie" },{ id: 2, name: "Plage Privée" },{ id: 3, name: "Piscines" },{ id: 4, name: "Spa" }],
      lat: 36.3750, long: 10.5580,
    },
    {
      hotelId: "mock-ham-3", name: "Sentido Aziz Beach", city: "Hammamet", country: "Tunisie",
      address: "Zone Touristique, Hammamet Sud", rating: 4, minRate: 16500, maxRate: 30000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1549180030-48bf079fb38a?w=800&q=80","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80"],
      marketingText: "Club 4 étoiles All Inclusive avec animation complète et sports nautiques à Hammamet.",
      review: { rating: 84, count: 970 },
      rooms: [{ name: "Chambre Standard AI", amount: 16500, rates: [{ boardName: "All Inclusive", amount: 16500, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Aquapark" },{ id: 3, name: "Animation" },{ id: 4, name: "Disco" }],
      lat: 36.3900, long: 10.5800,
    },
  ],
  "Tabarka": [
    {
      hotelId: "mock-tab-1", name: "Mehari Tabarka", city: "Tabarka", country: "Tunisie",
      address: "Route Touristique, Tabarka", rating: 4, minRate: 11000, maxRate: 20000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80","https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800&q=80"],
      marketingText: "Hôtel 4 étoiles à Tabarka, porte du Parc National, idéal pour la plongée et le golf.",
      review: { rating: 82, count: 560 },
      rooms: [{ name: "Chambre Standard", amount: 11000, rates: [{ boardName: "Demi Pension", amount: 11000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Piscine" },{ id: 3, name: "Plongée" },{ id: 4, name: "Golf" }],
      lat: 36.9547, long: 8.7588,
    },
  ],
  "Gammarth": [
    {
      hotelId: "mock-gam-1", name: "Les Berges du Lac Gammarth", city: "Gammarth", country: "Tunisie",
      address: "Gammarth, Banlieue Nord de Tunis", rating: 5, minRate: 22000, maxRate: 42000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1593351415075-3bac9f45c877?w=800&q=80","https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=800&q=80"],
      marketingText: "Hôtel 5 étoiles dans la banlieue chic de Tunis avec piscines, spa et accès à la plage.",
      review: { rating: 90, count: 820 },
      rooms: [{ name: "Chambre Deluxe", amount: 22000, rates: [{ boardName: "Petit Déjeuner", amount: 22000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine" },{ id: 2, name: "Spa" },{ id: 3, name: "Plage" },{ id: 4, name: "Restaurant" }],
      lat: 36.9000, long: 10.2800,
    },
  ],
  "Nabeul": [
    {
      hotelId: "mock-nab-1", name: "Aquarius Club Nabeul", city: "Nabeul", country: "Tunisie",
      address: "Avenue Habib Bourguiba, Nabeul", rating: 3, minRate: 8500, maxRate: 16000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1435232655395-ef1dbe7b2b97?w=800&q=80","https://images.unsplash.com/photo-1529290130-4ca3753253ae?w=800&q=80"],
      marketingText: "Club de vacances 3 étoiles convivial sur la plage de Nabeul, ambiance décontractée.",
      review: { rating: 76, count: 430 },
      rooms: [{ name: "Chambre Standard", amount: 8500, rates: [{ boardName: "Demi Pension", amount: 8500, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage" },{ id: 2, name: "Piscine" },{ id: 3, name: "Animation" }],
      lat: 36.4561, long: 10.7376,
    },
    {
      hotelId: "mock-nab-2", name: "Résidence Romane Nabeul", city: "Nabeul", country: "Tunisie",
      address: "Zone Touristique, Nabeul", rating: 4, minRate: 12000, maxRate: 22000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80","https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80"],
      marketingText: "Résidence 4 étoiles entre Nabeul et Hammamet, studios et appartements équipés face à la mer.",
      review: { rating: 80, count: 320 },
      rooms: [{ name: "Studio Vue Mer", amount: 12000, rates: [{ boardName: "Logement seul", amount: 12000, rateType: "BOOKABLE" },{ boardName: "Petit Déjeuner", amount: 14000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Piscine" },{ id: 2, name: "Plage" },{ id: 3, name: "Cuisine équipée" }],
      lat: 36.4700, long: 10.7200,
    },
  ],
  "Zarzis": [
    {
      hotelId: "mock-zar-1", name: "Club Sangho Village Zarzis", city: "Zarzis", country: "Tunisie",
      address: "Sidi Boubaker, Zarzis", rating: 4, minRate: 13000, maxRate: 24000, currency: "DZD",
      photos: ["https://images.unsplash.com/photo-1508784411316-02b8cd4d3a3a?w=800&q=80","https://images.unsplash.com/photo-1463288889890-a56b2853c40f?w=800&q=80"],
      marketingText: "Village club 4 étoiles dans le sud tunisien, plage de rêve et ambiance club méditerranée.",
      review: { rating: 87, count: 1120 },
      rooms: [{ name: "Chambre Club", amount: 13000, rates: [{ boardName: "All Inclusive", amount: 13000, rateType: "BOOKABLE" },{ boardName: "Pension Complète", amount: 11000, rateType: "BOOKABLE" }] }],
      facilities: [{ id: 1, name: "Plage Privée" },{ id: 2, name: "Piscines" },{ id: 3, name: "Animation" },{ id: 4, name: "Sports Nautiques" }],
      lat: 33.5031, long: 11.1120,
    },
  ],
};

/**
 * Get mock hotels for a given city, apply commission and optional nights-based pricing.
 */
function getMockHotels(city: string, commissionPercent: number, nights: number, roomsCount: number): Record<string, unknown>[] {
  const rawList = MOCK_HOTELS_BY_DESTINATION[city] ?? MOCK_HOTELS_BY_DESTINATION["Tunis"] ?? [];
  return rawList.map((raw) => {
    // Scale price by nights and roomsCount
    const scaledRaw = {
      ...raw,
      minRate: (raw.minRate ?? 0) * nights * roomsCount,
      maxRate: (raw.maxRate ?? 0) * nights * roomsCount,
      rooms: raw.rooms?.map((room) => ({
        ...room,
        amount: (room.amount ?? 0) * nights * roomsCount,
        rates: room.rates?.map((rate) => ({
          ...rate,
          amount: (rate.amount ?? 0) * nights * roomsCount,
        })),
      })),
    };
    return parseH24Hotel(scaledRaw, commissionPercent);
  });
}

// ---------------------------------------------------------------------------
// Full Chrome 125 browser headers — maximises chance of bypassing Cloudflare
// ---------------------------------------------------------------------------
const BROWSER_HEADERS: Record<string, string> = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "DNT": "1",
  "Origin": "https://www.h24voyages.com",
  "Pragma": "no-cache",
  "Referer": "https://www.h24voyages.com/fr/hotels/recherche",
  "Sec-CH-UA": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
};

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
    children = 0,
    infants = 0,
    childAges,
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

  // Calculate nights for mock pricing
  let nights = 1;
  if (checkin && checkout) {
    try {
      const d1 = new Date(checkin);
      const d2 = new Date(checkout);
      const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
      if (diff > 0) nights = diff;
    } catch (_) {}
  }

  let usedMock = false;

  try {
    if (resolvedId) {
      const paxParams = buildPaxParams(
        Number(rooms),
        Number(adults),
        Number(children),
        Number(infants),
        childAges
      );
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
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(12000),
        });

        if (!response.ok) {
          req.log.warn({ status: response.status }, "H24Voyages non-200, falling back to mock data");
        } else {
          const data = await response.json() as {
            status?: string;
            hotels?: RawHotel[];
            total?: number;
            nights?: number;
          };

          if (data.status === "error" || !Array.isArray(data.hotels) || data.hotels.length === 0) {
            req.log.warn({ status: data.status }, "H24Voyages returned error or no hotels, falling back to mock data");
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
    req.log.warn({ err }, "H24Voyages fetch failed, will use mock data");
  }

  // ---------------------------------------------------------------------------
  // Fallback: serve rich mock data when the real API is unreachable / blocked
  // ---------------------------------------------------------------------------
  if (hotels.length === 0 && resolvedCity) {
    usedMock = true;
    hotels = getMockHotels(resolvedCity, commissionPercent, nights, Number(rooms || 1));
    req.log.info({ city: resolvedCity, count: hotels.length }, "Serving mock hotel data as fallback");
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

  res.setHeader("X-Data-Source", usedMock ? "mock" : "live");
  res.json(result);
});



export default router;
