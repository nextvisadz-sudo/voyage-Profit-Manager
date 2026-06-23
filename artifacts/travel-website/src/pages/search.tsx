import { useLocation, useSearch } from "wouter";
import { useMemo } from "react";
import { useSearchHotels, getSearchHotelsQueryKey } from "@workspace/api-client-react";
import { SearchForm } from "../components/search-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Filter, SlidersHorizontal, Check, Search as SearchIcon, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    return { destinationId, destination, checkin, checkout, adults, rooms };
  }, [searchString]);

  const hasSearched = !!queryParams.destinationId || !!queryParams.destination;

  const { data: searchResults, isLoading } = useSearchHotels(queryParams, {
    query: {
      enabled: hasSearched,
      queryKey: getSearchHotelsQueryKey(queryParams),
    },
  });

  const handleSearch = (params: {
    destinationId: number;
    destination: string;
    checkin: string;
    checkout: string;
    adults: number;
    rooms: number;
  }) => {
    const sp = new URLSearchParams();
    sp.set("destinationId", String(params.destinationId));
    sp.set("destination", params.destination);
    if (params.checkin) sp.set("checkin", params.checkin);
    if (params.checkout) sp.set("checkout", params.checkout);
    if (params.adults) sp.set("adults", String(params.adults));
    if (params.rooms) sp.set("rooms", String(params.rooms));
    setLocation(`/search?${sp.toString()}`);
  };

  const currentDestId = queryParams.destinationId ? String(queryParams.destinationId) : "";

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Search Header */}
      <div className="bg-primary pt-8 pb-32">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-serif text-white mb-6">Trouvez votre séjour idéal</h1>
          <div className="shadow-lg rounded-xl overflow-hidden">
            <SearchForm
              initialValues={{
                destinationId: currentDestId,
                checkin: queryParams.checkin ? new Date(queryParams.checkin) : undefined,
                checkout: queryParams.checkout ? new Date(queryParams.checkout) : undefined,
                adults: queryParams.adults?.toString(),
                rooms: queryParams.rooms?.toString(),
              }}
              onSubmit={handleSearch}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 -mt-20">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters sidebar */}
          <aside className="w-full lg:w-1/4 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif font-medium text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  Filtres
                </h3>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Effacer</Button>
              </div>
              <div className="space-y-8">
                <div>
                  <h4 className="font-medium text-sm mb-3">Catégorie</h4>
                  <div className="space-y-2">
                    {[5, 4, 3].map((stars) => (
                      <label key={stars} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-5 h-5 border rounded border-slate-300 flex items-center justify-center group-hover:border-primary">
                          <Check className="w-3 h-3 text-transparent group-hover:text-primary" />
                        </div>
                        <div className="flex items-center">
                          {Array.from({ length: stars }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                          ))}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-3">Pension</h4>
                  <div className="space-y-2">
                    {["Logement simple", "Petit Déjeuner", "Demi pension", "Pension complète", "All Inclusive"].map((board) => (
                      <label key={board} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-5 h-5 border rounded border-slate-300 flex items-center justify-center group-hover:border-primary">
                          <Check className="w-3 h-3 text-transparent group-hover:text-primary" />
                        </div>
                        <span className="text-sm text-slate-600">{board}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Results list */}
          <div className="w-full lg:w-3/4">
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
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-slate-600 font-medium" data-testid="text-results-count">
                    <span className="text-primary font-bold">{searchResults.total}</span> hôtels trouvés à {searchResults.destination}
                  </p>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Trier : Recommandés
                  </Button>
                </div>

                {searchResults.hotels.map((hotel) => (
                  <div
                    key={hotel.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
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
                        {hotel.rating != null && (
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-accent text-accent" />
                            {typeof hotel.rating === "number" ? hotel.rating.toFixed(1) : hotel.rating}
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
                          {hotel.description && (
                            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{hotel.description}</p>
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
                            <p className="text-xs text-slate-400 mb-0.5">À partir de</p>
                            <p className="text-2xl font-serif text-primary" data-testid={`text-price-${hotel.id}`}>
                              {hotel.price.toLocaleString("fr-DZ")} <span className="text-base font-sans font-semibold">DA</span>
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                            const sp = new URLSearchParams(searchString);
                            setLocation(`/hotel/${hotel.id}?${sp.toString()}`);
                          }}
                            className="px-5"
                            data-testid={`btn-view-${hotel.id}`}
                          >
                            Voir détails
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
                              <span className="text-sm text-slate-700 font-medium truncate">{room.boardName}</span>
                              <span className="text-sm font-bold text-primary whitespace-nowrap">
                                {room.amount.toLocaleString("fr-DZ")} DA
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
