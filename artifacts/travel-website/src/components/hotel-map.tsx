import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface HotelMapProps {
  lat?: number;
  long?: number;
  hotelName: string;
}

// Leaflet default icons can be broken in Vite builds, so we use CDN assets explicitly
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export function HotelMap({ lat, long, hotelName }: HotelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const latitude = lat ?? 36.8065;
    const longitude = long ?? 10.1815;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 14,
      scrollWheelZoom: false,
    });

    mapRef.current = map;

    // Add Tile Layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add Marker
    L.marker([latitude, longitude], { icon: defaultIcon })
      .addTo(map)
      .bindPopup(hotelName)
      .openPopup();

    // Trigger map invalidation to make sure tiles align correctly on load
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, long, hotelName]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-[250px] md:h-[300px] rounded-xl overflow-hidden border border-slate-200 shadow-inner z-10" 
    />
  );
}
