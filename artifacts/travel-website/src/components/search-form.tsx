import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Users, DoorOpen, Search, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetDestinations } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  destinationId: z.string().min(1, "Destination requise"),
  checkin: z.date({ required_error: "Date d'arrivée requise" }),
  checkout: z.date({ required_error: "Date de départ requise" }),
  adults: z.string().default("2"),
  rooms: z.string().default("1"),
}).refine((data) => data.checkin < data.checkout, {
  message: "La date de départ doit être après la date d'arrivée",
  path: ["checkout"],
});

type SearchFormValues = z.infer<typeof searchSchema>;

interface SearchFormProps {
  initialValues?: {
    destinationId?: string;
    checkin?: Date;
    checkout?: Date;
    adults?: string;
    rooms?: string;
  };
  onSubmit: (values: {
    destinationId: number;
    destination: string;
    checkin: string;
    checkout: string;
    adults: number;
    rooms: number;
  }) => void;
}

export function SearchForm({ initialValues, onSubmit }: SearchFormProps) {
  const { data: destinations = [] } = useGetDestinations();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      destinationId: initialValues?.destinationId || "",
      checkin: initialValues?.checkin || new Date(Date.now() + 86400000 * 7),
      checkout: initialValues?.checkout || new Date(Date.now() + 86400000 * 14),
      adults: initialValues?.adults || "2",
      rooms: initialValues?.rooms || "1",
    },
  });

  const handleSubmit = (data: SearchFormValues) => {
    const dest = destinations.find((d) => String(d.id) === data.destinationId);
    onSubmit({
      destinationId: Number(data.destinationId),
      destination: dest?.city ?? "",
      checkin: format(data.checkin, "yyyy-MM-dd"),
      checkout: format(data.checkout, "yyyy-MM-dd"),
      adults: Number(data.adults),
      rooms: Number(data.rooms),
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )}
            />
          </div>

          {/* Guests & Rooms */}
          <div className="grid grid-cols-2">
            <FormField
              control={form.control}
              name="adults"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Adultes</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 text-base font-medium" data-testid="select-guests">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-primary mr-2 opacity-70" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} adulte{n > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rooms"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border-l border-l-slate-100 md:border-l-transparent">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Chambres</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 text-base font-medium" data-testid="select-rooms">
                        <div className="flex items-center">
                          <DoorOpen className="w-4 h-4 text-primary mr-2 opacity-70" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} chambre{n > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
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
