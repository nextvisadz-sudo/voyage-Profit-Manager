import { useLocation, useSearch } from "wouter";
import { useMemo, useState, useEffect } from "react";
import { useSearchHotels, getSearchHotelsQueryKey } from "@workspace/api-client-react";
import { SearchForm } from "../components/search-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Filter, SlidersHorizontal, Search as SearchIcon, Utensils, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BOARD_OPTIONS = [
  "Demi pension",
  "Logement simple",
  "Pension complète",
  "Petit Déjeuner",
  "Soft All Inclusive",
];

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-primary border-primary" : "border-slate-300 hover:border-primary"
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

export default function Search() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const queryParams = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const destinationId = params.get("destinationId") ? parseInt(params.get("destinationId")!) : undefined;
    const destination = params.get("destination") || undefined;
    const checkin = params.get("checkin") || undefined;
    const checkout = params.get("checkout") || undefined;
    const adults = params.get("adults") ? parseInt(params.get("adults")!) : undefined;
    const rooms = params.get("rooms") ? parseInt(params.get("rooms")!) : undefined;
    const children = params.get("children") ? parseInt(params.get("children")!) : undefined;
    const infants = params.get("infants") ? parseInt(params.get("infants")!) : undefined;
    return { destinationId, destination, checkin, checkout, adults, rooms, children, infants };
  }, [searchString]);

  const hasSearched = !!queryParams.destinationId || !!queryParams.destination;

  const { data: searchResults, isLoading } = useSearchHotels(queryParams, {
    query: {
      enabled: hasSearched,
      queryKey: getSearchHotelsQueryKey(queryParams),
    },
  });

  // ── Sidebar filter state ─────────────────────────────────────────────────
  const [nameFilter, setNameFilter] = useState("");
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceInitialized, setPriceInitialized] = useState(false);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);

  // Initialise price range from data once
  useEffect(() => {
    if (searchResults?.hotels && searchResults.hotels.length > 0 && !priceInitialized) {
      const prices = searchResults.hotels.map((h) => h.price);
      setPriceRange([Math.min(...prices), Math.max(...prices)]);
      setPriceInitialized(true);
    }
  }, [searchResults, priceInitialized]);

  // Reset filters when destination changes
  useEffect(() => {
    setNameFilter("");
    setSelectedBoards(new Set());
    setSelectedStars(null);
    setPriceInitialized(false);
  }, [queryParams.destinationId]);

  const priceMin = useMemo(() => {
    if (!searchResults?.hotels?.length) return 0;
    return Math.min(...searchResults.hotels.map((h) => h.price));
  }, [searchResults]);
  const priceMax = useMemo(() => {
    if (!searchResults?.hotels?.length) return 0;
    return Math.max(...searchResults.hotels.map((h) => h.price));
  }, [searchResults]);

  // Compute board counts from results
  const boardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of BOARD_OPTIONS) counts[opt] = 0;
    searchResults?.hotels?.forEach((hotel) => {
      hotel.rooms?.forEach((room) => {
        const board = room.boardName;
        const match = BOARD_OPTIONS.find(
          (b) => b.toLowerCase() === board.toLowerCase() || board.toLowerCase().includes(b.toLowerCase())
        );
        if (match) counts[match] = (counts[match] ?? 0) + 1;
      });
    });
    return counts;
  }, [searchResults]);

  function toggleBoard(board: string) {
    setSelectedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(board)) next.delete(board);
      else next.add(board);
      return next;
    });
  }

  const hasActiveFilters =
    nameFilter.trim() !== "" ||
    selectedBoards.size > 0 ||
    selectedStars !== null ||
    (priceInitialized && (priceRange[0] > priceMin || priceRange[1] < priceMax));

  function clearFilters() {
    setNameFilter("");
    setSelectedBoards(new Set());
    setSelectedStars(null);
    if (searchResults?.hotels?.length) {
      const prices = searchResults.hotels.map((h) => h.price);
      setPriceRange([Math.min(...prices), Math.max(...prices)]);
    }
  }

  // ── Filter hotels ────────────────────────────────────────────────────────
  const filteredHotels = useMemo(() => {
    const hotels = searchResults?.hotels ?? [];
    return hotels.filter((hotel) => {
      if (nameFilter.trim() && !hotel.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (priceInitialized && (hotel.price < priceRange[0] || hotel.price > priceRange[1])) return false;
      if (selectedStars !== null && hotel.stars !== selectedStars) return false;
      if (selectedBoards.size > 0) {
        const hotelBoards = new Set(
          (hotel.rooms ?? []).map((r) =>
            BOARD_OPTIONS.find(
              (b) => b.toLowerCase() === r.boardName.toLowerCase() || r.boardName.toLowerCase().includes(b.toLowerCase())
            )
          ).filter(Boolean)
        );
        const hasMatch = [...selectedBoards].some((b) => hotelBoards.has(b));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [searchResults, nameFilter, priceRange, priceInitialized, selectedStars, selectedBoards]);

  const handleSearch = (params: {
    destinationId: number;
    destination: string;
    checkin: string;
    checkout: string;
    adults: number;
    rooms: number;
    children: number;
    infants: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("destinationId", String(params.destinationId));
    sp.set("destination", params.destination);
    if (params.checkin) sp.set("checkin", params.checkin);
    if (params.checkout) sp.set("checkout", params.checkout);
    if (params.adults) sp.set("adults", String(params.adults));
    if (params.rooms) sp.set("rooms", String(params.rooms));
    if (params.children) sp.set("children", String(params.children));
    if (params.infants) sp.set("infants", String(params.infants));
    setLocation(`/search?${sp.toString()}`);
  };

  const currentDestId = queryParams.destinationId ? String(queryParams.destinationId) : "";

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Search Header */}
      <div className="bg-primary pt-8 pb-32">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-serif text-white mb-6">Trouvez votre séjour idéal</h1>
          <div className="shadow-lg rounded-xl overflow-visible">
            <SearchForm
              initialValues={{
                destinationId: currentDestId,
                checkin: queryParams.checkin ? new Date(queryParams.checkin) : undefined,
                checkout: queryParams.checkout ? new Date(queryParams.checkout) : undefined,
                adults: queryParams.adults?.toString(),
                rooms: queryParams.rooms?.toString(),
                children: queryParams.children?.toString(),
                infants: queryParams.infants?.toString(),
              }}
              onSubmit={handleSearch}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 -mt-20">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Filters sidebar ── */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif font-semibold text-base flex items-center gap-2 text-slate-800">
                  <Filter className="w-4 h-4 text-primary" />
                  Filtrer par:
                </h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs text-primary hover:text-primary/80 h-auto py-1 px-2 gap-1"
                  >
                    <X className="w-3 h-3" />
                    Réinitialiser
                  </Button>
                )}
              </div>

              <div className="space-y-7">
                {/* ── Nom d'hôtel ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-slate-700">Nom d'hôtel</h4>
                    {nameFilter && (
                      <button
                        onClick={() => setNameFilter("")}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="Mot clé"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="pr-10 border-slate-200 focus:border-primary text-sm"
                      data-testid="input-name-filter"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded bg-primary flex items-center justify-center">
                      <SearchIcon className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* ── Budget slider ── */}
                {priceInitialized && priceMin < priceMax && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-slate-700">Budget</h4>
                      {(priceRange[0] > priceMin || priceRange[1] < priceMax) && (
                        <button
                          onClick={() => setPriceRange([priceMin, priceMax])}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                    <Slider
                      min={priceMin}
                      max={priceMax}
                      step={Math.max(1, Math.round((priceMax - priceMin) / 100))}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange(v as [number, number])}
                      className="mb-3"
                      data-testid="slider-budget"
                    />
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
                        {priceRange[0].toLocaleString("fr-DZ")} DZD
                      </span>
                      <span className="bg-slate-50 border border-slate-200 rounded px-2 py-1">
                        {priceRange[1].toLocaleString("fr-DZ")} DZD
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Catégorie (étoiles) ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-slate-700">Catégorie</h4>
                    {selectedStars !== null && (
                      <button
                        onClick={() => setSelectedStars(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer select-none"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {[3, 4, 5].map((stars) => {
                      const isActive = selectedStars === stars;
                      return (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => setSelectedStars(isActive ? null : stars)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 select-none",
                            isActive
                              ? "bg-primary border-primary text-white"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                          )}
                          data-testid={`filter-stars-${stars}`}
                        >
                          <span className={isActive ? "text-white" : "text-slate-800"}>{stars}★</span>
                          <Star
                            className={cn(
                              "w-3.5 h-3.5 transition-all duration-200",
                              isActive
                                ? "fill-white text-white scale-110"
                                : "fill-yellow-400 text-yellow-400"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Types de pension ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-slate-700">Types de pension</h4>
                    {selectedBoards.size > 0 && (
                      <button
                        onClick={() => setSelectedBoards(new Set())}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {BOARD_OPTIONS.map((board) => {
                      const count = boardCounts[board] ?? 0;
                      const checked = selectedBoards.has(board);
                      return (
                        <label
                          key={board}
                          className="flex items-center gap-3 cursor-pointer group"
                          data-testid={`filter-board-${board.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          <Checkbox checked={checked} onChange={() => toggleBoard(board)} />
                          <span className={`text-sm flex-1 ${checked ? "text-primary font-medium" : "text-slate-600"}`}>
                            {board}
                          </span>
                          {count > 0 && (
                            <span className="text-xs text-slate-400 font-medium">{count}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Results list ── */}
          <div className="w-full min-w-0">
            {!hasSearched ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-serif text-slate-800 mb-2">Prêt à voyager ?</h2>
                <p className="text-slate-500">Choisissez une destination pour trouver les meilleurs hôtels.</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-10 w-32" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 flex flex-col md:flex-row gap-6">
                      <Skeleton className="w-full md:w-72 h-48 rounded-lg shrink-0" />
                      <div className="flex-1 py-2 flex flex-col gap-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                    <div className="border-t border-slate-100 p-4">
                      <Skeleton className="h-24 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults?.hotels && searchResults.hotels.length > 0 ? (
              <div className="space-y-6">
                {/* Results header */}
                <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-3">
                  <div>
                    <p className="text-slate-600 font-medium" data-testid="text-results-count">
                      <span className="text-primary font-bold">{filteredHotels.length}</span>
                      {filteredHotels.length !== searchResults.total && (
                        <span className="text-slate-400 text-sm"> / {searchResults.total}</span>
                      )}{" "}
                      hôtels{filteredHotels.length > 1 ? "" : ""} à {searchResults.destination}
                    </p>
                    {hasActiveFilters && (
                      <p className="text-xs text-primary mt-0.5">Filtres actifs</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Trier : Recommandés
                  </Button>
                </div>

                {/* No filtered results message */}
                {filteredHotels.length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
                    <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h2 className="text-lg font-serif text-slate-800 mb-2">Aucun résultat pour ces filtres</h2>
                    <p className="text-slate-500 text-sm mb-4">Essayez d'élargir vos critères de recherche.</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>Réinitialiser les filtres</Button>
                  </div>
                )}

                {filteredHotels.map((hotel) => {
                  const isStop = hotel.isStopSales || !hotel.rooms || hotel.rooms.length === 0;

                  return (
                    <div
                      key={hotel.id}
                      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300 ${
                        isStop ? "opacity-60 bg-slate-50/50" : ""
                      }`}
                      data-testid={`card-hotel-${hotel.id}`}
                    >
                      {/* Hotel info row */}
                      <div className="p-4 flex flex-col sm:flex-row gap-5">
                        <div className="w-full sm:w-60 h-44 rounded-lg overflow-hidden shrink-0 relative">
                          <img
                            src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"}
                            alt={hotel.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800";
                            }}
                          />
                          {isStop && (
                            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                              <span className="bg-[#d63031] text-white font-bold text-xs uppercase tracking-wider py-1 px-3 rounded-md shadow-md animate-pulse">
                                Complet
                              </span>
                            </div>
                          )}
                          {!isStop && hotel.rating != null && (
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-800 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-accent text-accent" />
                              {typeof hotel.rating === "number" ? (hotel.rating * 20).toFixed(0) : hotel.rating}/20
                            </div>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                          <div>
                            <div className="flex items-center gap-0.5 mb-1">
                              {Array.from({ length: hotel.stars || 0 }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-accent text-accent" />
                              ))}
                            </div>
                            <h2 className="text-xl font-serif text-slate-900 mb-1 truncate">{hotel.name}</h2>
                            <p className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              {hotel.destination}
                            </p>
                            
                            {/* Stylized orange marketing badges & restrictions */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {hotel.isStopSales && (
                                <Badge className="bg-[#d63031] hover:bg-[#d63031] text-white font-bold text-[9px] uppercase tracking-wider py-0.5 px-2 rounded-md">
                                  Stop Sales / Complet
                                </Badge>
                              )}
                              {hotel.marketingBadges?.map((badge) => (
                                <Badge key={badge} className="bg-accent hover:bg-accent text-accent-foreground font-bold text-[9px] py-0.5 px-2 rounded-md">
                                  {badge}
                                </Badge>
                              ))}
                              {hotel.restrictions?.map((restriction) => {
                                const isCelib = /c[eé]lib/i.test(restriction);
                                if (isCelib) {
                                  return (
                                    <span 
                                      key={restriction} 
                                      style={{ backgroundColor: "#d63031", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", display: "inline-block" }}
                                    >
                                      ⚠ {restriction}
                                    </span>
                                  );
                                }
                                return (
                                  <Badge key={restriction} className="bg-orange-600 hover:bg-orange-600 text-white font-bold text-[9px] py-0.5 px-2 rounded-md">
                                    ⚠ {restriction}
                                  </Badge>
                                );
                              })}
                            </div>

                            {hotel.description && (
                              /c[eé]lib/i.test(hotel.description) ? (
                                <div className="mb-3">
                                  <span 
                                    style={{ backgroundColor: "#d63031", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "11px", display: "inline-block" }}
                                  >
                                    ⚠ {hotel.description}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{hotel.description}</p>
                              )
                            )}
                            {hotel.amenities && hotel.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {hotel.amenities.slice(0, 4).map((a) => (
                                  <Badge key={a} variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs hover:bg-slate-100">
                                    {a}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Tarif à partir de</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-serif text-primary" data-testid={`text-price-${hotel.id}`}>
                                  {hotel.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                                </span>
                                <span className="text-sm font-semibold text-primary">DA</span>
                                {!isStop && (
                                  <span className="text-[10px] text-slate-400 font-medium ml-1">
                                    / nuit / pers. en {hotel.roomType ?? "Chambre Standard"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => {
                                if (isStop) return;
                                const sp = new URLSearchParams(searchString);
                                setLocation(`/hotel/${hotel.id}?${sp.toString()}`);
                              }}
                              disabled={isStop}
                              className={`px-5 font-semibold transition-all ${
                                isStop 
                                  ? "bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200" 
                                  : "bg-accent hover:bg-accent/90 text-accent-foreground"
                              }`}
                              data-testid={`btn-view-${hotel.id}`}
                            >
                              {isStop ? "Complet" : "Voir détails"}
                            </Button>
                          </div>
                        </div>
                      </div>

                    {/* Rooms / board types table */}
                    {hotel.rooms && hotel.rooms.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Utensils className="w-3.5 h-3.5" />
                          Formules disponibles
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {hotel.rooms.map((room, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-3"
                              data-testid={`room-${hotel.id}-${idx}`}
                            >
                              <span className="text-sm text-slate-700 font-medium truncate flex items-center gap-1.5">
                                {room.boardName}
                                {room.rateType !== "BOOKABLE" && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Sur Demande (On Request)" />
                                )}
                              </span>
                              <span className="text-sm font-bold text-primary whitespace-nowrap">
                                {room.amount.toLocaleString("fr-DZ")} DA
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-serif text-slate-800 mb-2">Aucun résultat trouvé</h2>
                <p className="text-slate-500 mb-6">Aucun hôtel ne correspond à vos critères pour {queryParams.destination}.</p>
                <Button variant="outline" onClick={() => setLocation("/search")}>Effacer la recherche</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
