import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useSearchHotels } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Printer, ArrowLeft, MapPin, Calendar, Users,
  Star, CheckCircle2, Phone, Mail, Globe,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

function Stars({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      ))}
    </span>
  );
}

function boardIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("all") || n.includes("inclusiv")) return "🍹";
  if (n.includes("pension complète") || n.includes("pension complete")) return "🍽️";
  if (n.includes("demi")) return "🥗";
  if (n.includes("petit") || n.includes("déjeuner") || n.includes("dejeuner")) return "☕";
  return "🛏️";
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtDateShort(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function genRef(hotelId?: string, checkin?: string) {
  const base = (hotelId ?? "000").slice(-4);
  const day = checkin ? checkin.replace(/-/g, "").slice(2) : "000000";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NVT-${day}-${base}-${rand}`;
}

export default function Reservation() {
  const { id } = useParams();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const refNum = useRef<string | null>(null);

  const isReference = id?.startsWith("NVT-");
  const [voucher, setVoucher] = useState<any>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(isReference);

  // Fetch voucher by reference from Express API
  useEffect(() => {
    if (isReference) {
      const fetchVoucher = async () => {
        try {
          const response = await fetch("/api/vouchers");
          if (response.ok) {
            const data = await response.json();
            const found = (data.vouchers || []).find((v: any) => v.reference === id);
            if (found) {
              setVoucher(found);
            }
          }
        } catch (err) {
          console.error("Failed to load voucher:", err);
        } finally {
          setLoadingVoucher(false);
        }
      };
      fetchVoucher();
    }
  }, [id, isReference]);

  const searchParams = useMemo(() => {
    const p = new URLSearchParams(searchString);
    const destinationId = p.get("destinationId") ? parseInt(p.get("destinationId")!) : undefined;
    const destination = p.get("destination") || undefined;
    const checkin = p.get("checkin") || undefined;
    const checkout = p.get("checkout") || undefined;
    const adults = p.get("adults") ? parseInt(p.get("adults")!) : undefined;
    const rooms = p.get("rooms") ? parseInt(p.get("rooms")!) : undefined;
    const roomIdx = p.get("roomIdx") ? parseInt(p.get("roomIdx")!) : 0;
    return { destinationId, destination, checkin, checkout, adults, rooms, roomIdx };
  }, [searchString]);

  const hasContext = !isReference && (!!searchParams.destinationId || !!searchParams.destination);

  const { data: searchResults, isLoading: searchLoading } = useSearchHotels(searchParams, {
    query: { enabled: hasContext } as any,
  });

  const hotel = searchResults?.hotels?.find((h) => h.id === id);

  if (!refNum.current && !isReference) {
    refNum.current = genRef(id, searchParams.checkin);
  }

  const nights = useMemo(() => {
    if (isReference && voucher) return voucher.nights;
    if (!searchParams.checkin || !searchParams.checkout) return undefined;
    const a = new Date(searchParams.checkin);
    const b = new Date(searchParams.checkout);
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    return diff > 0 ? diff : undefined;
  }, [isReference, voucher, searchParams.checkin, searchParams.checkout]);

  const selectedRoom = hotel?.rooms?.[searchParams.roomIdx] ?? hotel?.rooms?.[0];

  // Resolve layout variables
  const resolvedRef = isReference ? id : refNum.current;
  const resolvedHotelName = isReference ? (voucher?.hotelName || "Hôtel") : (hotel?.name || "Hôtel");
  const resolvedDestination = isReference ? (voucher?.destination || "Tunis, Tunisie") : (hotel?.destination || "Tunis, Tunisie");
  const resolvedCheckin = isReference ? voucher?.checkin : searchParams.checkin;
  const resolvedCheckout = isReference ? voucher?.checkout : searchParams.checkout;
  const resolvedAdults = isReference ? (voucher?.adults ?? 2) : (searchParams.adults ?? 2);
  const resolvedGuests = isReference 
    ? (Array.isArray(voucher?.guests) ? voucher.guests : JSON.parse(voucher?.guests || "[]"))
    : ["M. Client Principal"];
  const resolvedRoomCategory = isReference ? voucher?.roomCategory : (selectedRoom?.roomName || "Chambre Standard");
  const resolvedBoardType = isReference ? voucher?.boardType : selectedRoom?.boardName;
  const resolvedMarkedUpPrice = isReference ? voucher?.markedUpPrice : selectedRoom?.amount;

  const backUrl = isReference ? "/agent/dashboard" : `/hotel/${id}?${searchString}`;
  const issueDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const isLoading = isReference ? loadingVoucher : searchLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isReference && !hotel) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-slate-500 mb-6">Réservation introuvable. Veuillez retourner à la recherche.</p>
        <Button onClick={() => setLocation("/search")}>Retour à la recherche</Button>
      </div>
    );
  }

  const photos = !isReference && hotel ? ((hotel.photos as string[] | undefined) ?? (hotel.image ? [hotel.image] : [])) : [];
  const address = !isReference && hotel ? ((hotel as any).address as string | undefined) : resolvedDestination;

  return (
    <>
      {/* ── Print-only global styles injected via a style tag ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .voucher-root { padding: 0 !important; background: white !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Toolbar (hidden when printing) ── */}
      <div className="no-print bg-slate-100 border-b border-slate-200 py-3 px-4 flex items-center justify-between sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(backUrl)}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {isReference ? "Retour au dashboard" : "Retour à l'hôtel"}
        </Button>
        <Button
          onClick={() => window.print()}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Printer className="w-4 h-4" />
          Imprimer / Télécharger PDF
        </Button>
      </div>

      {/* ── Voucher document ── */}
      <div className="voucher-root min-h-screen bg-slate-100 py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white shadow-xl print:shadow-none">

          {/* ── Header ── */}
          <div className="bg-primary px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={`${BASE}logo.png`}
                alt="Next Visa Travel"
                className="h-10 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="text-white">
                <p className="font-serif text-lg font-bold leading-tight">Next Visa Travel</p>
                <p className="text-primary-foreground/70 text-xs">Agence de voyage officielle</p>
              </div>
            </div>
            <div className="text-right text-white">
              <p className="text-xs text-primary-foreground/70 uppercase tracking-widest font-semibold">Bon de réservation</p>
              <p className="text-xl font-mono font-bold mt-0.5">{resolvedRef}</p>
              <p className="text-xs text-primary-foreground/70 mt-0.5">Émis le {issueDate}</p>
            </div>
          </div>

          {/* ── Status ribbon ── */}
          <div className="bg-green-500 px-8 py-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <p className="text-white text-sm font-semibold">Réservation confirmée</p>
          </div>

          {/* ── Hotel banner ── */}
          {photos[0] ? (
            <div className="relative h-44 overflow-hidden">
              <img
                src={photos[0]}
                alt={resolvedHotelName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              <div className="absolute bottom-4 left-6 text-white">
                {hotel && <Stars count={hotel.stars} />}
                <h1 className="text-2xl font-serif font-bold mt-1">{resolvedHotelName}</h1>
                {address && (
                  <p className="flex items-center gap-1.5 text-sm text-white/80 mt-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {address}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 px-8 py-6 text-white">
              <h1 className="text-2xl font-serif font-bold">{resolvedHotelName}</h1>
              <p className="flex items-center gap-1.5 text-sm text-white/80 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {address}
              </p>
            </div>
          )}

          {/* ── Main content ── */}
          <div className="px-8 py-8 space-y-8">

            {/* ── Row 1: Stay + Guests ── */}
            <div className="grid grid-cols-2 gap-6">

              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Dates du séjour
                </p>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Arrivée</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{fmtDate(resolvedCheckin)}</p>
                      <p className="text-xs text-slate-400">Check-in à partir de 14h00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Départ</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{fmtDate(resolvedCheckout)}</p>
                      <p className="text-xs text-slate-400">Check-out avant 12h00</p>
                    </div>
                  </div>
                  {nights && (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-center text-sm font-semibold text-primary">
                        Durée du séjour : {nights} nuit{nights > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Voyageurs & Chambres
                </p>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200 h-[calc(100%-1.5rem)]">
                  <div className="flex justify-between text-sm py-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Adultes</span>
                    <span className="font-semibold text-slate-800">{resolvedAdults}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">{resolvedDestination.split(",")[0]}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5">
                    <span className="text-slate-500 text-xs">Voyageurs</span>
                    <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]" title={resolvedGuests.join(", ")}>
                      {resolvedGuests.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Selected board plan ── */}
            {resolvedBoardType && (
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">
                  Formule réservée
                </p>
                <div className="border-2 border-primary rounded-xl p-5 bg-primary/4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{boardIcon(resolvedBoardType)}</span>
                      <div>
                        <p className="font-serif font-bold text-slate-900 text-lg">{resolvedBoardType}</p>
                        <p className="text-slate-500 text-sm mt-0.5">
                          {resolvedHotelName} · {resolvedDestination}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">Catégorie: {resolvedRoomCategory}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {resolvedMarkedUpPrice?.toLocaleString("fr-DZ")} DA
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Toutes taxes incluses</p>
                      {nights && resolvedMarkedUpPrice && (
                        <p className="text-xs text-slate-500 mt-1">
                          ≈ {Math.round(resolvedMarkedUpPrice / nights).toLocaleString("fr-DZ")} DA / nuit
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Conditions ── */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="font-semibold text-amber-800 mb-2 text-sm">Conditions importantes</p>
              <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside">
                <li>Ce bon de réservation doit être présenté à l'hôtel lors du check-in.</li>
                <li>Les tarifs indiqués sont en dinars algériens (DA), toutes taxes et commissions incluses.</li>
                <li>Des pièces d'identité valides seront demandées pour tous les voyageurs à l'arrivée.</li>
                <li>L'heure de check-in est à partir de 14h00. L'heure de check-out est avant 12h00.</li>
              </ul>
            </div>

            {/* ── Agency contact ── */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Téléphone</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">+213675009373</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Email</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">nextvisadz@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Site web</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">nextvisabooking.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between text-xs text-slate-400">
            <p>Next Visa Travel · Agence de voyage agréée · Algérie</p>
            <p>Réf. {resolvedRef} · Émis le {fmtDateShort(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </>
  );
}

