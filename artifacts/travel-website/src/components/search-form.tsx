import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Users, Search, ChevronDown, Plus, Minus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetDestinations } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  destinationId: z.string().min(1, "Destination requise"),
  checkin: z.date({ required_error: "Date d'arrivée requise" }),
  checkout: z.date({ required_error: "Date de départ requise" }),
}).refine((data) => data.checkin < data.checkout, {
  message: "La date de départ doit être après la date d'arrivée",
  path: ["checkout"],
});

type SearchFormValues = z.infer<typeof searchSchema>;

interface RoomConfig {
  adults: number;
  children: number;
  infants: number;
}

interface SearchFormProps {
  initialValues?: {
    destinationId?: string;
    checkin?: Date;
    checkout?: Date;
    adults?: string;
    rooms?: string;
    children?: string;
    infants?: string;
  };
  onSubmit: (values: {
    destinationId: number;
    destination: string;
    checkin: string;
    checkout: string;
    adults: number;
    rooms: number;
    children: number;
    infants: number;
  }) => void;
}

function Counter({
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-5 text-center font-semibold text-slate-800 text-sm">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function OccupancyPopover({
  roomsConfig,
  onChange,
}: {
  roomsConfig: RoomConfig[];
  onChange: (rooms: RoomConfig[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalAdults = roomsConfig.reduce((s, r) => s + r.adults, 0);
  const totalChildren = roomsConfig.reduce((s, r) => s + r.children, 0);
  const totalInfants = roomsConfig.reduce((s, r) => s + r.infants, 0);
  const totalGuests = totalAdults + totalChildren + totalInfants;
  const label =
    `${roomsConfig.length} chambre${roomsConfig.length > 1 ? "s" : ""}, ` +
    `${totalAdults} adulte${totalAdults > 1 ? "s" : ""}` +
    (totalChildren > 0 ? `, ${totalChildren} enfant${totalChildren > 1 ? "s" : ""}` : "") +
    (totalInfants > 0 ? `, ${totalInfants} bébé${totalInfants > 1 ? "s" : ""}` : "");

  function updateRoom(idx: number, key: keyof RoomConfig, value: number) {
    const next = roomsConfig.map((r, i) => (i === idx ? { ...r, [key]: value } : r));
    onChange(next);
  }

  function addRoom() {
    if (roomsConfig.length < 4) onChange([...roomsConfig, { adults: 2, children: 0, infants: 0 }]);
  }

  function removeRoom(idx: number) {
    if (roomsConfig.length > 1) onChange(roomsConfig.filter((_, i) => i !== idx));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Users className="w-4 h-4 text-primary shrink-0 opacity-70" />
        <span className="text-base font-medium text-slate-800 truncate">{label}</span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 ml-auto shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-slate-800 text-sm">Chambres et occupation</p>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {roomsConfig.map((room, idx) => (
              <div key={idx} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Chambre {idx + 1}
                  </p>
                  {roomsConfig.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoom(idx)}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Supprimer
                    </button>
                  )}
                </div>
                <Counter
                  label="Adulte(s)"
                  sub="12 ans et plus"
                  value={room.adults}
                  min={1}
                  max={8}
                  onChange={(v) => updateRoom(idx, "adults", v)}
                />
                <div className="border-t border-slate-100" />
                <Counter
                  label="Enfant(s)"
                  sub="2 à 11 ans"
                  value={room.children}
                  min={0}
                  max={6}
                  onChange={(v) => updateRoom(idx, "children", v)}
                />
                <div className="border-t border-slate-100" />
                <Counter
                  label="Bébé(s)"
                  sub="Moins de 2 ans"
                  value={room.infants}
                  min={0}
                  max={4}
                  onChange={(v) => updateRoom(idx, "infants", v)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4">
            {roomsConfig.length < 4 && (
              <button
                type="button"
                onClick={addRoom}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-primary border border-primary/30 rounded-lg py-2 hover:bg-primary/5 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une chambre
              </button>
            )}
            <Button type="button" onClick={() => setOpen(false)} size="sm" className="px-5">
              Valider
            </Button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-3">
            {totalGuests} voyageur{totalGuests > 1 ? "s" : ""} au total
          </p>
        </div>
      )}
    </div>
  );
}

export function SearchForm({ initialValues, onSubmit }: SearchFormProps) {
  const { data: destinations = [] } = useGetDestinations();

  const initRooms = parseInt(initialValues?.rooms ?? "1");
  const initAdults = parseInt(initialValues?.adults ?? "2");
  const initChildren = parseInt(initialValues?.children ?? "0");
  const initInfants = parseInt(initialValues?.infants ?? "0");

  const [roomsConfig, setRoomsConfig] = useState<RoomConfig[]>(() => {
    const rooms: RoomConfig[] = [];
    const adultsPerRoom = Math.max(1, Math.round(initAdults / Math.max(1, initRooms)));
    for (let i = 0; i < initRooms; i++) {
      rooms.push({
        adults: adultsPerRoom,
        children: i === 0 ? initChildren : 0,
        infants: i === 0 ? initInfants : 0,
      });
    }
    return rooms;
  });

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      destinationId: initialValues?.destinationId || "8",
      checkin: initialValues?.checkin || new Date(Date.now() + 86400000 * 7),
      checkout: initialValues?.checkout || new Date(Date.now() + 86400000 * 14),
    },
  });

  // Watch values for reactive date adjustments
  const checkinValue = form.watch("checkin");
  const checkoutValue = form.watch("checkout");

  useEffect(() => {
    if (checkinValue) {
      const minCheckout = new Date(checkinValue);
      minCheckout.setHours(0, 0, 0, 0);

      if (!checkoutValue || checkoutValue <= minCheckout) {
        const newCheckout = new Date(checkinValue);
        newCheckout.setDate(checkinValue.getDate() + 1);
        form.setValue("checkout", newCheckout);
      }
    }
  }, [checkinValue, checkoutValue, form]);

  // Sync state when initialValues change
  const initialDestId = initialValues?.destinationId;
  const initialCheckin = initialValues?.checkin;
  const initialCheckout = initialValues?.checkout;
  const initialAdults = initialValues?.adults;
  const initialRooms = initialValues?.rooms;
  const initialChildren = initialValues?.children;
  const initialInfants = initialValues?.infants;

  useEffect(() => {
    form.reset({
      destinationId: initialDestId || "8",
      checkin: initialCheckin || new Date(Date.now() + 86400000 * 7),
      checkout: initialCheckout || new Date(Date.now() + 86400000 * 14),
    });

    const parsedRooms = parseInt(initialRooms ?? "1");
    const parsedAdults = parseInt(initialAdults ?? "2");
    const parsedChildren = parseInt(initialChildren ?? "0");
    const parsedInfants = parseInt(initialInfants ?? "0");

    const rooms: RoomConfig[] = [];
    const adultsPerRoom = Math.max(1, Math.round(parsedAdults / Math.max(1, parsedRooms)));
    for (let i = 0; i < parsedRooms; i++) {
      rooms.push({
        adults: adultsPerRoom,
        children: i === 0 ? parsedChildren : 0,
        infants: i === 0 ? parsedInfants : 0,
      });
    }
    setRoomsConfig(rooms);
  }, [initialDestId, initialCheckin, initialCheckout, initialAdults, initialRooms, initialChildren, initialInfants, form]);

  const handleSubmit = (data: SearchFormValues) => {
    const dest = destinations.find((d) => String(d.id) === data.destinationId);
    const totalAdults = roomsConfig.reduce((s, r) => s + r.adults, 0);
    const totalChildren = roomsConfig.reduce((s, r) => s + r.children, 0);
    const totalInfants = roomsConfig.reduce((s, r) => s + r.infants, 0);
    onSubmit({
      destinationId: Number(data.destinationId),
      destination: dest?.city ?? "",
      checkin: format(data.checkin, "yyyy-MM-dd"),
      checkout: format(data.checkout, "yyyy-MM-dd"),
      adults: totalAdults,
      rooms: roomsConfig.length,
      children: totalChildren,
      infants: totalInfants,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="bg-white p-2 md:p-3 rounded-lg flex flex-col md:flex-row gap-2"
        data-testid="form-search"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 flex-1">
          {/* Destination */}
          <FormField
            control={form.control}
            name="destinationId"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100">
                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Destination</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 text-base font-medium" data-testid="select-destination">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-primary shrink-0 opacity-70" />
                        <SelectValue placeholder="Choisir une destination" />
                      </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 relative after:content-[''] after:hidden md:after:block after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-px after:bg-slate-200 before:content-[''] before:hidden md:before:block before:absolute before:right-0 before:top-1/4 before:bottom-1/4 before:w-px before:bg-slate-200">
            <FormField
              control={form.control}
              name="checkin"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Arrivée</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-left font-medium p-0 h-auto hover:bg-transparent",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="btn-checkin"
                        >
                          <CalendarIcon className="w-4 h-4 text-primary mr-2 opacity-70" />
                          {field.value ? format(field.value, "d MMM yyyy") : <span>Date d'arrivée</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border border-slate-200/80 backdrop-blur" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="checkout"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border-l border-l-slate-100 md:border-l-transparent">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Départ</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-left font-medium p-0 h-auto hover:bg-transparent",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="btn-checkout"
                        >
                          <CalendarIcon className="w-4 h-4 text-primary mr-2 opacity-70" />
                          {field.value ? format(field.value, "d MMM yyyy") : <span>Date de départ</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl shadow-2xl border border-slate-200/80 backdrop-blur" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        disabled={(date) => {
                          const checkinDate = form.getValues("checkin") || new Date();
                          const minCheckout = new Date(checkinDate);
                          minCheckout.setHours(0, 0, 0, 0);
                          return date <= minCheckout;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Chambres et occupation */}
          <div className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Chambres et occupation</p>
            <OccupancyPopover roomsConfig={roomsConfig} onChange={setRoomsConfig} />
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md h-auto px-8 md:ml-2 mt-4 md:mt-0"
          data-testid="btn-submit-search"
        >
          <Search className="w-5 h-5 mr-2" />
          Rechercher
        </Button>
      </form>
    </Form>
  );
}
