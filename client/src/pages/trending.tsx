import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, ExternalLink, Bookmark, ShoppingBag, Flame, Eye,
  DollarSign, Clock, RefreshCw, ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TrendingItem {
  itemId: string;
  title: string;
  price: number;
  galleryUrl?: string;
  viewItemURL?: string;
  viewItemUrl?: string;
  watchCount: number;
  soldCount?: number;
  isSold?: boolean;
  trendDirection?: "up" | "down" | "flat" | "neutral";
  trendScore?: number;
  categoryName?: string;
}

const CATEGORIES = [
  { id: "all", name: "All", emoji: "🌐" },
  { id: "293", name: "Electronics", emoji: "📱" },
  { id: "15032", name: "Cell Phones", emoji: "📞" },
  { id: "58058", name: "Computers", emoji: "💻" },
  { id: "11450", name: "Fashion", emoji: "👗" },
  { id: "11700", name: "Home", emoji: "🏡" },
  { id: "281", name: "Jewelry", emoji: "💎" },
  { id: "382", name: "Sports", emoji: "⚽" },
  { id: "220", name: "Toys", emoji: "🎮" },
  { id: "1249", name: "Gaming", emoji: "🎯" },
  { id: "26395", name: "Beauty", emoji: "💄" },
  { id: "267", name: "Books", emoji: "📚" },
  { id: "619", name: "Music", emoji: "🎸" },
];

const MARKETPLACES = [
  { id: "EBAY-US", label: "🇺🇸 US" },
  { id: "EBAY-GB", label: "🇬🇧 UK" },
  { id: "EBAY-AU", label: "🇦🇺 AU" },
  { id: "EBAY-DE", label: "🇩🇪 DE" },
];

const SORT_MODES = [
  { id: "watchCount", label: "Most Watched", icon: Eye, desc: "Highest watch count first" },
  { id: "mostSold", label: "Most Sold", icon: Flame, desc: "Recently completed/sold items" },
  { id: "priceIncrease", label: "Highest Price", icon: DollarSign, desc: "Price descending" },
  { id: "priceLow", label: "Lowest Price", icon: DollarSign, desc: "Price ascending" },
];

const TIME_RANGES = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

function TrendDirectionBadge({ direction, score }: { direction: "up" | "neutral" | "down"; score: number }) {
  if (direction === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <ArrowUp className="w-2.5 h-2.5" /> Hot
      </span>
    );
  }
  if (direction === "neutral") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <Minus className="w-2.5 h-2.5" /> Steady
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
      <ArrowDown className="w-2.5 h-2.5" /> Cool
    </span>
  );
}

export default function TrendingPage() {
  const [categoryId, setCategoryId] = useState("all");
  const [marketplace, setMarketplace] = useState("EBAY-US");
  const [sortMode, setSortMode] = useState("watchCount");
  const [timeRange, setTimeRange] = useState("7d");
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const { toast } = useToast();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });

  const { data, isLoading, error, refetch } = useQuery<{ items: TrendingItem[] }>({
    queryKey: ["/api/ebay/trending", categoryId, marketplace, sortMode, timeRange],
    queryFn: async () => {
      const p = new URLSearchParams({ marketplace, sortMode, timeRange });
      if (categoryId && categoryId !== "all") p.set("categoryId", categoryId);
      const res = await fetch(`/api/ebay/trending?${p}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    staleTime: AUTO_REFRESH_INTERVAL,
    retry: false,
    enabled: !!ebayStatus,
  });

  // Countdown timer — resets when any filter changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(AUTO_REFRESH_INTERVAL / 1000);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          refetch();
          return AUTO_REFRESH_INTERVAL / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [categoryId, marketplace, sortMode, timeRange, refetch]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function addToWatchlist(item: TrendingItem) {
    try {
      await apiRequest("POST", "/api/watchlist", {
        productTitle: item.title, productUrl: item.viewItemUrl,
        imageUrl: item.galleryUrl, currentAvgPrice: item.price.toFixed(2), marketplace,
      });
      await qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Saved to watchlist" });
    } catch {
      toast({ variant: "destructive", title: "Failed to save" });
    }
  }

  const activeSortMode = SORT_MODES.find(s => s.id === sortMode);
  const items = data?.items || [];

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" /> Trending Items
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              eBay's hottest products ranked by demand — updated every 15 minutes
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Refresh in {formatTime(secondsLeft)}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { refetch(); setSecondsLeft(AUTO_REFRESH_INTERVAL / 1000); }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Controls */}
        <Card className="p-4 border-border/60">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Time range chips */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {TIME_RANGES.map(tr => (
                <button
                  key={tr.id}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-all",
                    timeRange === tr.id ? "bg-white dark:bg-secondary shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setTimeRange(tr.id)}
                  data-testid={`chip-time-${tr.id}`}
                >
                  {tr.label}
                </button>
              ))}
            </div>

            {/* Sort mode chips */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {SORT_MODES.map(sm => (
                <button
                  key={sm.id}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                    sortMode === sm.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setSortMode(sm.id)}
                  data-testid={`chip-sort-${sm.id}`}
                >
                  {sm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full font-medium border transition-all",
                  categoryId === cat.id
                    ? "bg-primary text-white border-primary"
                    : "bg-background border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
                onClick={() => setCategoryId(cat.id)}
                data-testid={`chip-cat-${cat.id}`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        </Card>

        {/* Summary bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span>{items.length} items · sorted by <strong className="text-foreground">{activeSortMode?.label}</strong></span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              {items.filter((i: TrendingItem) => i.trendDirection === "up").length} hot items
            </span>
            {sortMode === "mostSold" && (
              <Badge variant="secondary" className="text-[10px]">📦 Completed Sales</Badge>
            )}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Card className="p-5 border-destructive/40 bg-destructive/5">
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-secondary/30 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Items grid */}
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((item: TrendingItem, idx: number) => (
              <motion.div
                key={item.itemId}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.02, 0.6) }}
              >
                <Card className={cn(
                  "overflow-hidden border-border/60 hover:shadow-md transition-all group",
                  item.trendDirection === "up" && "ring-1 ring-emerald-500/30",
                )}>
                  <div className="aspect-square bg-secondary relative overflow-hidden">
                    {item.galleryUrl ? (
                      <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Rank badge */}
                    {idx < 3 && (
                      <div className="absolute top-1 left-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        #{idx + 1}
                      </div>
                    )}
                    {/* Sold badge */}
                    {item.isSold && (
                      <div className="absolute top-1 right-1 bg-emerald-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        SOLD
                      </div>
                    )}
                    {/* Watch count */}
                    {item.watchCount > 0 && (
                      <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Eye className="w-2 h-2" /> {item.watchCount}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium line-clamp-2 leading-snug mb-1.5">{item.title}</p>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-primary">${item.price.toFixed(2)}</span>
                      <TrendDirectionBadge direction={(item.trendDirection === "flat" ? "neutral" : item.trendDirection) || "neutral"} score={item.trendScore || 50} />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => addToWatchlist(item)}
                        className="flex-1 h-6 text-[10px] rounded border border-border hover:bg-secondary flex items-center justify-center gap-0.5 transition-colors"
                        data-testid={`btn-trending-watchlist-${item.itemId}`}
                      >
                        <Bookmark className="w-2.5 h-2.5" /> Save
                      </button>
                      <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <button className="w-full h-6 text-[10px] rounded border border-border hover:bg-secondary flex items-center justify-center gap-0.5 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" /> View
                        </button>
                      </a>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && items.length === 0 && ebayStatus?.configured && (
          <Card className="p-16 text-center border-dashed border-border/60">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-muted-foreground">No results for this filter</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Try a different category or time range</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
