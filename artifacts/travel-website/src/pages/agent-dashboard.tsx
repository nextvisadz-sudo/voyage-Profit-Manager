import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileDown, Calendar, Users, MapPin, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Voucher {
  reference: string;
  hotelName: string;
  destination: string;
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  children: number;
  guests: string[];
  roomCategory: string;
  boardType: string;
  markedUpPrice: number;
}

export default function AgentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);
  const [downloadingRef, setDownloadingRef] = useState<string | null>(null);

  // Guard: Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        variant: "destructive",
        title: "Accès refusé",
        description: "Veuillez vous connecter pour accéder à l'espace agent.",
      });
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  // Fetch bookings list
  const fetchVouchers = async () => {
    try {
      const response = await fetch("/api/vouchers");
      if (response.ok) {
        const data = await response.json();
        setVouchers(data.vouchers || []);
      } else {
        throw new Error("Impossible de charger l'historique.");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err.message || "Échec de récupération des données.",
      });
    } finally {
      setVouchersLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVouchers();
    }
  }, [user]);

  const handleDownload = async (ref: string) => {
    setDownloadingRef(ref);
    try {
      const response = await fetch(`/api/vouchers/download/${ref}`);
      if (!response.ok) throw new Error("Échec du téléchargement du PDF.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `voucher-${ref}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Succès",
        description: `Le bon ${ref} a été téléchargé avec succès.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err.message || "Impossible de récupérer le voucher PDF.",
      });
    } finally {
      setDownloadingRef(null);
    }
  };

  if (authLoading || vouchersLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 space-y-8">
        <Skeleton className="h-10 w-1/3 animate-pulse" />
        <Skeleton className="h-64 w-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Espace Agent & Partenaire</h1>
          <p className="text-muted-foreground mt-1">Recherchez et gérez les réservations avec vos commissions intégrées.</p>
        </div>
        <Link href="/">
          <Button className="gap-2 bg-primary hover:bg-primary/95 text-white font-semibold">
            <Search className="w-4 h-4" />
            Nouvelle recherche
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Historique de vos réservations</CardTitle>
            <CardDescription>Consultez et téléchargez vos vouchers au format officiel Next Visa Travel.</CardDescription>
          </CardHeader>
          <CardContent>
            {vouchers.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-700 font-semibold">Aucune réservation trouvée</p>
                <p className="text-slate-400 text-xs mt-1">Les réservations effectuées par votre compte apparaîtront ici.</p>
                <Link href="/">
                  <Button variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/5">
                    Trouver un hôtel
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Référence</TableHead>
                      <TableHead className="font-semibold text-slate-700">Hôtel / Destination</TableHead>
                      <TableHead className="font-semibold text-slate-700">Séjour</TableHead>
                      <TableHead className="font-semibold text-slate-700">Voyageurs</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Montant (TTC)</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((voucher) => (
                      <TableRow key={voucher.reference} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono font-bold text-primary">
                          {voucher.reference}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{voucher.hotelName}</div>
                          <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {voucher.destination}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600 font-medium">
                            {new Date(voucher.checkin).toLocaleDateString("fr-FR")} au {new Date(voucher.checkout).toLocaleDateString("fr-FR")}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {voucher.nights} nuit(s)
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-700 font-medium">
                            {voucher.adults} Adt {voucher.children > 0 ? `+ ${voucher.children} Enf` : ""}
                          </div>
                          <div className="text-slate-400 text-[10px] truncate max-w-[150px] mt-0.5">
                            {voucher.guests.join(", ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {voucher.markedUpPrice.toLocaleString("fr-DZ")} DA
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/reservation/${voucher.reference}`}>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/5">
                                Voir
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleDownload(voucher.reference)}
                              disabled={downloadingRef === voucher.reference}
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-slate-200 hover:bg-slate-50"
                            >
                              {downloadingRef === voucher.reference ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
