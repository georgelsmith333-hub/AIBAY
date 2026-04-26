import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Zap, TrendingUp, Users, Search, History,
  Bookmark, ScanLine, ArrowRight, Package, Clock, ExternalLink,
  Sparkles, Eye, Loader2, AlertCircle, CheckCircle, XCircle,
  ShoppingBag, Globe, Calculator, Download, Smartphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Stats {
  totalListings: number;
  totalWatchlist: number;
  totalTrackedSellers: number;
  keywordSearchesToday: number;
  ebayConfigured: boolean;
}

const QUICK_TOOLS = [
  { href: "/market-research", label: "Market Research", icon: BarChart3, color: "from-blue-500 to-blue-600", desc: "Live STR, demand & opportunity scores" },
  { href: "/turbo-scanner", label: "Turbo Scanner", icon: ScanLine, color: "from-violet-500 to-violet-600", desc: "Scan 100+ products by category" },
  { href: "/trending", label: "Trending Now", icon: TrendingUp, color: "from-emerald-500 to-emerald-600", desc: "eBay's hottest items by watch count" },
  { href: "/top-sellers", label: "Top Sellers", icon: Users, color: "from-orange-500 to-orange-600", desc: "Spy on any seller's store & revenue" },
  { href: "/generate", label: "Generate Listing", icon: Zap, color: "from-pink-500 to-pink-600", desc: "AI listing from URL, notes or files" },
  { href: "/keywords", label: "Keyword Tool", icon: Search, color: "from-cyan-500 to-cyan-600", desc: "20 AI keyword variations with STR data" },
];

// Hot sellable niches — always visible to guests, no API key needed
const HOT_CATEGORIES = [
  { label: "Wireless Earbuds", emoji: "🎧", trend: "+34%" },
  { label: "Vintage Cameras", emoji: "📷", trend: "+22%" },
  { label: "Smart Watch", emoji: "⌚", trend: "+41%" },
  { label: "Gaming Chair", emoji: "🎮", trend: "+18%" },
  { label: "LED Strip Lights", emoji: "💡", trend: "+55%" },
  { label: "Protein Powder", emoji: "💪", trend: "+29%" },
  { label: "Lego Sets", emoji: "🧱", trend: "+31%" },
  { label: "Air Fryer", emoji: "🍟", trend: "+47%" },
  { label: "Running Shoes", emoji: "👟", trend: "+26%" },
  { label: "Drone Camera", emoji: "🚁", trend: "+38%" },
  { label: "Portable Charger", emoji: "🔋", trend: "+21%" },
  { label: "Plushie Toys", emoji: "🧸", trend: "+62%" },
];

// 4-step smart workflow
const WORKFLOW_STEPS = [
  { step: 1, icon: Search, label: "Research", desc: "Find trending products & demand", href: "/market-research", color: "bg-blue-500" },
  { step: 2, icon: Globe, label: "Source", desc: "Find cheapest suppliers worldwide", href: "/supplier-finder", color: "bg-orange-500" },
  { step: 3, icon: Zap, label: "Generate", desc: "AI creates your full eBay listing", href: "/generate", color: "bg-pink-500" },
  { step: 4, icon: Calculator, label: "Profit", desc: "Calculate fees & profit margin", href: "/profit-calculator", color: "bg-emerald-500" },
];

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("pwa-dismissed"));
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || dismissed || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Smartphone className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-semibold">Install AIBAY on your device</p>
          <p className="text-xs text-muted-foreground">Works on Android, iOS, Windows &amp; Linux — add it to your home screen for instant access</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleInstall}>
          <Download className="w-3.5 h-3.5" /> Install App
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setDismissed(true); localStorage.setItem("pwa-dismissed", "1"); }}>
          Not now
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Quick Analyzer ───────────────────────────────────────────────────────────
function QuickAnalyzer() {
  const [kw, setKw] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/ebay/search", query],
    queryFn: async () => {
      const res = await fetch(`/api/ebay/search?keyword=${encodeURIComponent(query!)}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    enabled: !!query,
    staleTime: 5 * 60 * 1000,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kw.trim()) return;
    setQuery(kw.trim());
  }

  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-semibold text-sm">Quick Analyzer</span>
        {!ebayStatus?.configured && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">Setup required</Badge>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder='Type any keyword e.g. "AirPods", "vintage camera"'
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          className="h-9 text-sm"
          data-testid="input-quick-analyzer"
        />
        <Button type="submit" size="sm" disabled={isLoading || !kw.trim()} className="h-9 px-4" data-testid="btn-quick-analyze">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </Button>
      </form>

      <AnimatePresence>
        {data && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "STR", value: `${data.sellThroughRate}%`, color: data.sellThroughRate >= 50 ? "text-emerald-500" : data.sellThroughRate >= 25 ? "text-amber-500" : "text-red-500" },
                { label: "Avg Price", value: `$${data.avgSoldPrice.toFixed(0)}`, color: "text-foreground" },
                { label: "Sellers", value: data.uniqueSellers, color: "text-foreground" },
                { label: "Score", value: data.opportunityScore, color: data.opportunityScore >= 70 ? "text-emerald-500" : data.opportunityScore >= 40 ? "text-amber-500" : "text-red-500" },
              ].map((s) => (
                <div key={s.label} className="text-center bg-secondary/40 rounded-lg p-2">
                  <p className={cn("text-lg font-display font-black", s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation(`/market-research?keyword=${encodeURIComponent(query!)}`)}>
                Full Analysis <ArrowRight className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation(`/generate?prefillTitle=${encodeURIComponent(query!)}`)}>
                Generate Listing <Zap className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation(`/supplier-finder?q=${encodeURIComponent(query!)}`)}>
                Find Suppliers <Globe className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
        {error && !isLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5" /> {(error as Error).message}
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  const { data: recentListings, isLoading: loadingListings } = useQuery<any[]>({
    queryKey: ["/api/listings"],
  });

  const { data: hotData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/ebay/trending", "all", "EBAY-US"],
    queryFn: async () => {
      const res = await fetch("/api/ebay/trending?marketplace=EBAY-US");
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const statCards = [
    { key: "totalListings", label: "Listings Generated", icon: Package, color: "text-blue-500 bg-blue-500/10", value: stats?.totalListings ?? 0 },
    { key: "keywordSearchesToday", label: "Searches Today", icon: Search, color: "text-violet-500 bg-violet-500/10", value: stats?.keywordSearchesToday ?? 0 },
    { key: "totalWatchlist", label: "Watchlist Items", icon: Bookmark, color: "text-emerald-500 bg-emerald-500/10", value: stats?.totalWatchlist ?? 0 },
    { key: "totalTrackedSellers", label: "Tracked Sellers", icon: Users, color: "text-orange-500 bg-orange-500/10", value: stats?.totalTrackedSellers ?? 0 },
    {
      key: "hotItems",
      label: "Hot Items Found",
      icon: Eye,
      color: "text-rose-500 bg-rose-500/10",
      value: hotData?.items ? hotData.items.filter((i: any) => i.watchCount >= 5).length : "—",
    },
    {
      key: "ebayStatus",
      label: "eBay API Status",
      icon: stats?.ebayConfigured ? CheckCircle : XCircle,
      color: stats?.ebayConfigured ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10",
      value: stats?.ebayConfigured ? "Live" : "Setup",
      badge: true,
    },
  ];

  const hotItems = hotData?.items?.slice(0, 6) || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── PWA Install Banner ───────────────────────────────────────── */}
        <PwaInstallBanner />

        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl p-7 text-white"
          style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%)" }}
        >
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block animate-pulse" />
                  Live eBay Intelligence
                </Badge>
                <Badge className="bg-white/10 text-white border-white/15 text-xs">Beats ZikAnalytics</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-tight">
                Welcome to <span className="text-blue-200">AI</span>BAY
              </h1>
              <p className="text-blue-100/90 max-w-lg text-sm mt-1.5 leading-relaxed">
                The most powerful eBay intelligence platform. Research → Source → Generate → Profit — all in one place.
              </p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold h-9 text-sm"
                onClick={() => setLocation("/market-research")}
                data-testid="btn-hero-research"
              >
                <BarChart3 className="w-4 h-4 mr-2" /> Start Researching
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 h-9 text-sm"
                onClick={() => setLocation("/generate")}
                data-testid="btn-hero-generate"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Generate a Listing
              </Button>
            </div>
          </div>
          {stats && !stats.ebayConfigured && (
            <div className="relative mt-4 flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-lg px-4 py-2.5 w-fit">
              <span className="text-amber-200 text-sm font-medium">
                ⚡ Add <code className="font-mono text-xs bg-amber-500/30 px-1.5 py-0.5 rounded">EBAY_APP_ID</code> to Secrets to unlock live market data
              </span>
            </div>
          )}
        </motion.div>

        {/* ── 6 Stat Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Card className="p-4 border-border/60 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-1.5">
                  <div className={cn("p-1.5 rounded-md flex-shrink-0", card.color.split(" ")[1])}>
                    <card.icon className={cn("w-3.5 h-3.5", card.color.split(" ")[0])} />
                  </div>
                </div>
                <p className="text-xl font-display font-bold" data-testid={`stat-${card.key}`}>
                  {card.badge ? (
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", stats?.ebayConfigured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                      {card.value}
                    </span>
                  ) : card.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{card.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Smart 4-Step Workflow ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Smart Workflow
            </h2>
            <span className="text-xs text-muted-foreground">Click any step to begin</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {WORKFLOW_STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <Card
                  className="p-4 border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                  onClick={() => setLocation(step.href)}
                  data-testid={`workflow-step-${step.step}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg text-white flex-shrink-0", step.color)}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground">STEP {step.step}</span>
                      </div>
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{step.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{step.desc}</p>
                    </div>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 hidden md:block" />
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Quick Analyzer + Quick Tools ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <QuickAnalyzer />
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUICK_TOOLS.map((tool, i) => (
              <motion.div
                key={tool.href}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <Card
                  className="p-4 border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group h-full"
                  onClick={() => setLocation(tool.href)}
                  data-testid={`tool-card-${tool.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white w-fit mb-2.5", tool.color)}>
                    <tool.icon className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-xs group-hover:text-primary transition-colors leading-snug">{tool.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{tool.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Hot Product Categories (always visible to guests) ─────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <span className="text-lg">🔥</span> Hot Categories Right Now
              <Badge variant="secondary" className="text-xs">Click to search suppliers</Badge>
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {HOT_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className="p-3 border-border/60 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                  onClick={() => setLocation(`/supplier-finder?q=${encodeURIComponent(cat.label)}`)}
                  data-testid={`hot-category-${cat.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji}</span>
                      <p className="text-xs font-medium group-hover:text-primary transition-colors">{cat.label}</p>
                    </div>
                    <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0">{cat.trend}</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                    <Globe className="w-2.5 h-2.5" /> Find suppliers <ArrowRight className="w-2.5 h-2.5 ml-auto" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Hot Right Now (eBay live items when API key configured) ──── */}
        {hotItems.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <span className="text-lg">⚡</span> Live eBay Hot Items
                <Badge variant="secondary" className="text-xs">{hotItems.length} items</Badge>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/trending")} data-testid="btn-see-all-trending">
                See all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {hotItems.map((item: any, idx: number) => (
                <motion.div
                  key={item.itemId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card
                    className="overflow-hidden border-border/60 hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => window.open(item.viewItemUrl, "_blank")}
                    data-testid={`hot-item-${item.itemId}`}
                  >
                    <div className="aspect-square bg-secondary relative overflow-hidden">
                      {item.galleryUrl ? (
                        <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                      )}
                      {item.watchCount > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5">
                          <Eye className="w-2 h-2" /> {item.watchCount}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-medium line-clamp-2 leading-snug mb-1">{item.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">${item.price.toFixed(2)}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Listings ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent Listings
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} data-testid="btn-view-all-history">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {loadingListings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-secondary/40 rounded-xl animate-pulse" />)}
            </div>
          ) : !recentListings?.length ? (
            <Card className="p-12 text-center border-dashed border-border/60">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No listings yet. Generate your first AI listing.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button size="sm" onClick={() => setLocation("/generate")}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Listing
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLocation("/generate?mode=manual")}>
                  <Search className="w-3.5 h-3.5 mr-1.5" /> From Notes
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentListings.slice(0, 3).map((listing: any) => (
                <motion.div
                  key={listing.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setLocation(`/listing/${listing.id}`)}
                  className="cursor-pointer group"
                  data-testid={`listing-card-${listing.id}`}
                >
                  <Card className="overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200">
                    <div className="aspect-[16/9] bg-secondary relative overflow-hidden">
                      {listing.images?.[0] ? (
                        <img src={listing.images[0]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                        {listing.generatedTitle}
                      </p>
                      <div className="flex items-center justify-between mt-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">AI Generated</Badge>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
