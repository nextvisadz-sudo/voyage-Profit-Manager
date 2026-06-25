import { useGetCommissionStats, useGetCommission, useUpdateCommission, getGetCommissionQueryKey, getGetCommissionStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Percent, Search, Hotel, Clock, Upload, FileDown, Loader2, Save, KeyRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState, useRef, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  percent: z.coerce.number().min(0, "Doit être au moins 0").max(100, "Ne peut pas dépasser 100"),
});

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetCommissionStats();
  const { data: commission, isLoading: commLoading } = useGetCommission();
  const updateCommission = useUpdateCommission();

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = statsLoading || commLoading || authLoading;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      percent: 0,
    },
  });

  // Guard: Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      toast({
        variant: "destructive",
        title: "Accès refusé",
        description: "Vous devez être administrateur pour accéder à cette page.",
      });
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (commission?.percent !== undefined) {
      form.reset({ percent: commission.percent });
    }
  }, [commission, form]);

  const onSubmitCommission = (values: z.infer<typeof formSchema>) => {
    updateCommission.mutate({ data: { percent: values.percent } }, {
      onSuccess: () => {
        toast({
          title: "Commission mise à jour",
          description: `La marge globale a été fixée à ${values.percent}%`,
        });
        queryClient.invalidateQueries({ queryKey: getGetCommissionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCommissionStatsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Erreur",
          description: "Échec de la mise à jour de la commission.",
          variant: "destructive",
        });
      }
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        variant: "destructive",
        title: "Format invalide",
        description: "Veuillez sélectionner un fichier PDF uniquement.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/vouchers/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file,
      });

      if (!response.ok) {
        let errMsg = "Erreur lors du traitement du fichier.";
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "voucher-nextvisa.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Succès",
        description: "Voucher traité et téléchargé avec succès !",
      });
      // Refresh stats
      queryClient.invalidateQueries({ queryKey: getGetCommissionStatsQueryKey() });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur de traitement",
        description: error.message || "Impossible de traiter le fichier PDF.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const currentPercent = form.watch("percent");
  
  const sampleOriginal = 30000;
  const sampleFinal = useMemo(() => {
    const p = isNaN(currentPercent) ? 0 : currentPercent;
    return Math.round(sampleOriginal * (1 + p / 100));
  }, [currentPercent]);

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 space-y-8">
        <Skeleton className="h-10 w-1/3 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full animate-pulse" />
          <Skeleton className="h-32 w-full animate-pulse" />
          <Skeleton className="h-32 w-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground" data-testid="heading-dashboard">
          Tableau de bord Administrateur
        </h1>
        <p className="text-muted-foreground mt-2">Mesures clés, paramètres de marge et conversion de vouchers.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recherches Totales</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-searches">{stats?.totalSearches ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">Requêtes traitées sur la plateforme</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hôtels Servis</CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-hotels-served">{stats?.totalHotelsServed ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">Hôtels affichés dans les résultats</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge Actuelle</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-current-commission">{commission?.percent ?? 0}%</div>
            {commission?.updatedAt && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Mise à jour: {format(new Date(commission.updatedAt), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {stats?.lastSearchAt && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-teal-600" />
            <div>
              <p className="text-sm font-medium text-slate-800">Dernière activité</p>
              <p className="text-xs text-slate-500" data-testid="text-last-search">
                Dernière recherche effectuée le {format(new Date(stats.lastSearchAt), "dd/MM/yyyy à HH:mm:ss")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Commission settings */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Marge Commerciale Globale</CardTitle>
            <CardDescription>
              Ce pourcentage est appliqué automatiquement aux tarifs H24Voyages d'origine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCommission)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de commission (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" min="0" max="100" {...field} data-testid="input-commission-percent" />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-400">
                        Saisissez une valeur entre 0 et 100.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Aperçu direct (Simulation)</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Prix Fournisseur:</span>
                    <span className="font-mono text-slate-700">30 000 DA</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold border-t border-dashed border-slate-200 pt-2">
                    <span className="text-slate-800">Prix avec Marge client:</span>
                    <span className="font-mono text-primary" data-testid="text-preview-customer-pays">
                      {sampleFinal.toLocaleString("fr-DZ")} DA
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateCommission.isPending} data-testid="button-save-commission">
                    {updateCommission.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Sauvegarder
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* PDF Converter */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Upload className="w-5 h-5 text-primary" />
              Convertisseur de Vouchers PDF
            </CardTitle>
            <CardDescription>
              Téléversez un bon de réservation fournisseur externe pour générer instantanément le PDF officiel Next Visa Travel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              La conversion extrait dynamiquement le nom de l'hôtel, l'adresse, les dates, les chambres et le nom de l'ensemble des passagers, en appliquant automatiquement la marge active de la plateforme.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept="application/pdf"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 cursor-pointer h-11"
              data-testid="btn-upload-voucher"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Conversion en cours...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Sélectionner et convertir le PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
