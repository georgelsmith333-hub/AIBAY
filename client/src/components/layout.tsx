import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  BarChart3,
  Zap,
  TrendingUp,
  Users,
  Grid3X3,
  Search,
  History,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Moon,
  Sun,
  BookMarked,
  ScanLine,
  Star,
  Globe,
  Calculator,
  ShoppingBag,
  Layers,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RESEARCH_NAV = [
  { href: "/market-research", label: "Market Research", icon: BarChart3 },
  { href: "/turbo-scanner", label: "Turbo Scanner", icon: ScanLine },
  { href: "/trending", label: "Trending Items", icon: TrendingUp },
  { href: "/top-sellers", label: "Top Sellers", icon: Users },
  { href: "/categories", label: "Category Analytics", icon: Grid3X3 },
];

const TOOLS_NAV = [
  { href: "/generate", label: "Listing Generator", icon: Zap },
  { href: "/supplier", label: "Supplier Intelligence", icon: ShoppingBag },
  { href: "/supplier-finder", label: "Supplier Finder", icon: Globe },
  { href: "/calculator", label: "Profit Calculator", icon: Calculator },
  { href: "/templates", label: "Templates", icon: Layers },
  { href: "/keywords", label: "Keyword Tool", icon: Search },
];

const LIBRARY_NAV = [
  { href: "/history", label: "History", icon: History },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];

interface NavGroupProps {
  title: string;
  items: { href: string; label: string; icon: any }[];
  currentPath: string;
  defaultOpen?: boolean;
}

function NavGroup({ title, items, currentPath, defaultOpen = true }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasActive = items.some((i) => i.href === currentPath);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {open && (
        <div className="space-y-0.5">
          {items.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg mx-1 transition-all duration-150 group cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm nav-active-glow"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                    )}
                  />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aibay-theme", next ? "dark" : "light");
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed md:sticky top-0 h-screen w-64 flex flex-col z-40 transition-transform duration-200",
          "bg-sidebar border-r border-sidebar-border",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border flex-shrink-0">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              {/* AIBAY Logo Mark */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                <span className="text-white font-display font-black text-xs tracking-tight">AI</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display font-black text-lg tracking-tight text-white">
                  AI<span className="text-blue-400">BAY</span>
                </span>
                <span className="text-[9px] text-sidebar-foreground/40 font-medium tracking-widest uppercase">
                  eBay Intelligence
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
          <NavGroup title="Research" items={RESEARCH_NAV} currentPath={location} defaultOpen={true} />
          <NavGroup title="Tools" items={TOOLS_NAV} currentPath={location} defaultOpen={true} />
          <NavGroup title="Library" items={LIBRARY_NAV} currentPath={location} defaultOpen={true} />
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Star className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-sidebar-foreground/80">AIBAY Pro</p>
              <p className="text-[10px] text-sidebar-foreground/40">All features unlocked</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleDark}
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="text-foreground/70">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-display font-black text-[9px]">AI</span>
            </div>
            <span className="font-display font-black text-base text-foreground">
              AI<span className="text-primary">BAY</span>
            </span>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={toggleDark}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
