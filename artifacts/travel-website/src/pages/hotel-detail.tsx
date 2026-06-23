import { useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useMemo } from "react";
import { useSearchHotels } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Star, ArrowLeft, ChevronLeft, ChevronRight,
  Utensils, Calendar, Users, Award, ExternalLink, FileText,
} from "lucide-react";

const FALLBACK = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200";

function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = photos.length > 0 ? photos : [FALLBACK];
  const prev = () => setActive((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setActive((i) => (i === list.length - 1 ? 0 : i + 1));

  return (
    <div className="relative w-full">
      {/* Main image */}
      <div className="relative h-[50vh] md:h-[65vh] overflow-hidden rounded-none md:rounded-2xl bg-slate-200">
        <img
          key={active}
          src={list[active]}
          alt={`${name} — photo ${active + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-slate-800" />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white backdrop-blur rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
            >
              <ChevronRight className="w-5 h-5 text-slate-800" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {list.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === active ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                />
              ))}
            </div>
            <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur">
              {active + 1} / {list.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {list.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 px-4 md:px-0">
          {list.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === active ? "border-primary opacity-100" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HotelDetail() {
  const { id } = useParams();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const searchParams = useMemo(() => {
    const p = new URLSearchParams(searchString);
    const destinationId = p.get("destinationId") ? parseInt(p.get("destinationId")!) : undefined;
    const destination = p.get("destination") || undefined;
    const checkin = p.get("checkin") || undefined;
    const checkout = p.get("checkout") || undefined;
    const adults = p.get("adults") ? parseInt(p.get("adults")!) : undefined;
    const rooms = p.get("rooms") ? parseInt(p.get("rooms")!) : undefined;
    return { destinationId, destination, checkin, checkout, adults, rooms };
  }, [searchString]);

  const hasContext = !!searchParams.destinationId || !!searchParams.destination;

  const { data: searchResults, isLoading } = useSearchHotels(searchParams, {
    query: { enabled: hasContext },
  });

  const hotel = searchResults?.hotels?.find((h) => h.id === id);

  const nights = useMemo(() => {
    if (!searchParams.checkin || !searchParams.checkout) return undefined;
    const a = new Date(searchParams.checkin);
    const b = new Date(searchParams.checkout);
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    return diff > 0 ? diff : undefined;
  }, [searchParams.checkin, searchParams.checkout]);

  const backUrl = `/search?${searchString}`;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-screen pb-24">
        <Skeleton className="h-[55vh] w-full" />
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full mt-6" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-[380px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!hotel) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Award className="w-16 h-16 text-slate-300 mx-auto mb-6" />
        <h2 className="text-2xl font-serif text-slate-800 mb-3">Hôtel introuvable</h2>
        <p className="text-slate-500 mb-8">
          {hasContext
            ? "Cet hôtel n'est pas disponible pour les dates sélectionnées."
            : "Lancez une recherche pour accéder aux détails de l'hôtel."}
        </p>
        <Button onClick={() => setLocation("/search")}>Retour à la recherche</Button>
      </div>
    );
  }

  const photos = (hotel.photos as string[] | undefined) ?? (hotel.image ? [hotel.image] : []);
  const address = (hotel as any).address as string | undefined;

  // ── Format date helpers ───────────────────────────────────────────────────
  function fmtDate(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  // ── Board plan icon helpers ───────────────────────────────────────────────
  function boardIcon(name: string) {
    const n = name.toLowerCase();
    if (n.includes("all") || n.includes("inclusiv")) return "🍹";
    if (n.includes("pension")) return "🍽️";
    if (n.includes("demi")) return "🥗";
    if (n.includes("petit") || n.includes("déjeuner") || n.includes("dejeuner")) return "☕";
    return "🛏️";
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Back button — floating */}
      <div className="fixed top-20 left-4 z-40">
        <Button
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur border-slate-200 hover:bg-white shadow-md"
          onClick={() => setLocation(backUrl)}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Retour
        </Button>
      </div>

      {/* Photo gallery */}
      <PhotoGallery photos={photos} name={hotel.name} />

      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* ── LEFT / MAIN ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-10">

            {/* Hotel identity */}
            <section>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: hotel.stars ?? 0 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <h1 className="text-3xl md:text-4xl font-serif text-slate-900 mb-2">{hotel.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm mb-4">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {address || hotel.destination}
                </span>
                {hotel.rating != null && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Star className="w-4 h-4 fill-accent text-accent" />
                    {(hotel.rating * 20).toFixed(0)}/20
                    {hotel.reviewCount != null && (
                      <span className="font-normal text-slate-400">({hotel.reviewCount.toLocaleString()} avis)</span>
                    )}
                  </span>
                )}
              </div>
              {hotel.amenities && hotel.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a: string) => (
                    <Badge key={a} variant="secondary" className="bg-primary/8 text-primary font-medium">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {/* Description */}
            {hotel.description && (
              <section>
                <h2 className="text-xl font-serif text-slate-800 mb-3">À propos de l'établissement</h2>
                <p className="text-slate-600 leading-relaxed">{hotel.description}</p>
              </section>
            )}

            {/* Rooms / board plans table */}
            {hotel.rooms && hotel.rooms.length > 0 && (
              <section>
                <h2 className="text-xl font-serif text-slate-800 mb-4 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-primary" />
                  Formules disponibles
                  {nights && (
                    <span className="text-sm font-sans font-normal text-slate-400 ml-1">
                      — {nights} nuit{nights > 1 ? "s" : ""}
                    </span>
                  )}
                </h2>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                          Formule / Pension
                        </th>
                        <th className="text-right px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                          Prix total
                        </th>
                        <th className="hidden sm:table-cell text-right px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                          Par nuit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hotel.rooms.map((room, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 transition-colors ${idx === 0 ? "bg-primary/3" : ""}`}
                          data-testid={`room-row-${idx}`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xl" role="img" aria-label={room.boardName}>
                                {boardIcon(room.boardName)}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800">{room.boardName}</p>
                                {idx === 0 && (
                                  <p className="text-xs text-primary font-medium mt-0.5">✓ Meilleur prix</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <p className="text-lg font-bold text-primary">
                              {room.amount.toLocaleString("fr-DZ")} <span className="text-sm font-semibold">DA</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">taxes incluses</p>
                          </td>
                          <td className="hidden sm:table-cell px-5 py-4 text-right text-slate-500">
                            {nights
                              ? <>{Math.round(room.amount / nights).toLocaleString("fr-DZ")} <span className="text-xs">DA/nuit</span></>
                              : "—"
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2 px-1">
                  * Prix par chambre, {searchParams.adults ?? 2} adulte{(searchParams.adults ?? 2) > 1 ? "s" : ""}.
                  Commission incluse dans tous les tarifs.
                </p>
              </section>
            )}

            {/* Stay summary */}
            {(searchParams.checkin || searchParams.checkout) && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-serif text-slate-800 mb-4">Détails du séjour</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {searchParams.checkin && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Arrivée</p>
                        <p className="font-semibold text-slate-800 text-sm mt-0.5">{fmtDate(searchParams.checkin)}</p>
                      </div>
                    </div>
                  )}
                  {searchParams.checkout && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Départ</p>
                        <p className="font-semibold text-slate-800 text-sm mt-0.5">{fmtDate(searchParams.checkout)}</p>
                      </div>
                    </div>
                  )}
                  {nights && (
                    <div className="flex items-start gap-3">
                      <Award className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Durée</p>
                        <p className="font-semibold text-slate-800 text-sm mt-0.5">{nights} nuit{nights > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Voyageurs</p>
                      <p className="font-semibold text-slate-800 text-sm mt-0.5">
                        {searchParams.adults ?? 2} adulte{(searchParams.adults ?? 2) > 1 ? "s" : ""},{" "}
                        {searchParams.rooms ?? 1} chambre{(searchParams.rooms ?? 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT / BOOKING CARD ──────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-7 sticky top-24">

              {/* Hotel badge */}
              <div className="flex items-start gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xl">{hotel.stars >= 5 ? "🏆" : hotel.stars >= 4 ? "⭐" : "🏨"}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-serif font-medium text-slate-900 truncate">{hotel.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{address || hotel.destination}</p>
                </div>
              </div>

              {/* Best price */}
              <div className="mb-6">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">À partir de</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-serif text-primary" data-testid="text-detail-price">
                    {hotel.price.toLocaleString("fr-DZ")}
                  </p>
                  <span className="text-base font-semibold text-primary">DA</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {hotel.rooms?.[0]?.boardName ?? "Chambre standard"} — commission incluse
                </p>
              </div>

              {/* Rating pill */}
              {hotel.rating != null && (
                <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800">{(hotel.rating * 20).toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">/ 20</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {hotel.rating >= 0.9 ? "Exceptionnel" :
                       hotel.rating >= 0.8 ? "Très bien" :
                       hotel.rating >= 0.7 ? "Bien" : "Correct"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {hotel.reviewCount?.toLocaleString()} avis clients
                    </p>
                  </div>
                </div>
              )}

              {/* All board prices */}
              {hotel.rooms && hotel.rooms.length > 0 && (
                <div className="space-y-2 mb-6">
                  {hotel.rooms.map((room, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border transition-colors ${
                        idx === 0
                          ? "bg-primary/8 border-primary/20 text-primary"
                          : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span>{boardIcon(room.boardName)}</span>
                        <span className="truncate max-w-[140px]">{room.boardName}</span>
                      </span>
                      <span className="font-bold whitespace-nowrap ml-2">
                        {room.amount.toLocaleString("fr-DZ")} DA
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button size="lg" className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base" data-testid="btn-book-now">
                Réserver maintenant
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full h-11 mt-2 border-primary text-primary hover:bg-primary/5 font-semibold gap-2"
                onClick={() => setLocation(`/reservation/${id}?${searchString}`)}
                data-testid="btn-download-voucher"
              >
                <FileText className="w-4 h-4" />
                Télécharger le bon PDF
              </Button>
              <p className="text-center text-xs text-slate-400 mt-3">Aucun frais supplémentaire</p>

              {/* View on H24Voyages */}
              <a
                href={`https://www.h24voyages.com/fr/hotels/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-400 hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Voir sur H24Voyages
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
