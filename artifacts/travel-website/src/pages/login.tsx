import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Shield, User, Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { user, login, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to correct dashboard
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/agent/dashboard");
      }
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez saisir votre nom d'utilisateur et votre mot de passe.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login(username, password);
      toast({
        title: "Connexion réussie",
        description: `Bienvenue, ${loggedUser.username} !`,
      });
      if (loggedUser.role === "admin") {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/agent/dashboard");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Échec de la connexion",
        description: err.message || "Identifiants incorrects.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (role: "admin" | "agent") => {
    setIsSubmitting(true);
    const u = role === "admin" ? "admin" : "agent";
    const p = role === "admin" ? "admin123" : "agent123";
    try {
      const loggedUser = await login(u, p);
      toast({
        title: "Connexion rapide",
        description: `Connecté en tant que ${loggedUser.username} (${loggedUser.role})`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err.message || "Une erreur est survenue.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(18,96,112,0.15),rgba(255,255,255,0))]" />
      
      <Card className="w-full max-w-md shadow-xl border-slate-200/80 bg-white/80 backdrop-blur-md relative z-10">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif font-bold text-slate-900">Espace Connexion</CardTitle>
          <CardDescription>
            Connectez-vous pour gérer vos réservations et marges.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="admin / agent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                />
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 font-semibold text-sm transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
            
            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Rôles de démo</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickLogin("admin")}
                className="h-10 hover:bg-slate-50 border-slate-200"
                disabled={isSubmitting}
              >
                Admin (Markup)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickLogin("agent")}
                className="h-10 hover:bg-slate-50 border-slate-200"
                disabled={isSubmitting}
              >
                Agent (Booking)
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
