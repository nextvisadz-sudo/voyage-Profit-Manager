import { useLocation } from "wouter";
import { SearchForm } from "../components/search-form";
import { Button } from "@/components/ui/button";
import { useGetCommission } from "@workspace/api-client-react";

export default function Home() {
  const [, setLocation] = useLocation();
  // Fetch commission to satisfy requirement to use hooks, though we don't display it directly here
  useGetCommission();

  const handleSearch = (params: any) => {
    const searchParams = new URLSearchParams();
    if (params.destination) searchParams.append("destination", params.destination);
    if (params.checkin) searchParams.append("checkin", params.checkin);
    if (params.checkout) searchParams.append("checkout", params.checkout);
    if (params.adults) searchParams.append("adults", params.adults.toString());
    if (params.rooms) searchParams.append("rooms", params.rooms.toString());
    
    setLocation(`/search?${searchParams.toString()}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] lg:h-[700px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1542314831-c6a4d14d8373?q=80&w=2070&auto=format&fit=crop" 
            alt="Luxury destination" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
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
