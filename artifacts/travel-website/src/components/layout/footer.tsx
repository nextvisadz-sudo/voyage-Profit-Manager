import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 py-16 border-t border-slate-900 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-6" data-testid="footer-logo">
              <img src="/logo.png" alt="Next Visa Travel" className="h-8 brightness-0 invert opacity-90" />
            </Link>
            <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
              Curated luxury travel experiences for the discerning explorer. Discover the world's most extraordinary destinations.
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-50 font-serif font-medium mb-6 uppercase tracking-wider text-sm">Destinations</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Europe</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Asia</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Americas</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Middle East</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-slate-50 font-serif font-medium mb-6 uppercase tracking-wider text-sm">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Press</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Travel Blog</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-slate-50 font-serif font-medium mb-6 uppercase tracking-wider text-sm">Support</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Next Visa Travel. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">Instagram</Link>
            <Link href="/" className="hover:text-white transition-colors">Twitter</Link>
            <Link href="/" className="hover:text-white transition-colors">LinkedIn</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
