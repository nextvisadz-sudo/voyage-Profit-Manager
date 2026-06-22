import { Link, useLocation } from "wouter";
import { Home, Percent, Plane } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/commission", label: "Commission", icon: Percent },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col border-r border-sidebar-border">
        <div className="p-4 md:p-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <Plane className="w-6 h-6" />
          </div>
          <span className="font-semibold text-xl tracking-tight">Next Visa Admin</span>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location === link.href ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )} data-testid={`link-nav-${link.label.toLowerCase()}`}>
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
