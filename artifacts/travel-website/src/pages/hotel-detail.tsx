import { useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useMemo } from "react";
import { useSearchHotels } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { HotelMap } from "@/components/hotel-map";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Star, ArrowLeft, ChevronLeft, ChevronRight,
  Utensils, Calendar, Users, Award, ExternalLink, FileText, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const FALLBACK = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200";

function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = photos.length > 0 ? photos : [FALLBACK];
  const prev = () => setActive((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setActive((i) => (i === list.length - 1 ? 0 : i + 1));

  return (
    <div className="relative w-full max-w-5xl mx-auto px-4 mt-6">
      {/* Main image */}
      <div className="relative h-[280px] sm:h-[400px] md:h-[480px] overflow-hidden rounded-xl md:rounded-2xl bg-slate-200 shadow-md border border-slate-100">
        <img
          key={active}
          src={list[active]}
          alt={`${name} — photo ${active + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300 rounded-xl md:rounded-2xl"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none rounded-xl md:rounded-2xl" />

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
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 rounded-lg">
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
                className="w-full h-full object-cover rounded-md"
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
  const { user } = useAuth();
  const { toast } = useToast();

  const [bookingRoomIdx, setBookingRoomIdx] = useState<number | null>(null);
  const [passengerNames, setPassengerNames] = useState<string[]>([]);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

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
    query: { enabled: hasContext } as any,
  });

  const hotel = searchResults?.hotels?.find((h) => h.id === id);

  const startBooking = (roomIdx: number) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Connexion requise",
        description: "Veuillez vous connecter pour effectuer une réservation.",
      });
      setLocation("/login");
      return;
    }
    const passengerCount = searchParams.adults || 2;
    setPassengerNames(Array(passengerCount).fill(""));
    setBookingRoomIdx(roomIdx);
  };

  const handleCreateBooking = async () => {
    if (bookingRoomIdx === null || !hotel) return;
    const selectedRoom = hotel.rooms?.[bookingRoomIdx];
    if (!selectedRoom) return;

    const emptyNameIdx = passengerNames.findIndex(name => !name.trim());
    if (emptyNameIdx !== -1) {
      toast({
        variant: "destructive",
        title: "Noms requis",
        description: `Veuillez renseigner le nom du voyageur ${emptyNameIdx + 1}.`,
      });
      return;
    }

    setIsCreatingBooking(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hotelName: hotel.name,
          destination: hotel.destination,
          checkin: searchParams.checkin,
          checkout: searchParams.checkout,
          nights: nights || 1,
          adults: searchParams.adults || 2,
          children: 0,
          guests: passengerNames.map(name => name.trim()),
          roomCategory: selectedRoom.roomName || "Chambre Standard",
          boardType: selectedRoom.boardName,
          price: selectedRoom.originalAmount,
          markedUpPrice: selectedRoom.amount
        })
      });

      if (!response.ok) {
        throw new Error("Impossible de créer la réservation.");
      }

      const data = await response.json();
      toast({
        title: "Réservation créée",
        description: `La réservation ${data.booking.reference} a été enregistrée avec succès.`,
      });
      setBookingRoomIdx(null);
      setLocation(`/reservation/${data.booking.reference}`);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err.message || "Une erreur est survenue lors de la réservation.",
      });
    } finally {
      setIsCreatingBooking(false);
    }
  };

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
  const isStop = hotel.isStopSales || !hotel.rooms || hotel.rooms.length === 0;

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

              {/* Marketing badges & restrictions */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {isStop && (
                  <Badge className="bg-[#d63031] hover:bg-[#d63031] text-white font-bold text-xs py-1 px-3 rounded-md">
                    Stop Sales / Complet
                  </Badge>
                )}
                {hotel.marketingBadges?.map((badge) => (
                  <Badge key={badge} className="bg-accent hover:bg-accent text-accent-foreground font-bold text-xs py-1 px-3 rounded-md">
                    {badge}
                  </Badge>
                ))}
                {hotel.restrictions?.map((restriction) => {
                  const isCelib = /c[eé]lib/i.test(restriction);
                  if (isCelib) {
                    return (
                      <span 
                        key={restriction} 
                        style={{ backgroundColor: "#d63031", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", display: "inline-block" }}
                      >
                        ⚠ {restriction}
                      </span>
                    );
                  }
                  return (
                    <Badge key={restriction} className="bg-orange-600 hover:bg-orange-600 text-white font-bold text-xs py-1 px-3 rounded-md animate-pulse">
                      ⚠ {restriction}
                    </Badge>
                  );
                })}
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

            {/* Description & Emplacement */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <h2 className="text-xl font-serif text-slate-800 mb-2">Emplacement & Description</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider mb-2">Situation</h3>
                    {hotel.description && /c[eé]lib/i.test(hotel.description) ? (
                      <div className="mb-4">
                        <span 
                          style={{ backgroundColor: "#d63031", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "14px", display: "inline-block" }}
                        >
                          ⚠ {hotel.description}
                        </span>
                      </div>
                    ) : (
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {hotel.description || "Cet établissement de premier choix vous offre un cadre luxueux et raffiné pour un séjour inoubliable."}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2 text-xs text-slate-500 font-medium">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{address || hotel.destination}</span>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider mb-3">Points forts</h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-primary text-base font-bold">✓</span>
                        <span className="font-medium text-slate-700">Très bien situé ({hotel.destination})</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-primary text-base font-bold">✓</span>
                        <span className="font-medium text-slate-700">Propreté étincelante</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-primary text-base font-bold">✓</span>
                        <span className="font-medium text-slate-700">Service client d'excellence</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-primary text-base font-bold">✓</span>
                        <span className="font-medium text-slate-700">Rapport qualité-prix imbattable</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="w-full">
                  <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider mb-3">Carte</h3>
                  <HotelMap lat={hotel.lat} long={hotel.long} hotelName={hotel.name} />
                </div>
              </div>
            </section>

            {/* Tarifs & Disponibilités Room Grid */}
            {(isStop || (hotel.rooms && hotel.rooms.length > 0)) && (
              <section className="space-y-4">
                <h2 className="text-xl font-serif text-slate-800 mb-4 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-primary" />
                  Tarifs & Disponibilités
                  {nights && !isStop && (
                    <span className="text-sm font-sans font-normal text-slate-400 ml-1">
                      — {nights} nuit{nights > 1 ? "s" : ""}
                    </span>
                  )}
                </h2>
                
                {isStop ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600 text-xl font-bold">
                      ⚠️
                    </div>
                    <div className="space-y-1 text-center md:text-left">
                      <h3 className="font-serif font-bold text-lg text-red-800">Cet établissement est complet</h3>
                      <p className="text-red-600 text-sm leading-relaxed">
                        Aucune chambre n'est disponible pour les dates ou la configuration demandée.
                        Veuillez modifier vos dates de voyage ou sélectionner un autre établissement.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {hotel.rooms?.map((room, idx) => {
                      let displayName = room.roomName || "Chambre Standard";
                      // Remove duplicate count prefix like "1 x " if it's already there
                      const roomsCount = searchParams.rooms ?? 1;
                      const startsWithCount = /^\d+\s*x\s*/i.test(displayName);
                      if (startsWithCount) {
                        displayName = displayName.replace(/^\d+\s*x\s*/i, `${roomsCount} x `);
                      } else {
                        displayName = `${roomsCount} x ${displayName}`;
                      }
                      
                      return (
                        <div 
                          key={idx} 
                          className={`group bg-white rounded-2xl border transition-all duration-300 p-6 shadow-sm flex flex-col justify-between hover:shadow-md relative overflow-hidden ${
                            idx === 0 ? "border-orange-500/50 ring-1 ring-orange-500/10" : "border-slate-200"
                          }`}
                          data-testid={`room-card-${idx}`}
                        >
                          {/* Top-left ribbon for Best Price */}
                          {idx === 0 && (
                            <div className="absolute top-0 left-0 bg-[#FF5A00] text-white text-[9px] font-bold px-3 py-1 rounded-br-lg uppercase tracking-wider">
                              Meilleur Prix
                            </div>
                          )}

                          {/* Top-right status badge */}
                          <div className="absolute top-4 right-4">
                            {room.rateType === "BOOKABLE" ? (
                              <span 
                                style={{ backgroundColor: "#2ed573", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", display: "inline-block" }}
                              >
                                Disponible
                              </span>
                            ) : (
                              <span 
                                style={{ backgroundColor: "#ffa502", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", display: "inline-block" }}
                              >
                                Sur Demande
                              </span>
                            )}
                          </div>

                          <div className={`space-y-4 ${idx === 0 ? "pt-4" : ""}`}>
                            <h3 className="font-serif font-bold text-lg text-slate-800 leading-snug pr-20">
                              {displayName}
                            </h3>
                            
                            <div className="flex flex-col gap-2 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">👥</span>
                                <span className="font-medium">{searchParams.adults ?? 2} adultes</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">{boardIcon(room.boardName)}</span>
                                <span className="font-semibold text-slate-700">
                                  {room.boardName}
                                </span>
                              </div>
                              
                              <div className="pt-1">
                                <button className="text-teal-600 hover:underline font-semibold flex items-center gap-1 text-left">
                                  Frais d'annulation <span className="text-xs">ⓘ</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-4 mt-6 flex items-baseline justify-between">
                            <div>
                              <div className="flex items-baseline gap-1">
                                <p className="text-2xl font-bold text-slate-900">
                                  {room.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                                </p>
                                <span className="text-sm font-semibold text-slate-600">DZD <span className="text-xs text-slate-500 font-bold">∨</span></span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium">
                                Prix total {nights ?? 1} nuit{(nights ?? 1) > 1 ? "s" : ""}
                              </p>
                            </div>
                            
                            <Button 
                              onClick={() => startBooking(idx)}
                              className="bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              Réservez
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <span className="text-xl">{(hotel.stars ?? 0) >= 5 ? "🏆" : (hotel.stars ?? 0) >= 4 ? "⭐" : "🏨"}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-serif font-medium text-slate-900 truncate">{hotel.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{address || hotel.destination}</p>
                </div>
              </div>

              {isStop && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <span className="text-red-700 font-bold text-sm block">🚫 STOP SALES / COMPLET</span>
                  <span className="text-red-500 text-xs mt-1 block">Cet établissement n'est pas disponible pour la réservation.</span>
                </div>
              )}

              {/* Best price */}
              <div className={`mb-6 ${isStop ? "opacity-50" : ""}`}>
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
              <Button 
                size="lg" 
                onClick={() => !isStop && startBooking(0)}
                className={`w-full h-12 font-semibold text-base transition-all ${
                  isStop 
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200" 
                    : "bg-accent hover:bg-accent/90 text-accent-foreground"
                }`}
                data-testid="btn-book-now"
                disabled={isStop}
              >
                {isStop ? "Complet" : "Réserver maintenant"}
              </Button>
              {!isStop && (
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
              )}
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

      {/* Booking confirmation and guest details modal */}
      {bookingRoomIdx !== null && hotel && (
        <Dialog open={bookingRoomIdx !== null} onOpenChange={(open) => !open && setBookingRoomIdx(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Détails des Voyageurs</DialogTitle>
              <DialogDescription>
                Renseignez le nom de tous les voyageurs pour le bon {hotel.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-4">
              {passengerNames.map((name, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`passenger-${i}`}>Voyageur {i + 1} (Nom Complet)</Label>
                  <Input
                    id={`passenger-${i}`}
                    placeholder="ex. DOUADI ZOUBIR"
                    value={name}
                    onChange={(e) => {
                      const updated = [...passengerNames];
                      updated[i] = e.target.value;
                      setPassengerNames(updated);
                    }}
                    disabled={isCreatingBooking}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setBookingRoomIdx(null)} disabled={isCreatingBooking}>
                Annuler
              </Button>
              <Button onClick={handleCreateBooking} disabled={isCreatingBooking} className="gap-2">
                {isCreatingBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Confirmer la réservation"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
