import { Link } from "wouter";
import { Plane, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
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
            <Link href="/" className="hover:text-primary transition-colors" data-testid="nav-experiences">Experiences</Link>
            <Link href="/" className="hover:text-primary transition-colors" data-testid="nav-about">About Us</Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">USD / EN</span>
            <Button variant="outline" size="sm" className="hidden lg:flex" data-testid="btn-login">
              <User className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button size="sm" className="hidden sm:flex" data-testid="btn-book">Book Now</Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" data-testid="btn-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
