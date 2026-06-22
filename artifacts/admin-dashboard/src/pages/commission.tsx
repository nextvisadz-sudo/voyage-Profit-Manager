import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetCommission, useUpdateCommission, getGetCommissionQueryKey, getGetCommissionStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";

const formSchema = z.object({
  percent: z.coerce.number().min(0, "Must be at least 0").max(100, "Cannot exceed 100"),
});

export default function CommissionPage() {
  const { data: commission, isLoading } = useGetCommission();
  const updateCommission = useUpdateCommission();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      percent: 0,
    },
  });

  useEffect(() => {
    if (commission?.percent !== undefined) {
      form.reset({ percent: commission.percent });
    }
  }, [commission, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateCommission.mutate({ data: { percent: values.percent } }, {
      onSuccess: () => {
        toast({
          title: "Commission Updated",
          description: `Commission successfully set to ${values.percent}%`,
        });
        queryClient.invalidateQueries({ queryKey: getGetCommissionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCommissionStatsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to update commission.",
          variant: "destructive",
        });
      }
    });
  };

  const currentPercent = form.watch("percent");
  
  const sampleOriginal = 30000;
  const sampleFinal = useMemo(() => {
    const p = isNaN(currentPercent) ? 0 : currentPercent;
    return Math.round(sampleOriginal * (1 + p / 100));
  }, [currentPercent]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="heading-commission">Commission Settings</h1>
        <p className="text-muted-foreground mt-2">Adjust the global profit margin applied to all hotel bookings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Margin</CardTitle>
          <CardDescription>
            This percentage is applied to the original hotel price before displaying it to the customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Percentage (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" max="100" {...field} data-testid="input-commission-percent" />
                    </FormControl>
                    <FormDescription>
                      Enter a value between 0 and 100. Decimal values are allowed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="p-4 bg-muted rounded-md space-y-2">
                <p className="text-sm font-medium">Live Preview</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Original Price:</span>
                  <span className="font-mono">{sampleOriginal.toLocaleString("fr-DZ")} DA</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Customer Pays:</span>
                  <span className="font-mono text-primary" data-testid="text-preview-customer-pays">{sampleFinal.toLocaleString("fr-DZ")} DA</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {commission?.updatedAt ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="text-last-updated">
                    <Clock className="w-3.5 h-3.5" />
                    Last updated: {format(new Date(commission.updatedAt), "PPp")}
                  </div>
                ) : <div />}
                <Button type="submit" disabled={updateCommission.isPending || isLoading} data-testid="button-save-commission">
                  {updateCommission.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
