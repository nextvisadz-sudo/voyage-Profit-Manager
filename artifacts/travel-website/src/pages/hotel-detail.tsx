import { useParams, useLocation } from "wouter";
import { useSearchHotels } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Star, Check, Wifi, Coffee, Dumbbell, Car, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HotelDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  
  // We use useSearchHotels without params to get cached data, 
  // or fetch if not available (in a real app we'd have a useGetHotel hook)
  const { data: searchResults, isLoading } = useSearchHotels();
  
  const hotel = searchResults?.hotels?.find(h => h.id === id);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-32 w-full mt-6" />
          </div>
          <div>
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-serif text-slate-800 mb-4">Hotel not found</h2>
        <p className="text-slate-500 mb-8">The property you're looking for doesn't exist or is currently unavailable.</p>
        <Button onClick={() => setLocation("/search")}>Return to Search</Button>
      </div>
    );
  }

  const defaultAmenities = [
    { name: "Free High-Speed WiFi", icon: <Wifi className="w-5 h-5 text-primary" /> },
    { name: "Gourmet Breakfast", icon: <Coffee className="w-5 h-5 text-primary" /> },
    { name: "Fitness Center", icon: <Dumbbell className="w-5 h-5 text-primary" /> },
    { name: "Valet Parking", icon: <Car className="w-5 h-5 text-primary" /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Header Image */}
      <div className="h-[40vh] md:h-[60vh] relative">
        <img 
          src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop"} 
          alt={hotel.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" size="sm" className="bg-white/90 backdrop-blur border-transparent hover:bg-white" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-4 pb-8 md:pb-12 text-white">
          <div className="flex items-center gap-2 mb-3">
            {Array.from({ length: hotel.stars || 0 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-accent text-accent" />
            ))}
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-medium mb-2">{hotel.name}</h1>
          <p className="flex items-center text-slate-200 text-lg">
            <MapPin className="w-5 h-5 mr-2" />
            {hotel.destination}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h2 className="text-2xl font-serif text-slate-900 mb-6">About the Property</h2>
              <p className="text-slate-600 leading-relaxed text-lg font-light">
                {hotel.description || `Experience unparalleled luxury at ${hotel.name}, situated in the heart of ${hotel.destination}. This premium property offers world-class amenities, exquisite dining options, and breathtaking views, ensuring a truly memorable stay for discerning travelers seeking the very best.`}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-slate-900 mb-6">Premium Amenities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {defaultAmenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      {amenity.icon}
                    </div>
                    <span className="font-medium text-slate-700">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sticky top-24">
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 uppercase tracking-wider mb-1 font-semibold">{hotel.roomType || "Standard Room"}</p>
                  <p className="text-3xl font-serif text-primary" data-testid="text-detail-price">
                    ${hotel.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">per night, taxes included</p>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-2 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-lg mb-0.5">
                    <Star className="w-4 h-4 fill-primary" />
                    {hotel.rating?.toFixed(1) || "5.0"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold">{hotel.reviewCount || 124} Reviews</div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">Free Cancellation</p>
                    <p className="text-sm text-slate-500">Up to 24 hours before check-in</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">No Booking Fees</p>
                    <p className="text-sm text-slate-500">You only pay for your stay</p>
                  </div>
                </div>
              </div>

              <Button size="lg" className="w-full text-lg h-14 bg-accent hover:bg-accent/90 text-accent-foreground" data-testid="btn-book-now">
                Reserve Now
              </Button>
              <p className="text-center text-xs text-slate-400 mt-4">You won't be charged yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
