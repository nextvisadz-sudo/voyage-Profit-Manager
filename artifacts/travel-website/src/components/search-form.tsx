import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Calendar as CalendarIcon, MapPin, Users, DoorOpen, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  checkin: z.date({ required_error: "Check-in date is required" }),
  checkout: z.date({ required_error: "Check-out date is required" }),
  adults: z.string().default("2"),
  rooms: z.string().default("1"),
}).refine((data) => data.checkin < data.checkout, {
  message: "Check-out date must be after check-in date",
  path: ["checkout"],
});

type SearchFormValues = z.infer<typeof searchSchema>;

interface SearchFormProps {
  initialValues?: Partial<SearchFormValues>;
  onSubmit: (values: any) => void;
  variant?: "horizontal" | "vertical";
}

export function SearchForm({ initialValues, onSubmit, variant = "horizontal" }: SearchFormProps) {
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      destination: initialValues?.destination || "",
      checkin: initialValues?.checkin || new Date(),
      checkout: initialValues?.checkout || new Date(Date.now() + 86400000 * 2), // +2 days
      adults: initialValues?.adults || "2",
      rooms: initialValues?.rooms || "1",
    },
  });

  const handleSubmit = (data: SearchFormValues) => {
    onSubmit({
      ...data,
      checkin: format(data.checkin, "yyyy-MM-dd"),
      checkout: format(data.checkout, "yyyy-MM-dd"),
    });
  };

  const isVertical = variant === "vertical";

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(handleSubmit)} 
        className={cn(
          "bg-white p-2 md:p-3 rounded-lg flex",
          isVertical ? "flex-col gap-4" : "flex-col md:flex-row gap-2"
        )}
        data-testid="form-search"
      >
        <div className={cn(
          "grid",
          isVertical ? "grid-cols-1 gap-4" : "grid-cols-1 md:grid-cols-4 gap-2 flex-1"
        )}>
          {/* Destination */}
          <FormField
            control={form.control}
            name="destination"
            render={({ field }) => (
              <FormItem className="relative flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100">
                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Destination</FormLabel>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-primary mr-2 opacity-70" />
                  <FormControl>
                    <Input 
                      placeholder="Where to?" 
                      className="border-0 p-0 h-auto focus-visible:ring-0 shadow-none text-base font-medium" 
                      {...field} 
                      data-testid="input-destination"
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 relative after:content-[''] after:hidden md:after:block after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-px after:bg-slate-200 before:content-[''] before:hidden md:before:block before:absolute before:right-0 before:top-1/4 before:bottom-1/4 before:w-px before:bg-slate-200">
            <FormField
              control={form.control}
              name="checkin"
              render={({ field }) => (
                <FormItem className="relative flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check-in</FormLabel>
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
                          {field.value ? format(field.value, "MMM d, yyyy") : <span>Add dates</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="checkout"
              render={({ field }) => (
                <FormItem className="relative flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100 border-l border-l-slate-100 md:border-l-transparent">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check-out</FormLabel>
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
                          {field.value ? format(field.value, "MMM d, yyyy") : <span>Add dates</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
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
                <FormItem className="relative flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Guests</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 text-base font-medium" data-testid="select-guests">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-primary mr-2 opacity-70" />
                          <SelectValue placeholder="Guests" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 Adult</SelectItem>
                      <SelectItem value="2">2 Adults</SelectItem>
                      <SelectItem value="3">3 Adults</SelectItem>
                      <SelectItem value="4">4 Adults</SelectItem>
                      <SelectItem value="5">5 Adults</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rooms"
              render={({ field }) => (
                <FormItem className="relative flex flex-col justify-center px-4 py-2 hover:bg-slate-50 rounded-md transition-colors border border-transparent hover:border-slate-100 border-l border-l-slate-100 md:border-l-transparent">
                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Rooms</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 text-base font-medium" data-testid="select-rooms">
                        <div className="flex items-center">
                          <DoorOpen className="w-4 h-4 text-primary mr-2 opacity-70" />
                          <SelectValue placeholder="Rooms" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 Room</SelectItem>
                      <SelectItem value="2">2 Rooms</SelectItem>
                      <SelectItem value="3">3 Rooms</SelectItem>
                      <SelectItem value="4">4 Rooms</SelectItem>
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
          className={cn(
            "bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md",
            isVertical ? "w-full mt-4" : "h-auto px-8 md:ml-2 mt-4 md:mt-0"
          )}
          data-testid="btn-submit-search"
        >
          <Search className="w-5 h-5 mr-2" />
          Search
        </Button>
      </form>
    </Form>
  );
}
