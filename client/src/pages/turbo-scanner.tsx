import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ScanLine, Loader2, AlertCircle, ExternalLink,
  Bookmark, ShoppingBag, Zap, Eye, DollarSign,
  TrendingUp, Filter, Download, LayoutGrid, List,
  CheckSquare, Square, BookmarkPlus, ThumbsUp, ThumbsDown, Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "293", name: "Consumer Electronics", emoji: "📱" },
  { id: "15032", name: "Cell Phones", emoji: "📞" },
  { id: "58058", name: "Computers & Tablets", emoji: "💻" },
  { id: "625", name: "Cameras & Photo", emoji: "📷" },
  { id: "11450", name: "Clothing & Fashion", emoji: "👗" },
  { id: "11700", name: "Home & Garden", emoji: "🏡" },
  { id: "281", name: "Jewelry & Watches", emoji: "💎" },
  { id: "382", name: "Sporting Goods", emoji: "⚽" },
  { id: "26395", name: "Health & Beauty", emoji: "💄" },
  { id: "1", name: "Collectibles", emoji: "🎭" },
  { id: "267", name: "Books", emoji: "📚" },
  { id: "220", name: "Toys & Hobbies", emoji: "🎮" },
  { id: "2984", name: "Baby", emoji: "🍼" },
  { id: "1281", name: "Pet Supplies", emoji: "🐾" },
  { id: "1249", name: "Video Games", emoji: "🎯" },
  { id: "11232", name: "DVDs & Movies", emoji: "🎬" },
  { id: "619", name: "Musical Instruments", emoji: "🎸" },
];

const MARKETPLACES = [
  { id: "EBAY-US", label: "🇺🇸 US" },
  { id: "EBAY-GB", label: "🇬🇧 UK" },
  { id: "EBAY-AU", label: "🇦🇺 AU" },
  { id: "EBAY-DE", label: "🇩🇪 DE" },
];

const CONDITIONS = [
  { id: "all", name: "All Conditions" },
  { id: "New", name: "New Only" },
  { id: "Used", name: "Used Only" },
  { id: "Refurbished", name: "Refurbished" },
];

const SORT_OPTIONS = [
  { id: "default", name: "Best Match" },
  { id: "price_high", name: "Price: High → Low" },
  { id: "price_low", name: "Price: Low → High" },
  { id: "watches", name: "Most Watched" },
  { id: "verdict", name: "AI Score" },
];

function getWorthScore(item: any): number {
  const watchScore = Math.min(item.watchCount * 3, 40);
  const priceScore = item.price >= 20 && item.price <= 300 ? 30 : item.price > 300 ? 15 : 10;
  const condScore = item.conditionId === "1000" ? 20 : 10;
  const sellerScore = item.sellerPositivePercent >= 99 ? 10 : item.sellerPositivePercent >= 97 ? 7 : 3;
  return Math.min(watchScore + priceScore + condScore + sellerScore, 100);
}

function WorthBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 py-0.5">🔥 Hot</Badge>;
  if (score >= 50) return <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 py-0.5">✓ Good</Badge>;
  if (score >= 30) return <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 py-0.5">~ OK</Badge>;
  return null;
}

function VerdictCell({ verdict }: { verdict: any }) {
  if (!verdict) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      {verdict.shouldSell ? (
        <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <ThumbsDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className={cn("text-xs font-semibold", verdict.shouldSell ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {verdict.score}/100
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-1">{verdict.reason}</p>
      </div>
    </div>
  );
}

export default function TurboScanner() {
  const [categoryId, setCategoryId] = useState("293");
  const [marketplace, setMarketplace] = useState("EBAY-US");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("all");
  const [scanParams, setScanParams] = useState<any>(null);
  const [sortBy, setSortBy] = useState("default");
  const [hideUnworthy, setHideUnworthy] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });

  const { data, isLoading, error } = useQuery<{ items: any[]; totalEntries: number }>({
    queryKey: ["/api/ebay/turbo-scan", scanParams],
    queryFn: async () => {
      if (!scanParams) return { items: [], totalEntries: 0 };
      const p = new URLSearchParams({
        categoryId: scanParams.categoryId,
        marketplace: scanParams.marketplace,
        ...(scanParams.minPrice && { minPrice: scanParams.minPrice }),
        ...(scanParams.maxPrice && { maxPrice: scanParams.maxPrice }),
        ...(scanParams.condition && scanParams.condition !== "all" && { condition: scanParams.condition }),
      });
      const res = await fetch(`/api/ebay/turbo-scan?${p}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    enabled: !!scanParams,
    staleTime: 5 * 60 * 1000,
  });

  function handleScan() {
    setSelectedItems(new Set());
    setScanParams({ categoryId, marketplace, minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, condition });
  }

  const enriched = data?.items ? data.items.map(i => ({
    ...i,
    worthScore: getWorthScore(i),
    aiScore: i.verdict?.score || getWorthScore(i),
  })) : [];

  const sorted = [...enriched]
    .filter(i => !hideUnworthy || i.worthScore >= 50)
    .sort((a, b) => {
      if (sortBy === "price_high") return b.price - a.price;
      if (sortBy === "price_low") return a.price - b.price;
      if (sortBy === "watches") return b.watchCount - a.watchCount;
      if (sortBy === "verdict") return b.aiScore - a.aiScore;
      return b.worthScore - a.worthScore;
    });

  const hotCount = enriched.filter(i => i.worthScore >= 70).length;
  const avgPrice = enriched.length ? enriched.reduce((a, b) => a + b.price, 0) / enriched.length : 0;
  const totalWatches = enriched.reduce((a, b) => a + b.watchCount, 0);
  const sellCount = enriched.filter(i => i.verdict?.shouldSell).length;

  const selectedCategory = CATEGORIES.find(c => c.id === categoryId);

  function toggleSelect(itemId: string) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAllHot() {
    const hotIds = sorted.filter(i => i.worthScore >= 70).map(i => i.itemId);
    setSelectedItems(new Set(hotIds));
  }

  async function addToWatchlist(item: any) {
    try {
      await apiRequest("POST", "/api/watchlist", {
        productTitle: item.title, productUrl: item.viewItemUrl,
        imageUrl: item.galleryUrl, currentAvgPrice: item.price.toFixed(2), marketplace,
      });
      await qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {}
  }

  async function bulkAddToWatchlist() {
    const toAdd = sorted.filter(i => selectedItems.has(i.itemId));
    if (!toAdd.length) {
      toast({ variant: "destructive", title: "No items selected" });
      return;
    }
    try {
      await Promise.all(toAdd.map(item => addToWatchlist(item)));
      toast({ title: `${toAdd.length} items added to Watchlist` });
      setSelectedItems(new Set());
    } catch {
      toast({ variant: "destructive", title: "Some items failed to save" });
    }
  }

  function exportCSV() {
    if (!sorted.length) return;
    const headers = ["Score", "AI Verdict", "AI Score", "Title", "Price", "Condition", "Seller", "Watch Count", "URL"];
    const rows = sorted.map(i => [
      `${i.worthScore}`,
      i.verdict?.shouldSell ? "SELL" : "SKIP",
      `${i.aiScore}`,
      `"${i.title.replace(/"/g, '""')}"`,
      i.price.toFixed(2),
      i.condition,
      i.sellerUsername,
      i.watchCount,
      i.viewItemUrl,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aibay-scan-${categoryId}-${Date.now()}.csv`;
    a.click();
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-primary" /> Turbo Scanner
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scan entire eBay categories. AI verdicts + AIBAY Worth Score™ on every item. Bulk-save hot picks to watchlist.
          </p>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Config */}
        <Card className="p-4 border-border/60">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 md:col-span-1 lg:col-span-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger data-testid="select-scan-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" data-testid="input-min-price" />
            <Input placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" data-testid="input-max-price" />
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button onClick={handleScan} disabled={isLoading} className="h-9" data-testid="btn-turbo-scan">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Scanning...</> : <><Zap className="w-4 h-4 mr-2" />Turbo Scan</>}
            </Button>
            {sorted.length > 0 && (
              <>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant={hideUnworthy ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setHideUnworthy(!hideUnworthy)}
                >
                  <Filter className="w-3.5 h-3.5 mr-1.5" /> {hideUnworthy ? "Show All" : "Hot Only"}
                </Button>
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode("grid")}
                    data-testid="btn-view-grid"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode("table")}
                    data-testid="btn-view-table"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportCSV}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Error */}
        {error && (
          <Card className="p-5 border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            </div>
          </Card>
        )}

        {/* Summary + bulk actions */}
        {sorted.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedCategory?.emoji}</span>
              <div>
                <p className="font-semibold text-sm">{selectedCategory?.name}</p>
                <p className="text-xs text-muted-foreground">{sorted.length} items · {data?.totalEntries?.toLocaleString()} total in category</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center">
                <p className="text-base font-display font-black text-emerald-500">{hotCount}</p>
                <p className="text-[10px] text-muted-foreground">🔥 Hot</p>
              </div>
              <div className="text-center">
                <p className="text-base font-display font-black text-blue-500">{sellCount}</p>
                <p className="text-[10px] text-muted-foreground">AI: Sell</p>
              </div>
              <div className="text-center">
                <p className="text-base font-display font-black">${avgPrice.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Avg Price</p>
              </div>
              <div className="text-center">
                <p className="text-base font-display font-black">{totalWatches}</p>
                <p className="text-[10px] text-muted-foreground">Watchers</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={selectAllHot}>
                <CheckSquare className="w-3.5 h-3.5" /> Select Hot
              </Button>
              {selectedItems.size > 0 && (
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={bulkAddToWatchlist} data-testid="btn-bulk-watchlist">
                  <BookmarkPlus className="w-3.5 h-3.5" /> Save {selectedItems.size} to Watchlist
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-secondary/30 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Grid view */}
        {!isLoading && sorted.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence>
              {sorted.map((item, idx) => (
                <motion.div
                  key={item.itemId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.6) }}
                >
                  <Card
                    className={cn(
                      "overflow-hidden border-border/60 hover:shadow-md transition-all group",
                      item.worthScore >= 70 && "ring-1 ring-emerald-500/30",
                      selectedItems.has(item.itemId) && "ring-2 ring-primary/60"
                    )}
                    onClick={() => toggleSelect(item.itemId)}
                  >
                    <div className="aspect-square bg-secondary relative overflow-hidden">
                      {item.galleryUrl ? (
                        <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Selection indicator */}
                      <div className="absolute top-1 right-1">
                        {selectedItems.has(item.itemId)
                          ? <CheckSquare className="w-4 h-4 text-primary bg-white rounded" />
                          : <Square className="w-4 h-4 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                        }
                      </div>
                      {/* Worth score */}
                      <div className={cn(
                        "absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                        item.worthScore >= 70 ? "bg-emerald-500 text-white"
                        : item.worthScore >= 50 ? "bg-blue-500 text-white"
                        : "bg-black/60 text-white"
                      )}>
                        {item.worthScore}
                      </div>
                      {item.watchCount > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Eye className="w-2 h-2" /> {item.watchCount}
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-start gap-1 mb-1">
                        <p className="text-xs font-medium line-clamp-2 leading-snug flex-1">{item.title}</p>
                      </div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-primary">${item.price.toFixed(2)}</span>
                        <WorthBadge score={item.worthScore} />
                      </div>
                      {/* AI verdict */}
                      {item.verdict && (
                        <div className={cn(
                          "text-[10px] flex items-center gap-1 mb-1.5",
                          item.verdict.shouldSell ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}>
                          {item.verdict.shouldSell ? <ThumbsUp className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                          {item.verdict.shouldSell ? "AI: Sell this" : "AI: Skip"}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); addToWatchlist(item).then(() => { qc.invalidateQueries({ queryKey: ["/api/watchlist"] }); toast({ title: "Saved" }); }); }}
                          className="flex-1 h-6 text-[10px] rounded border border-border hover:bg-secondary flex items-center justify-center gap-0.5 transition-colors"
                          data-testid={`btn-scan-watchlist-${item.itemId}`}
                        >
                          <Bookmark className="w-2.5 h-2.5" /> Save
                        </button>
                        <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer" className="flex-1" onClick={e => e.stopPropagation()}>
                          <button className="w-full h-6 text-[10px] rounded border border-border hover:bg-secondary flex items-center justify-center gap-0.5 transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" /> View
                          </button>
                        </a>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Table view */}
        {!isLoading && sorted.length > 0 && viewMode === "table" && (
          <Card className="border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border/40">
                    <th className="p-3 w-8">
                      <button
                        onClick={() => setSelectedItems(new Set(sorted.map(i => i.itemId)))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    </th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Score</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Product</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Price</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Watchers</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Condition</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">AI Verdict</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item, idx) => (
                    <tr
                      key={item.itemId}
                      className={cn(
                        "border-b border-border/30 hover:bg-secondary/20 transition-colors cursor-pointer",
                        selectedItems.has(item.itemId) && "bg-primary/5",
                        idx % 2 === 0 ? "bg-background" : "bg-secondary/5"
                      )}
                      onClick={() => toggleSelect(item.itemId)}
                      data-testid={`table-row-${item.itemId}`}
                    >
                      <td className="p-3">
                        {selectedItems.has(item.itemId)
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4 text-muted-foreground/40" />
                        }
                      </td>
                      <td className="p-3">
                        <div className={cn(
                          "w-9 h-7 rounded text-xs font-bold flex items-center justify-center",
                          item.worthScore >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : item.worthScore >= 50 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-secondary text-muted-foreground"
                        )}>
                          {item.worthScore}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          {item.galleryUrl && (
                            <img src={item.galleryUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                          )}
                          <p className="text-xs font-medium line-clamp-2 leading-snug">{item.title}</p>
                        </div>
                      </td>
                      <td className="p-3 text-sm font-bold text-primary whitespace-nowrap">${item.price.toFixed(2)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" /> {item.watchCount}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{item.condition}</td>
                      <td className="p-3">
                        <VerdictCell verdict={item.verdict} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => addToWatchlist(item).then(() => { qc.invalidateQueries({ queryKey: ["/api/watchlist"] }); toast({ title: "Saved" }); })}
                            className="p-1.5 rounded hover:bg-secondary transition-colors"
                            data-testid={`btn-table-watchlist-${item.itemId}`}
                          >
                            <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer">
                            <button className="p-1.5 rounded hover:bg-secondary transition-colors">
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !error && sorted.length === 0 && (
          <Card className="p-16 text-center border-dashed border-border/60">
            <ScanLine className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-muted-foreground">Select a category and hit Turbo Scan</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
              Every product gets an AIBAY Worth Score™ + AI verdict. Switch to Table View to compare all metrics at once.
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
