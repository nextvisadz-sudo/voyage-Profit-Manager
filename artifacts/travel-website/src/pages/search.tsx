import { useLocation, useSearch } from "wouter";
import { useMemo } from "react";
import { useSearchHotels, getSearchHotelsQueryKey } from "@workspace/api-client-react";
import { SearchForm } from "../components/search-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Filter, SlidersHorizontal, ChevronRight, Check, Search as SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Search() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const queryParams = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return {
      destination: params.get("destination") || undefined,
      checkin: params.get("checkin") || undefined,
      checkout: params.get("checkout") || undefined,
      adults: params.get("adults") ? parseInt(params.get("adults")!) : undefined,
      rooms: params.get("rooms") ? parseInt(params.get("rooms")!) : undefined,
    };
  }, [searchString]);

  const { data: searchResults, isLoading, isError } = useSearchHotels(queryParams, {
    query: {
      enabled: Object.keys(queryParams).length > 0 && !!queryParams.destination,
      queryKey: getSearchHotelsQueryKey(queryParams)
    }
  });

  const handleSearch = (params: any) => {
    const searchParams = new URLSearchParams();
    if (params.destination) searchParams.append("destination", params.destination);
    if (params.checkin) searchParams.append("checkin", params.checkin);
    if (params.checkout) searchParams.append("checkout", params.checkout);
    if (params.adults) searchParams.append("adults", params.adults.toString());
    if (params.rooms) searchParams.append("rooms", params.rooms.toString());
    
    setLocation(`/search?${searchParams.toString()}`);
  };

  const hasSearched = Object.keys(queryParams).length > 0 && !!queryParams.destination;

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Search Header */}
      <div className="bg-primary pt-8 pb-32">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-serif text-white mb-6">Find Your Perfect Stay</h1>
          <div className="shadow-lg rounded-xl overflow-hidden">
            <SearchForm 
              initialValues={{
                destination: queryParams.destination,
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

      {/* Results Section */}
      <div className="container mx-auto px-4 -mt-20">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className="w-full lg:w-1/4 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif font-medium text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  Filters
                </h3>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Clear All</Button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h4 className="font-medium text-sm mb-3">Star Rating</h4>
                  <div className="space-y-2">
                    {[5, 4, 3].map(stars => (
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
                  <h4 className="font-medium text-sm mb-3">Amenities</h4>
                  <div className="space-y-2">
                    {["Pool", "Spa", "Fitness Center", "Restaurant", "Room Service"].map(amenity => (
                      <label key={amenity} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-5 h-5 border rounded border-slate-300 flex items-center justify-center group-hover:border-primary">
                          <Check className="w-3 h-3 text-transparent group-hover:text-primary" />
                        </div>
                        <span className="text-sm text-slate-600">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Results List */}
          <div className="w-full lg:w-3/4">
            {!hasSearched ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-serif text-slate-800 mb-2">Ready to explore?</h2>
                <p className="text-slate-500">Enter a destination above to find curated luxury hotels and resorts.</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-10 w-32" />
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row gap-6">
                    <Skeleton className="w-full md:w-72 h-48 rounded-lg shrink-0" />
                    <div className="flex-1 py-2 flex flex-col">
                      <Skeleton className="h-6 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-1/4 mb-auto" />
                      <div className="flex justify-between items-end mt-4">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-32" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults?.hotels && searchResults.hotels.length > 0 ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-slate-600 font-medium" data-testid="text-results-count">
                    Found <span className="text-primary">{searchResults.total}</span> luxury stays in {queryParams.destination}
                  </p>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Sort: Recommended
                  </Button>
                </div>
                
                {searchResults.hotels.map(hotel => (
                  <div 
                    key={hotel.id} 
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow"
                    data-testid={`card-hotel-${hotel.id}`}
                  >
                    <div className="w-full sm:w-64 h-48 rounded-lg overflow-hidden shrink-0 relative">
                      <img 
                        src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop"} 
                        alt={hotel.name} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-accent text-accent" />
                        {hotel.rating?.toFixed(1) || "New"}
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: hotel.stars || 0 }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-accent text-accent" />
                          ))}
                        </div>
                        <h2 className="text-xl font-serif text-slate-900 mb-1">{hotel.name}</h2>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mb-3">
                          <MapPin className="w-3.5 h-3.5" />
                          {hotel.destination}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {hotel.amenities?.slice(0, 3).map(amenity => (
                            <Badge key={amenity} variant="secondary" className="bg-slate-100 text-slate-600 font-normal hover:bg-slate-100">
                              {amenity}
                            </Badge>
                          ))}
                          {hotel.amenities && hotel.amenities.length > 3 && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal hover:bg-slate-100">
                              +{hotel.amenities.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-end justify-between mt-4 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{hotel.roomType || "Standard Room"}</p>
                          <p className="text-2xl font-serif text-primary" data-testid={`text-price-${hotel.id}`}>
                            {hotel.price.toLocaleString("fr-DZ")} <span className="text-base font-sans font-semibold">DA</span> <span className="text-sm text-slate-500 font-sans font-normal">/ {hotel.nights || 1} nuit</span>
                          </p>
                        </div>
                        <Button 
                          onClick={() => setLocation(`/hotel/${hotel.id}`)}
                          className="px-6"
                          data-testid={`btn-view-${hotel.id}`}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-serif text-slate-800 mb-2">No results found</h2>
                <p className="text-slate-500 mb-6">We couldn't find any hotels matching your criteria for {queryParams.destination}.</p>
                <Button variant="outline" onClick={() => setLocation("/search")}>Clear Search</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
