import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart3, Search, TrendingUp, ExternalLink, Bookmark, Download,
  Loader2, AlertCircle, ShoppingBag, Users, DollarSign, Target,
  Calculator, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  Info, Zap, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface ListingItem {
  itemId: string;
  title: string;
  price: number;
  galleryUrl?: string;
  viewItemURL?: string;
  viewItemUrl?: string;
  watchCount?: number;
  sold?: boolean;
  endTime?: string;
  condition?: string;
  sellerUsername?: string;
  sellerFeedback?: number;
  categoryName?: string;
}
interface MarketAnalysis {
  keyword: string;
  totalResults: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgWatchCount: number;
  sellThroughRate: number;
  competitionLevel: "Low" | "Medium" | "High";
  demandScore: number;
  competitionScore?: number;
  opportunityScore?: number;
  avgSoldPrice?: number;
  avgActivePrice?: number;
  uniqueSellers?: number;
  activeListings?: number;
  priceHistory?: { date: string; avgPrice: number }[];
  priceHistogram?: { range: string; count: number }[];
  topListings: ListingItem[];
  soldListingsData: ListingItem[];
  keywordSuggestions?: string[];
}

const MARKETPLACES = [
  { id: "EBAY-US", label: "🇺🇸 US" },
  { id: "EBAY-GB", label: "🇬🇧 UK" },
  { id: "EBAY-AU", label: "🇦🇺 AU" },
  { id: "EBAY-DE", label: "🇩🇪 DE" },
  { id: "EBAY-CA", label: "🇨🇦 CA" },
  { id: "EBAY-FR", label: "🇫🇷 FR" },
];

const TOP_CATEGORIES = [
  { id: "all", name: "All Categories" },
  { id: "293", name: "Consumer Electronics" },
  { id: "15032", name: "Cell Phones" },
  { id: "58058", name: "Computers & Tablets" },
  { id: "625", name: "Cameras & Photo" },
  { id: "11450", name: "Clothing" },
  { id: "11700", name: "Home & Garden" },
  { id: "281", name: "Jewelry & Watches" },
  { id: "382", name: "Sporting Goods" },
  { id: "26395", name: "Health & Beauty" },
  { id: "220", name: "Toys & Hobbies" },
  { id: "1249", name: "Video Games" },
];

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-border/60" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-display font-black" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function PriceHistogram({ data }: { data: { range: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((bucket, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/20 hover:bg-primary/50 rounded-sm transition-colors cursor-default group relative"
            style={{ height: `${Math.max(Math.round((bucket.count / max) * 100), bucket.count > 0 ? 4 : 0)}%` }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {bucket.count} items
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">{bucket.range.split("-")[0]}</span>
        </div>
      ))}
    </div>
  );
}

function ProfitCalculator({ avgSoldPrice }: { avgSoldPrice: number }) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [shipping, setShipping] = useState("4.99");
  const [ebayFee, setEbayFee] = useState("13.25");

  const costNum = parseFloat(cost) || 0;
  const shippingNum = parseFloat(shipping) || 0;
  const feeNum = parseFloat(ebayFee) || 13.25;
  const sellPrice = avgSoldPrice || 0;

  const ebayFeeAmt = sellPrice * (feeNum / 100);
  const netProfit = sellPrice - costNum - shippingNum - ebayFeeAmt;
  const margin = sellPrice > 0 ? (netProfit / sellPrice) * 100 : 0;
  const roi = costNum > 0 ? (netProfit / costNum) * 100 : 0;

  const profitable = netProfit > 0;

  return (
    <Card className="border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
        data-testid="btn-profit-calculator"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="font-semibold text-sm">Profit Calculator</span>
          {cost && (
            <Badge className={cn("text-xs ml-1", profitable ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
              {profitable ? "+" : ""}${netProfit.toFixed(2)} profit
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="px-4 pb-4 border-t border-border/60 pt-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier Cost ($)</Label>
                  <Input type="number" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} className="h-8 text-sm" data-testid="input-supplier-cost" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Shipping ($)</Label>
                  <Input type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">eBay Fee (%)</Label>
                  <Input type="number" value={ebayFee} onChange={(e) => setEbayFee(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              {sellPrice > 0 && (
                <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sell Price (eBay avg)</span>
                    <span className="font-medium">${sellPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">- Supplier Cost</span>
                    <span className="text-red-500">-${costNum.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">- Shipping</span>
                    <span className="text-red-500">-${shippingNum.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">- eBay Fees ({feeNum}%)</span>
                    <span className="text-red-500">-${ebayFeeAmt.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border/60 pt-2 flex items-center justify-between">
                    <span className="font-semibold text-sm">Net Profit</span>
                    <span className={cn("text-lg font-display font-black", profitable ? "text-emerald-500" : "text-red-500")}>
                      {profitable ? "+" : ""}${netProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="text-center bg-secondary/60 rounded-lg p-2">
                      <p className={cn("text-sm font-bold", margin >= 20 ? "text-emerald-500" : margin >= 10 ? "text-amber-500" : "text-red-500")}>{margin.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Margin</p>
                    </div>
                    <div className="text-center bg-secondary/60 rounded-lg p-2">
                      <p className={cn("text-sm font-bold", roi >= 50 ? "text-emerald-500" : roi >= 20 ? "text-amber-500" : "text-red-500")}>{roi.toFixed(0)}%</p>
                      <p className="text-[10px] text-muted-foreground">ROI</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

const TIME_RANGES = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "1y", label: "1 Year" },
  { id: "all", label: "All Time" },
];

export default function MarketResearch() {
  const [keyword, setKeyword] = useState("");
  const [marketplace, setMarketplace] = useState("EBAY-US");
  const [categoryId, setCategoryId] = useState("all");
  const [timeRange, setTimeRange] = useState("30d");
  const [searchQuery, setSearchQuery] = useState<{ keyword: string; marketplace: string; categoryId: string; timeRange: string } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchStr = useSearch();

  // Pre-fill from dashboard quick analyzer or category page deep-link
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const kw = params.get("keyword");
    const cat = params.get("categoryId") || "";
    if (kw) {
      setKeyword(kw);
      if (cat) setCategoryId(cat);
      setSearchQuery({ keyword: kw, marketplace: "EBAY-US", categoryId: cat, timeRange: "30d" });
    } else if (cat) {
      // Category-only deep-link from Category Analytics page
      setCategoryId(cat);
      setSearchQuery({ keyword: "*", marketplace: "EBAY-US", categoryId: cat, timeRange: "30d" });
    }
  }, []);

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });

  const { data: analysis, isLoading, error } = useQuery<MarketAnalysis>({
    queryKey: ["/api/ebay/search", searchQuery?.keyword, searchQuery?.marketplace, searchQuery?.categoryId, searchQuery?.timeRange],
    queryFn: async () => {
      if (!searchQuery) return null;
      const params = new URLSearchParams({ keyword: searchQuery.keyword, marketplace: searchQuery.marketplace });
      if (searchQuery.categoryId) params.set("categoryId", searchQuery.categoryId);
      if (searchQuery.timeRange) params.set("timeRange", searchQuery.timeRange);
      const res = await fetch(`/api/ebay/search?${params}`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
      return res.json();
    },
    enabled: !!searchQuery,
    staleTime: 5 * 60 * 1000,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    setSearchQuery({ keyword: keyword.trim(), marketplace, categoryId: categoryId === "all" ? "" : categoryId, timeRange });
  }

  function exportCSV() {
    if (!analysis?.topListings) return;
    const headers = ["Title", "Price", "Condition", "Seller", "Feedback", "Watch Count", "Category", "URL"];
    const rows = analysis.topListings.map((i: ListingItem) => [
      `"${i.title.replace(/"/g, '""')}"`,
      i.price.toFixed(2), i.condition,
      i.sellerUsername, i.sellerFeedback, i.watchCount,
      i.categoryName, i.viewItemUrl,
    ]);
    const csv = [headers.join(","), ...rows.map((r: (string | number | undefined)[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aibay-market-${keyword}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  async function addToWatchlist(item: ListingItem) {
    try {
      await apiRequest("POST", "/api/watchlist", {
        productTitle: item.title, productUrl: item.viewItemUrl,
        imageUrl: item.galleryUrl, searchKeyword: keyword,
        currentAvgPrice: item.price.toFixed(2), marketplace,
      });
      await qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Added to Watchlist" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to add" });
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Market Research
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live eBay sell-through rates, competition analysis, and profit potential
          </p>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Search */}
        <Card className="p-4 border-border/60">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder='Enter keyword e.g. "AirPods Pro", "vintage Rolex"'
                className="pl-9 h-10"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                data-testid="input-keyword"
              />
            </div>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger className="w-full sm:w-28 h-10" data-testid="select-marketplace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-44 h-10" data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {TOP_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="h-10 px-6" disabled={isLoading || !keyword.trim()} data-testid="btn-search">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Analyze
            </Button>
          </form>
          {/* Time-range filter */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Time range:</span>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {TIME_RANGES.map(tr => (
                <button
                  key={tr.id}
                  type="button"
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-all",
                    timeRange === tr.id ? "bg-white dark:bg-secondary shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setTimeRange(tr.id)}
                  data-testid={`chip-timerange-${tr.id}`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">— filters displayed sold listing history</span>
          </div>
        </Card>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-secondary/30 rounded-xl animate-pulse" />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Card className="p-5 border-destructive/40 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive">Analysis Failed</p>
                <p className="text-sm text-muted-foreground mt-0.5">{(error as Error).message}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {analysis && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Scores + Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opportunity Scores */}
              <Card className="p-5 border-border/60">
                <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Opportunity Assessment</p>
                <div className="flex items-center justify-around">
                  <ScoreRing score={analysis.demandScore} label="Demand" />
                  <ScoreRing score={analysis.sellThroughRate} label="STR %" />
                  <ScoreRing score={analysis.competitionScore ?? 0} label="Competition" />
                  <ScoreRing score={analysis.opportunityScore ?? 0} label="Opportunity" />
                </div>
                <div className={cn(
                  "mt-4 rounded-xl p-3 text-center text-sm font-semibold",
                  (analysis.opportunityScore ?? 0) >= 70 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : (analysis.opportunityScore ?? 0) >= 40 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                )}>
                  {(analysis.opportunityScore ?? 0) >= 70 ? "🟢 Excellent opportunity — low competition, high demand"
                  : (analysis.opportunityScore ?? 0) >= 40 ? "🟡 Moderate opportunity — competitive but viable"
                  : "🔴 Highly competitive market — consider niche variations"}
                </div>
              </Card>

              {/* Pricing Intelligence */}
              <Card className="p-5 border-border/60">
                <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wide">Pricing Intelligence</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Avg Sold Price
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${(analysis.avgSoldPrice ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Avg Active Price
                    </span>
                    <span className="font-bold">${(analysis.avgActivePrice ?? 0).toFixed(2)}</span>
                  </div>
                  {(analysis.avgSoldPrice ?? 0) > 0 && (analysis.avgActivePrice ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Price Gap
                      </span>
                      <span className={cn("font-bold flex items-center gap-1",
                        (analysis.avgSoldPrice ?? 0) > (analysis.avgActivePrice ?? 0) ? "text-emerald-500" : "text-muted-foreground"
                      )}>
                        {(analysis.avgSoldPrice ?? 0) > (analysis.avgActivePrice ?? 0)
                          ? <ArrowUpRight className="w-3 h-3" />
                          : <ArrowDownRight className="w-3 h-3" />
                        }
                        ${Math.abs((analysis.avgSoldPrice ?? 0) - (analysis.avgActivePrice ?? 0)).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price Range</span>
                    <span className="font-medium text-sm">${analysis.minPrice.toFixed(0)} – ${analysis.maxPrice.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Unique Sellers</span>
                    <span className="font-medium text-sm">{analysis.uniqueSellers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Listings</span>
                    <span className="font-medium text-sm">{analysis.activeListings?.toLocaleString()}</span>
                  </div>
                </div>
                {/* Price Histogram */}
                {(analysis.priceHistogram?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Price Distribution</p>
                    <PriceHistogram data={analysis.priceHistogram!} />
                  </div>
                )}
              </Card>
            </div>

            {/* Profit Calculator */}
            <ProfitCalculator avgSoldPrice={analysis.avgSoldPrice ?? 0} />

            {/* Top Listings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base">
                  Top Active Listings
                  <Badge variant="secondary" className="ml-2 text-xs font-normal">{analysis.topListings?.length} shown</Badge>
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCSV} data-testid="btn-export-csv" className="h-8 text-xs">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {analysis.topListings?.map((item: ListingItem) => (
                  <Card key={item.itemId} className="overflow-hidden border-border/60 hover:shadow-md transition-all group">
                    <div className="aspect-square bg-secondary relative overflow-hidden">
                      {item.galleryUrl ? (
                        <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                      {(item.watchCount ?? 0) > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          👁 {item.watchCount}
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium line-clamp-2 leading-snug mb-1.5">{item.title}</p>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-primary">${item.price.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground">{item.condition}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1 px-1" onClick={() => addToWatchlist(item)} data-testid={`btn-watchlist-${item.itemId}`}>
                          <Bookmark className="w-2.5 h-2.5 mr-0.5" /> Save
                        </Button>
                        <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer" className="flex-none">
                          <Button size="sm" variant="ghost" className="h-6 w-7 p-0">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recently Sold */}
            {analysis.soldListingsData?.length > 0 && (
              <div>
                <h3 className="font-display font-bold text-base mb-4">
                  Recently Sold
                  <Badge variant="secondary" className="ml-2 text-xs font-normal bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">✓ Confirmed Sales</Badge>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {analysis.soldListingsData.slice(0, 10).map((item: ListingItem) => (
                    <Card key={item.itemId} className="overflow-hidden border-emerald-500/20 hover:shadow-md transition-all group">
                      <div className="aspect-square bg-secondary relative overflow-hidden">
                        {item.galleryUrl ? (
                          <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">SOLD</div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium line-clamp-2 leading-snug mb-1.5">{item.title}</p>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${item.price.toFixed(2)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty state */}
        {!analysis && !isLoading && !error && (
          <Card className="p-16 text-center border-dashed border-border/60">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-muted-foreground">Enter a keyword to analyze the market</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
              Get live sell-through rates, demand scores, opportunity analysis, and profit calculator
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
