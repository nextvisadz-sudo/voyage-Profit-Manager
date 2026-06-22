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
  return Math.round(price * (1 + percent / 100));
}

interface RawRoom {
  boardName?: unknown;
  board_name?: unknown;
  pension?: unknown;
  libelle?: unknown;
  amount?: unknown;
  prix?: unknown;
  price?: unknown;
}

function parseRooms(raw: Record<string, unknown>, commissionPercent: number): Array<{ boardName: string; originalAmount: number; amount: number }> {
  const rawRooms = Array.isArray(raw.rooms)
    ? (raw.rooms as RawRoom[])
    : Array.isArray(raw.chambres)
    ? (raw.chambres as RawRoom[])
    : Array.isArray(raw.offres)
    ? (raw.offres as RawRoom[])
    : [];

  if (rawRooms.length > 0) {
    return rawRooms.map((room) => {
      const boardName = String(
        room.boardName ?? room.board_name ?? room.pension ?? room.libelle ?? "Standard"
      );
      const originalAmount = typeof room.amount === "number"
        ? room.amount
        : typeof room.prix === "number"
        ? room.prix
        : typeof room.price === "number"
        ? room.price
        : 0;
      return {
        boardName,
        originalAmount,
        amount: applyCommission(originalAmount, commissionPercent),
      };
    });
  }

  // Build a single-room entry from the hotel's top-level price
  const topAmount = typeof raw.amount === "number"
    ? raw.amount
    : typeof raw.prix_a_partir_de === "number"
    ? raw.prix_a_partir_de
    : typeof raw.prix === "number"
    ? raw.prix
    : 0;

  if (topAmount > 0) {
    const boardName = String(raw.formule ?? raw.pension ?? raw.mealPlan ?? "Logement simple");
    return [{
      boardName,
      originalAmount: topAmount,
      amount: applyCommission(topAmount, commissionPercent),
    }];
  }

  return [];
}

function parseH24Hotel(raw: Record<string, unknown>, commissionPercent: number, destination: string): Record<string, unknown> {
  // Raw price is already in DZD — no currency conversion
  const originalPrice = typeof raw.amount === "number"
    ? raw.amount
    : typeof raw.prix_a_partir_de === "number"
    ? raw.prix_a_partir_de
    : typeof raw.prix === "number"
    ? raw.prix
    : 0;

  const price = applyCommission(originalPrice, commissionPercent);

  const stars =
    typeof raw.categorie === "number"
      ? raw.categorie
      : typeof raw.nb_etoiles === "number"
      ? raw.nb_etoiles
      : typeof raw.stars === "number"
      ? raw.stars
      : 0;

  const rating =
    typeof raw.note_globale === "number"
      ? raw.note_globale
      : typeof raw.note === "number"
      ? raw.note
      : typeof raw.rating === "number"
      ? raw.rating
      : null;

  // Preserve original photo URL exactly as returned by the API
  const image =
    typeof raw.photo === "string" && raw.photo
      ? raw.photo
      : typeof raw.image === "string" && raw.image
      ? raw.image
      : typeof raw.img === "string" && raw.img
      ? raw.img
      : "";

  const amenities: string[] = [];
  if (raw.piscine) amenities.push("Piscine");
  if (raw.spa) amenities.push("Spa");
  if (raw.wifi || raw.internet) amenities.push("WiFi");
  if (raw.parking) amenities.push("Parking");
  if (raw.restaurant) amenities.push("Restaurant");
  if (raw.fitness || raw.gym) amenities.push("Fitness");
  if (raw.bar) amenities.push("Bar");
  if (raw.plage || raw.beach) amenities.push("Plage");
  if (raw.animation) amenities.push("Animation");
  if (raw.club_enfants || raw.kids_club) amenities.push("Club enfants");

  const rooms = parseRooms(raw, commissionPercent);

  return {
    id: String(raw.id_hotel ?? raw.id ?? raw.hotel_id ?? Math.random().toString(36).slice(2)),
    name: String(raw.nom_hotel ?? raw.nom ?? raw.name ?? raw.hotel_name ?? "Hôtel"),
    destination: String(raw.destination ?? raw.ville ?? raw.city ?? destination),
    stars,
    image,
    description: String(raw.description ?? raw.details ?? ""),
    originalPrice,
    price,
    currency: "DZD",
    rating: rating ?? undefined,
    reviewCount: typeof raw.nb_avis === "number" ? raw.nb_avis : undefined,
    amenities,
    roomType: String(raw.type_chambre ?? raw.chambre ?? rooms[0]?.boardName ?? "Chambre Standard"),
    mealPlan: String(raw.formule ?? raw.pension ?? rooms[0]?.boardName ?? ""),
    nights: typeof raw.nb_nuits === "number" ? raw.nb_nuits : undefined,
    rooms,
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
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Referer": "https://www.h24voyages.com/fr/hotels/recherche",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;

      // API can return { status: "error" } with 200 status code
      if (data.status === "error") {
        req.log.warn({ message: data.message }, "H24Voyages API returned error in body, using mock data");
        hotels = generateMockHotels(destination, commissionPercent, Number(limit));
      } else {
        const rawHotels: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
          ? data.results as Record<string, unknown>[]
          : Array.isArray(data.hotels)
          ? data.hotels as Record<string, unknown>[]
          : Array.isArray(data.data)
          ? data.data as Record<string, unknown>[]
          : [];

        if (rawHotels.length > 0) {
          req.log.info({ count: rawHotels.length }, "Parsed hotels from H24Voyages");
          hotels = rawHotels.map((h) => parseH24Hotel(h, commissionPercent, destination));
        } else {
          req.log.info({ sample: JSON.stringify(data).slice(0, 200) }, "H24Voyages returned empty results, using mock data");
          hotels = generateMockHotels(destination, commissionPercent, Number(limit));
        }
      }
    } else {
      req.log.warn({ status: response.status }, "H24Voyages API returned non-200, using mock data");
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
  const dest = destination || "Alger";

  // Prices are in DZD — realistic Algerian hotel rates
  const hotelTemplates = [
    {
      name: `Grand Palais ${dest}`,
      stars: 5,
      rooms: [
        { boardName: "Logement simple", originalAmount: 48000 },
        { boardName: "Petit Déjeuner", originalAmount: 54000 },
        { boardName: "Demi pension", originalAmount: 62000 },
        { boardName: "Pension complète", originalAmount: 74000 },
      ],
      rating: 4.8, reviews: 1240,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      description: `Hôtel de prestige situé en plein cœur de ${dest}, offrant des chambres luxueuses avec vue panoramique et des services haut de gamme.`,
    },
    {
      name: `Hôtel Le ${dest} Central`,
      stars: 4,
      rooms: [
        { boardName: "Logement simple", originalAmount: 27000 },
        { boardName: "Petit Déjeuner", originalAmount: 31000 },
        { boardName: "Demi pension", originalAmount: 38000 },
      ],
      rating: 4.5, reviews: 876,
      image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
      description: `Idéalement situé au centre de ${dest}, cet établissement propose des chambres confortables et modernes avec toutes les commodités.`,
    },
    {
      name: `${dest} Garden Resort`,
      stars: 5,
      rooms: [
        { boardName: "Logement simple", originalAmount: 68000 },
        { boardName: "Petit Déjeuner", originalAmount: 75000 },
        { boardName: "Demi pension", originalAmount: 88000 },
        { boardName: "All Inclusive", originalAmount: 105000 },
      ],
      rating: 4.9, reviews: 2100,
      image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      description: `Resort exceptionnel avec jardins tropicaux, piscines et spa de luxe. Une destination idéale pour un séjour inoubliable à ${dest}.`,
    },
    {
      name: `${dest} Boutique Suites`,
      stars: 4,
      rooms: [
        { boardName: "Logement simple", originalAmount: 32000 },
        { boardName: "Petit Déjeuner", originalAmount: 36500 },
        { boardName: "Demi pension", originalAmount: 44000 },
      ],
      rating: 4.6, reviews: 543,
      image: "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800",
      description: `Suites élégantes avec décoration contemporaine dans un cadre raffiné au cœur de ${dest}.`,
    },
    {
      name: `Premier Hôtel ${dest}`,
      stars: 3,
      rooms: [
        { boardName: "Logement simple", originalAmount: 14000 },
        { boardName: "Petit Déjeuner", originalAmount: 17000 },
      ],
      rating: 4.2, reviews: 3200,
      image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
      description: `Un hôtel confortable et bien situé, idéal pour les voyageurs souhaitant découvrir ${dest} à prix abordable.`,
    },
    {
      name: `${dest} Palace Hotel`,
      stars: 5,
      rooms: [
        { boardName: "Logement simple", originalAmount: 85000 },
        { boardName: "Petit Déjeuner", originalAmount: 93000 },
        { boardName: "Demi pension", originalAmount: 108000 },
        { boardName: "Pension complète", originalAmount: 122000 },
        { boardName: "All Inclusive", originalAmount: 145000 },
      ],
      rating: 4.7, reviews: 890,
      image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      description: `Le palace de référence à ${dest}, alliant architecture grandiose et service cinq étoiles pour une expérience royale.`,
    },
    {
      name: `The ${dest} Collection`,
      stars: 4,
      rooms: [
        { boardName: "Logement simple", originalAmount: 36000 },
        { boardName: "Petit Déjeuner", originalAmount: 41000 },
        { boardName: "Demi pension", originalAmount: 49000 },
      ],
      rating: 4.4, reviews: 650,
      image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
      description: `Collection d'hôtels design offrant une expérience unique mêlant art contemporain et confort moderne à ${dest}.`,
    },
    {
      name: `${dest} Riviera Spa`,
      stars: 4,
      rooms: [
        { boardName: "Logement simple", originalAmount: 30000 },
        { boardName: "Petit Déjeuner", originalAmount: 34000 },
        { boardName: "Demi pension", originalAmount: 42000 },
      ],
      rating: 4.6, reviews: 420,
      image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
      description: `Hôtel spa d'exception proposant des soins exclusifs et des installations bien-être premium face à la mer à ${dest}.`,
    },
    {
      name: `Holiday ${dest} Bay`,
      stars: 3,
      rooms: [
        { boardName: "Logement simple", originalAmount: 18000 },
        { boardName: "Petit Déjeuner", originalAmount: 21000 },
        { boardName: "Demi pension", originalAmount: 27000 },
      ],
      rating: 4.1, reviews: 1800,
      image: "https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=800",
      description: `Hôtel familial en bord de mer proposant des vacances agréables avec animations et piscines à ${dest}.`,
    },
    {
      name: `${dest} Luxury Retreat`,
      stars: 5,
      rooms: [
        { boardName: "Logement simple", originalAmount: 58000 },
        { boardName: "Petit Déjeuner", originalAmount: 65000 },
        { boardName: "Demi pension", originalAmount: 78000 },
        { boardName: "All Inclusive", originalAmount: 98000 },
      ],
      rating: 4.8, reviews: 980,
      image: "https://images.unsplash.com/photo-1549294413-26f195200c16?w=800",
      description: `Retraite de luxe nichée dans un cadre naturel exceptionnel, offrant intimité et raffinement absolu à ${dest}.`,
    },
  ];

  const amenitySets = [
    ["Piscine", "WiFi", "Spa", "Restaurant"],
    ["WiFi", "Bar", "Parking"],
    ["Piscine", "Fitness", "WiFi", "Restaurant", "Bar"],
    ["Plage", "Piscine", "Spa", "WiFi"],
    ["WiFi", "Parking", "Restaurant"],
  ];

  return hotelTemplates.slice(0, Math.min(count, hotelTemplates.length)).map((t, i) => {
    const rooms = t.rooms.map((r) => ({
      boardName: r.boardName,
      originalAmount: r.originalAmount,
      amount: applyCommission(r.originalAmount, commissionPercent),
    }));
    const lowestRoom = rooms[0];
    return {
      id: `mock-${i + 1}`,
      name: t.name,
      destination: dest,
      stars: t.stars,
      image: t.image,
      description: t.description,
      originalPrice: lowestRoom.originalAmount,
      price: lowestRoom.amount,
      currency: "DZD",
      rating: t.rating,
      reviewCount: t.reviews,
      amenities: amenitySets[i % amenitySets.length],
      roomType: rooms[0].boardName,
      mealPlan: rooms[0].boardName,
      nights: 7,
      rooms,
    };
  });
}

export default router;
