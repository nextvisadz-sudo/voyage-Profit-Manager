import { Link } from "wouter";
import { User, LogOut, Shield, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <img src="/logo.png" alt="Next Visa Travel" className="h-8" />
            <span className="font-serif font-bold text-xl text-primary tracking-tight hidden sm:inline-block">Next Visa Travel</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground ml-6">
            <Link href="/" className="hover:text-primary transition-colors" data-testid="nav-destinations">Destinations</Link>
            <Link href="/search" className="hover:text-primary transition-colors" data-testid="nav-hotels">Hotels & Resorts</Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1 flex items-center gap-1">
                  {user.role === "admin" ? <Shield className="w-3.5 h-3.5 text-primary" /> : <Compass className="w-3.5 h-3.5 text-teal-600" />}
                  {user.username}
                </span>
                
                {user.role === "admin" ? (
                  <Link href="/admin/dashboard">
                    <Button variant="ghost" size="sm" className="text-xs hover:text-primary">
                      Admin Panel
                    </Button>
                  </Link>
                ) : (
                  <Link href="/agent/dashboard">
                    <Button variant="ghost" size="sm" className="text-xs hover:text-primary">
                      Espace Agent
                    </Button>
                  </Link>
                )}

                <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50">
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Déconnexion
                </Button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" size="sm" data-testid="btn-login">
                    <User className="w-4 h-4 mr-2" />
                    Connexion
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

