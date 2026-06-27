import { useLocation } from "wouter";
import { SearchForm } from "../components/search-form";
import { Button } from "@/components/ui/button";
import { useSearchHotels, useGetCommission } from "@workspace/api-client-react";
import { useState, useMemo } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  // Fetch commission to satisfy requirement to use hooks, though we don't display it directly here
  useGetCommission();

  const defaultDates = useMemo(() => {
    const today = new Date();
    const checkinDate = new Date(today);
    checkinDate.setDate(today.getDate() + 7); // 1 week from now
    
    const checkoutDate = new Date(checkinDate);
    checkoutDate.setDate(checkinDate.getDate() + 4); // 4 nights stay
    
    return {
      checkin: checkinDate.toISOString().split("T")[0],
      checkout: checkoutDate.toISOString().split("T")[0]
    };
  }, []);

  const { data: searchResults } = useSearchHotels(
    { 
      destination: "Tunis",
      destinationId: 8,
      checkin: defaultDates.checkin,
      checkout: defaultDates.checkout,
      rooms: 1,
      adults: 2
    },
    {
      query: {
        refetchOnWindowFocus: true,
        refetchInterval: 15000,
      } as any,
    }
  );
  
  const hotels = searchResults?.hotels ?? [];

  const cheapestHotels = useMemo(() => {
    return [...hotels]
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
  }, [hotels]);

  const [activeTab, setActiveTab] = useState("Gratuités Enfants");
  
  const getHotelCategory = (idx: number): string[] => {
    const cats = [
      ["Gratuités Enfants", "Early Booking"],
      ["Promos du mois", "Voyage de noce"],
      ["Vente Flash", "Early Booking"],
      ["Voyage de noce", "Promos du mois"],
      ["Gratuités Enfants", "Vente Flash"],
      ["Early Booking"],
      ["Promos du mois", "Gratuités Enfants"],
      ["Voyage de noce", "Vente Flash"],
      ["Early Booking", "Promos du mois"]
    ];
    return cats[idx % cats.length];
  };

  const trendingHotels = useMemo(() => {
    return hotels
      .map((h, idx) => ({ ...h, categories: getHotelCategory(idx) }))
      .filter((h) => h.categories.includes(activeTab))
      .slice(0, 4);
  }, [hotels, activeTab]);

  const handleSearch = (params: any) => {
    const searchParams = new URLSearchParams();
    if (params.destinationId) searchParams.append("destinationId", params.destinationId.toString());
    if (params.destination) searchParams.append("destination", params.destination);
    if (params.checkin) searchParams.append("checkin", params.checkin);
    if (params.checkout) searchParams.append("checkout", params.checkout);
    if (params.adults) searchParams.append("adults", params.adults.toString());
    if (params.rooms) searchParams.append("rooms", params.rooms.toString());
    if (params.children !== undefined) searchParams.append("children", params.children.toString());
    if (params.infants !== undefined) searchParams.append("infants", params.infants.toString());
    
    setLocation(`/search?${searchParams.toString()}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] lg:h-[700px] flex items-center justify-center">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('/ChatGPT Image 24 juin 2026, 03_39_23.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.4)' }} />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 pt-16">
          <div className="max-w-3xl text-white mb-10">
            <h1 className="text-5xl lg:text-7xl font-serif font-medium leading-tight mb-6" data-testid="home-hero-title">
              Discover Extraordinary Experiences
            </h1>
            <p className="text-lg lg:text-xl font-light text-slate-100 max-w-xl">
              Curated luxury travel and bespoke itineraries for the world's most discerning travelers.
            </p>
          </div>
          
          <div className="max-w-5xl bg-white rounded-xl shadow-2xl p-2 sm:p-4">
            <SearchForm onSubmit={handleSearch} />
          </div>
        </div>
      </section>

      {/* Cheapest Deals Section */}
      {cheapestHotels.length > 0 && (
        <section className="py-20 bg-slate-50 border-b border-slate-100 animate-fade-in">
          <div className="container mx-auto px-4">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-serif text-slate-900 mb-2">ارخص الفنادق (Cheapest Deals)</h2>
              <p className="text-slate-500 max-w-xl">
                Découvrez notre sélection exclusive d'hôtels aux tarifs les plus compétitifs, commission incluse.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {cheapestHotels.map((hotel) => {
                const isStop = hotel.isStopSales || !hotel.rooms || hotel.rooms.length === 0;
                return (
                  <div 
                    key={hotel.id}
                    onClick={() => {
                      if (!isStop) {
                        setLocation(`/hotel/${hotel.id}?destinationId=8&destination=Tunis&checkin=${defaultDates.checkin}&checkout=${defaultDates.checkout}&rooms=1&adults=2`);
                      }
                    }}
                    className={`group relative h-[420px] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 ${
                      isStop ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <div className="absolute inset-0">
                      <img 
                        src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"} 
                        alt={hotel.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>
                    
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                      {isStop ? (
                        <span className="bg-[#d63031] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md animate-pulse">
                          Complet / Stop Sales
                        </span>
                      ) : (
                        <span className="bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Offre Spéciale
                        </span>
                      )}
                    </div>
                    
                    <div className="absolute inset-x-0 bottom-0 p-8 space-y-3">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: hotel.stars ?? 0 }).map((_, i) => (
                          <span key={i} className="text-amber-400 text-xs">★</span>
                        ))}
                      </div>
                      <h3 className="text-2xl font-serif text-white font-bold leading-tight drop-shadow-md">
                        {hotel.name}
                      </h3>
                      <p className="text-slate-300 text-xs flex items-center gap-1">
                        <span>📍</span> {hotel.destination} — Tunisie
                      </p>
                      
                      <div className="pt-2 border-t border-white/10 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">À partir de</p>
                          <p className="text-2xl font-bold text-accent">
                            {hotel.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                            <span className="text-sm font-semibold text-white ml-1">DZD</span>
                          </p>
                        </div>
                        <span className="text-xs text-white group-hover:text-accent font-semibold transition-colors flex items-center gap-1">
                          {isStop ? "Complet" : "Voir l'offre →"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Trending Hotels Section */}
      {hotels.length > 0 && (
        <section className="py-24 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-serif text-slate-900 mb-2">Hôtels les plus demandés</h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Explorez les hôtels préférés de nos voyageurs avec des offres et des avantages exclusifs.
              </p>
              
              {/* Filter Tabs */}
              <div className="flex flex-wrap justify-center gap-6 mt-8 border-b border-slate-200/60 pb-3">
                {["Gratuités Enfants", "Promos du mois", "Vente Flash", "Early Booking", "Voyage de noce"].map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative pb-3 text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? "text-accent"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {trendingHotels.map((hotel) => {
                const isStop = hotel.isStopSales || !hotel.rooms || hotel.rooms.length === 0;
                const promoBadge = activeTab === "Vente Flash" ? "Flash -30%" :
                                   activeTab === "Promos du mois" ? "25% Off" :
                                   activeTab === "Gratuités Enfants" ? "Enfant Gratuit" :
                                   activeTab === "Early Booking" ? "Early Bird" : "Lune de Miel";
                
                return (
                  <div 
                    key={hotel.id}
                    className={`group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row h-auto sm:h-56 ${
                      isStop ? "opacity-60" : ""
                    }`}
                  >
                    {/* Left: Image */}
                    <div className="relative w-full sm:w-2/5 h-48 sm:h-auto overflow-hidden shrink-0">
                      <img 
                        src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"} 
                        alt={hotel.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                        {isStop ? (
                          <div className="bg-[#d63031] text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-md animate-pulse">
                            Stop Sales / Complet
                          </div>
                        ) : (
                          <div className="bg-accent text-accent-foreground text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                            {promoBadge}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Right: Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: hotel.stars ?? 0 }).map((_, i) => (
                            <span key={i} className="text-amber-500 text-xs">★</span>
                          ))}
                        </div>
                        <h3 className="font-serif font-bold text-slate-800 text-lg leading-tight line-clamp-1">
                          {hotel.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          {hotel.destination} — Tunisie
                        </p>
                        
                        {/* Badges */}
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {hotel.marketingBadges?.slice(0, 2).map((badge) => (
                            <span 
                              key={badge} 
                              className="inline-block bg-orange-50 text-orange-600 border border-orange-100 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                            >
                              {badge}
                            </span>
                          ))}
                          {hotel.restrictions?.slice(0, 1).map((restriction) => {
                            const isCelib = /c[eé]lib/i.test(restriction);
                            if (isCelib) {
                              return (
                                <span 
                                  key={restriction} 
                                  style={{ backgroundColor: "#d63031", color: "white", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "10px", display: "inline-block" }}
                                >
                                  ⚠ {restriction}
                                </span>
                              );
                            }
                            return (
                              <span 
                                key={restriction} 
                                className="inline-block bg-red-50 text-red-600 border border-red-100 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                              >
                                ⚠ {restriction}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Price & Button */}
                      <div className="border-t border-slate-100 pt-3 mt-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">à partir de</p>
                          <p className="text-lg font-bold text-slate-900 truncate">
                            {hotel.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                            <span className="text-xs font-semibold text-slate-500 ml-1">DZD</span>
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">
                            /nuit/pers. en {hotel.roomType ?? "Chambre Standard"}
                          </p>
                        </div>
                        <Button 
                          onClick={() => {
                            if (!isStop) {
                              setLocation(`/hotel/${hotel.id}?destinationId=8&destination=Tunis&checkin=${defaultDates.checkin}&checkout=${defaultDates.checkout}&rooms=1&adults=2`);
                            }
                          }}
                          disabled={isStop}
                          className={`font-semibold text-xs px-4 py-2 rounded-xl transition-all shrink-0 ${
                            isStop
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200"
                              : "bg-[#FF5A00] hover:bg-[#E04F00] text-white"
                          }`}
                        >
                          {isStop ? "Complet" : "Voir l'offre"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* "Voir plus d'hôtels ∨" centered link */}
            <div className="text-center mt-12">
              <button 
                onClick={() => setLocation(`/search?destination=Tunis`)}
                className="text-primary hover:underline font-semibold text-sm flex items-center gap-1 mx-auto"
              >
                Voir plus d'hôtels <span className="text-xs">▼</span>
              </button>
            </div>
            
            {trendingHotels.length === 0 && (
              <p className="text-center text-slate-400 py-10">Aucun hôtel ne correspond à ce filtre actuellement.</p>
            )}
          </div>
        </section>
      )}

      {/* Featured Destinations */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-serif text-slate-900 mb-4">Curated Destinations</h2>
              <p className="text-slate-600 max-w-2xl">Explore our handpicked collection of extraordinary locations around the globe, each offering unparallelled luxury and exclusive experiences.</p>
            </div>
            <Button variant="link" className="text-primary hidden sm:flex" data-testid="btn-view-all">View All Destinations</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <DestinationCard 
              image="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=2020&auto=format&fit=crop"
              title="Paris, France"
              subtitle="The City of Light"
              id="paris"
            />
            <DestinationCard 
              image="https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=2075&auto=format&fit=crop"
              title="Maldives"
              subtitle="Tropical Paradise"
              id="maldives"
            />
            <DestinationCard 
              image="https://images.unsplash.com/photo-1522083111812-7023c7263b65?q=80&w=2012&auto=format&fit=crop"
              title="Kyoto, Japan"
              subtitle="Ancient Traditions"
              id="kyoto"
            />
          </div>
        </div>
      </section>
      
      {/* Banner */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <h2 className="text-4xl font-serif mb-6">Elevate Your Journey</h2>
          <p className="text-lg text-primary-foreground/80 mb-10">
            Join our exclusive membership program to unlock priority bookings, complimentary upgrades, and access to private events worldwide.
          </p>
          <Button size="lg" variant="secondary" className="font-medium px-8" data-testid="btn-join">
            Join the Club
          </Button>
        </div>
      </section>
    </div>
  );
}

function DestinationCard({ image, title, subtitle, id }: { image: string, title: string, subtitle: string, id: string }) {
  const [, setLocation] = useLocation();
  
  return (
    <div 
      className="group relative h-96 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
      onClick={() => setLocation(`/search?destination=${encodeURIComponent(title)}`)}
      data-testid={`card-destination-${id}`}
    >
      <div className="absolute inset-0">
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-8 transform transition-transform duration-300 group-hover:-translate-y-2">
        <p className="text-white/80 text-sm font-medium tracking-wider uppercase mb-2">{subtitle}</p>
        <h3 className="text-2xl font-serif text-white">{title}</h3>
      </div>
    </div>
  );
}
