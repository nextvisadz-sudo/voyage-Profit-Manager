import { Router, type IRouter } from "express";
import { db, commissionConfigTable, searchStatsTable } from "@workspace/db";
import { SearchHotelsQueryParams, SearchHotelsResponse } from "@workspace/api-zod";

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

function applyCommission(price: number, percent: number): number {
  return Math.round(price * (1 + percent / 100) * 100) / 100;
}

function parseH24Hotel(raw: Record<string, unknown>, commissionPercent: number, destination: string): Record<string, unknown> {
  const rawPrice = typeof raw.prix_a_partir_de === "number"
    ? raw.prix_a_partir_de
    : typeof raw.prix === "number"
    ? raw.prix
    : 0;

  const originalPrice = rawPrice;
  const price = applyCommission(originalPrice, commissionPercent);

  const stars =
    typeof raw.categorie === "number"
      ? raw.categorie
      : typeof raw.nb_etoiles === "number"
      ? raw.nb_etoiles
      : 0;

  const rating =
    typeof raw.note_globale === "number"
      ? raw.note_globale
      : typeof raw.note === "number"
      ? raw.note
      : null;

  const image =
    typeof raw.photo === "string" && raw.photo
      ? raw.photo
      : typeof raw.image === "string"
      ? raw.image
      : "";

  const amenities: string[] = [];
  if (raw.piscine) amenities.push("Pool");
  if (raw.spa) amenities.push("Spa");
  if (raw.wifi || raw.internet) amenities.push("WiFi");
  if (raw.parking) amenities.push("Parking");
  if (raw.restaurant) amenities.push("Restaurant");
  if (raw.fitness || raw.gym) amenities.push("Fitness Center");
  if (raw.bar) amenities.push("Bar");
  if (raw.beach) amenities.push("Beach Access");

  return {
    id: String(raw.id_hotel ?? raw.id ?? Math.random().toString(36).slice(2)),
    name: String(raw.nom_hotel ?? raw.nom ?? raw.name ?? "Hotel"),
    destination: String(raw.destination ?? raw.ville ?? destination),
    stars,
    image,
    description: String(raw.description ?? ""),
    originalPrice,
    price,
    currency: String(raw.devise ?? raw.currency ?? "EUR"),
    rating: rating ?? undefined,
    reviewCount: typeof raw.nb_avis === "number" ? raw.nb_avis : undefined,
    amenities,
    roomType: String(raw.type_chambre ?? raw.chambre ?? "Standard Room"),
    mealPlan: String(raw.formule ?? raw.pension ?? ""),
    nights: typeof raw.nb_nuits === "number" ? raw.nb_nuits : undefined,
  };
}

router.get("/hotels/search", async (req, res): Promise<void> => {
  const parsed = SearchHotelsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters", message: parsed.error.message });
    return;
  }

  const { destination = "", checkin, checkout, adults = 2, rooms = 1, page = 1, limit = 20 } = parsed.data;
  const commissionPercent = await getCommissionPercent();

  let hotels: ReturnType<typeof parseH24Hotel>[] = [];

  try {
    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (checkin) params.set("date_aller", checkin);
    if (checkout) params.set("date_retour", checkout);
    if (adults) params.set("nb_adultes", String(adults));
    if (rooms) params.set("nb_chambres", String(rooms));
    params.set("page", String(page));
    params.set("limit", String(limit));

    const url = `https://www.h24voyages.com/fr/hotels/api/Search/?${params.toString()}`;
    req.log.info({ url }, "Fetching hotels from H24Voyages");

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "NextVisaTravel/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;

      const rawHotels: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results as Record<string, unknown>[]
        : Array.isArray(data.hotels)
        ? data.hotels as Record<string, unknown>[]
        : Array.isArray(data.data)
        ? data.data as Record<string, unknown>[]
        : [];

      hotels = rawHotels.map((h) => parseH24Hotel(h, commissionPercent, destination));
    } else {
      req.log.warn({ status: response.status }, "H24Voyages API returned non-200");
      hotels = generateMockHotels(destination, commissionPercent, Number(limit));
    }
  } catch (err) {
    req.log.warn({ err }, "Failed to fetch from H24Voyages, using mock data");
    hotels = generateMockHotels(destination, commissionPercent, Number(limit));
  }

  const stats = await getOrCreateStats();
  await db.update(searchStatsTable)
    .set({
      totalSearches: (stats.totalSearches ?? 0) + 1,
      totalHotelsServed: (stats.totalHotelsServed ?? 0) + hotels.length,
      lastSearchAt: new Date(),
    });

  const result = SearchHotelsResponse.parse({
    hotels,
    total: hotels.length,
    page: Number(page),
    limit: Number(limit),
    commissionPercent,
    destination: destination || undefined,
    checkin: checkin || undefined,
    checkout: checkout || undefined,
  });

  res.json(result);
});

function generateMockHotels(destination: string, commissionPercent: number, count: number) {
  const dest = destination || "Paris";
  const hotelTemplates = [
    { name: `Grand Palais ${dest}`, stars: 5, basePrice: 320, rating: 4.8, reviews: 1240 },
    { name: `Hotel Le ${dest} Central`, stars: 4, basePrice: 180, rating: 4.5, reviews: 876 },
    { name: `Boutique ${dest} Suites`, stars: 4, basePrice: 210, rating: 4.6, reviews: 543 },
    { name: `${dest} Garden Resort`, stars: 5, basePrice: 450, rating: 4.9, reviews: 2100 },
    { name: `Premier Inn ${dest}`, stars: 3, basePrice: 95, rating: 4.2, reviews: 3200 },
    { name: `${dest} Palace Hotel`, stars: 5, basePrice: 580, rating: 4.7, reviews: 890 },
    { name: `The ${dest} Collection`, stars: 4, basePrice: 240, rating: 4.4, reviews: 650 },
    { name: `${dest} Riviera Spa`, stars: 4, basePrice: 195, rating: 4.6, reviews: 420 },
    { name: `Holiday ${dest} Bay`, stars: 3, basePrice: 120, rating: 4.1, reviews: 1800 },
    { name: `${dest} Luxury Retreat`, stars: 5, basePrice: 390, rating: 4.8, reviews: 980 },
  ];

  const images = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
    "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
    "https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=800",
    "https://images.unsplash.com/photo-1549294413-26f195200c16?w=800",
  ];

  const allAmenities = [["Pool", "WiFi", "Spa", "Restaurant"], ["WiFi", "Bar", "Parking"], ["Pool", "Fitness Center", "WiFi", "Restaurant", "Bar"], ["Beach Access", "Pool", "Spa", "WiFi"], ["WiFi", "Parking", "Restaurant"]];

  return hotelTemplates.slice(0, Math.min(count, hotelTemplates.length)).map((t, i) => ({
    id: `mock-${i + 1}`,
    name: t.name,
    destination: dest,
    stars: t.stars,
    image: images[i % images.length],
    description: `Experience the finest accommodation at ${t.name}. Located in the heart of ${dest}, this exceptional property offers world-class amenities and unparalleled service.`,
    originalPrice: t.basePrice,
    price: applyCommission(t.basePrice, commissionPercent),
    currency: "EUR",
    rating: t.rating,
    reviewCount: t.reviews,
    amenities: allAmenities[i % allAmenities.length],
    roomType: t.stars >= 5 ? "Deluxe Suite" : t.stars >= 4 ? "Superior Room" : "Standard Room",
    mealPlan: ["Breakfast Included", "Half Board", "All Inclusive", "Room Only", "Breakfast Included"][i % 5],
    nights: 7,
  }));
}

export default router;
