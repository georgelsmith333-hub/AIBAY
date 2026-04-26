import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search, ExternalLink, Star, Package, DollarSign, ArrowRight,
  RefreshCw, ShoppingBag, Clock, History, BarChart2, Zap,
  TrendingDown, CheckCircle2, X, GitCompare,
} from "lucide-react";
import { SiAmazon, SiAliexpress } from "react-icons/si";
import { cn } from "@/lib/utils";

interface ScoredProduct {
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  rating?: number;
  reviewCount?: number;
  platform: "amazon" | "aliexpress" | "temu";
  shipping?: string;
  seller?: string;
  moq?: number;
  matchScore: { score: number; reason: string };
  isRecommended?: boolean;
}

interface SupplierSearchResult {
  query: string;
  results: ScoredProduct[];
  searchUrls: { amazon: string; aliexpress: string; temu: string };
  scrapedAt: number;
  totalCount: number;
}

interface SupplierHistoryItem {
  id: number;
  query: string;
  resultCount: number;
  createdAt: string;
}

const PLATFORM_CONFIG = {
  amazon: { label: "Amazon", color: "from-orange-500 to-orange-600", bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/20", icon: SiAmazon },
  aliexpress: { label: "AliExpress", color: "from-red-500 to-red-600", bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", icon: SiAliexpress },
  temu: { label: "Temu", color: "from-pink-500 to-pink-600", bg: "bg-pink-500/10", text: "text-pink-500", border: "border-pink-500/20", icon: ShoppingBag },
};

function MatchScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-500" : score >= 55 ? "text-yellow-500" : score >= 35 ? "text-orange-500" : "text-red-500";
  const bgColor = score >= 75 ? "bg-green-500" : score >= 55 ? "bg-yellow-500" : score >= 35 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${(score / 100) * 100} 100`}
            className={color}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-bold", color)}>
          {score}
        </span>
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("w-3 h-3", i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20")} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function ProductCard({
  product,
  checked,
  onCheck,
  canCheck,
}: {
  product: ScoredProduct;
  checked: boolean;
  onCheck: (v: boolean) => void;
  canCheck: boolean;
}) {
  const [, setLocation] = useLocation();
  const cfg = PLATFORM_CONFIG[product.platform];
  const PlatformIcon = cfg.icon;

  return (
    <Card className={cn("relative overflow-hidden transition-all", product.isRecommended && "ring-2 ring-primary/50")}>
      {product.isRecommended && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
            <Zap className="w-2.5 h-2.5 mr-1" /> AIBAY Recommended
          </Badge>
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <Checkbox
          checked={checked}
          disabled={!checked && !canCheck}
          onCheckedChange={onCheck}
          data-testid={`checkbox-compare-${product.platform}-${product.price}`}
          className="bg-background/90 border-border"
        />
      </div>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.title} className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-muted" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-medium line-clamp-2 leading-snug">{product.title}</p>
              <MatchScoreGauge score={product.matchScore.score} />
            </div>
            <div className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mb-2", cfg.bg, cfg.text)}>
              <PlatformIcon className="w-3 h-3" />
              {cfg.label}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-primary">${product.price.toFixed(2)}</span>
              {product.rating && <StarRating rating={product.rating} />}
              {product.reviewCount && (
                <span className="text-xs text-muted-foreground">{product.reviewCount.toLocaleString()} reviews</span>
              )}
            </div>
            {product.shipping && (
              <p className="text-xs text-muted-foreground mt-1">{product.shipping}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-1 italic line-clamp-1">{product.matchScore.reason}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-8" asChild>
            <a href={product.productUrl} target="_blank" rel="noopener noreferrer" data-testid={`btn-view-${product.platform}`}>
              <ExternalLink className="w-3 h-3 mr-1" /> View on Site
            </a>
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => setLocation(`/generate?sourceUrl=${encodeURIComponent(product.productUrl)}`)}
            data-testid={`btn-optimize-${product.platform}`}
          >
            <ArrowRight className="w-3 h-3 mr-1" /> Source & Optimize
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareTable({ products, onClose }: { products: ScoredProduct[]; onClose: () => void }) {
  if (products.length < 2) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl border border-border w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
          <h2 className="font-bold text-lg">Compare Suppliers</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold text-muted-foreground w-32">Metric</td>
                {products.map((p, i) => (
                  <td key={i} className="p-3 font-semibold text-center">
                    <div className="flex flex-col items-center gap-1">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />}
                      <span className="text-xs line-clamp-2">{p.title}</span>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Platform", render: (p: ScoredProduct) => <Badge variant="outline">{PLATFORM_CONFIG[p.platform].label}</Badge> },
                { label: "Price", render: (p: ScoredProduct) => <span className="font-bold text-primary">${p.price.toFixed(2)}</span> },
                { label: "AI Match Score", render: (p: ScoredProduct) => <MatchScoreGauge score={p.matchScore.score} /> },
                { label: "Rating", render: (p: ScoredProduct) => p.rating ? <StarRating rating={p.rating} /> : <span className="text-muted-foreground">N/A</span> },
                { label: "Reviews", render: (p: ScoredProduct) => <span>{p.reviewCount?.toLocaleString() || "N/A"}</span> },
                { label: "Shipping", render: (p: ScoredProduct) => <span>{p.shipping || "N/A"}</span> },
                { label: "MOQ", render: (p: ScoredProduct) => <span>{p.moq || 1} unit</span> },
              ].map(({ label, render }) => (
                <tr key={label} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 text-muted-foreground font-medium">{label}</td>
                  {products.map((p, i) => (
                    <td key={i} className="p-3 text-center">{render(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex gap-2 justify-end border-t border-border">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierIntelligencePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SupplierSearchResult | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<ScoredProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const { data: history = [] } = useQuery<SupplierHistoryItem[]>({
    queryKey: ["/api/supplier/history"],
  });

  const searchMutation = useMutation({
    mutationFn: (q: string) => apiRequest("POST", "/api/supplier/search", { query: q }).then(r => r.json()),
    onSuccess: (data) => {
      setSearchResult(data);
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSelectedForCompare([]);
    searchMutation.mutate(query.trim());
  }

  function handleHistorySearch(q: string) {
    setQuery(q);
    setSelectedForCompare([]);
    searchMutation.mutate(q);
  }

  function toggleCompare(product: ScoredProduct, checked: boolean) {
    if (checked) {
      if (selectedForCompare.length >= 4) {
        toast({ title: "Max 4 products", description: "Uncheck one before adding another" });
        return;
      }
      setSelectedForCompare(prev => [...prev, product]);
    } else {
      setSelectedForCompare(prev => prev.filter(p => p.productUrl !== product.productUrl));
    }
  }

  const filteredResults = searchResult?.results.filter(p =>
    platformFilter === "all" || p.platform === platformFilter
  ) || [];

  const platforms = searchResult?.results.reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <Layout>
      <div className="flex gap-6 min-h-0">
        {/* Sidebar: search history */}
        <aside className="w-56 flex-shrink-0 hidden lg:block">
          <div className="sticky top-0 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Recent Searches
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No searches yet</p>
              ) : (
                <div className="space-y-1">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleHistorySearch(h.query)}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs transition-colors"
                      data-testid={`btn-history-${h.id}`}
                    >
                      <div className="font-medium truncate">{h.query}</div>
                      <div className="text-muted-foreground">{h.resultCount} results</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchResult && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Platforms</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setPlatformFilter("all")}
                    className={cn("w-full text-left px-2 py-1 rounded text-xs transition-colors", platformFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    All ({searchResult.totalCount})
                  </button>
                  {Object.entries(platforms).map(([platform, count]) => (
                    <button
                      key={platform}
                      onClick={() => setPlatformFilter(platform)}
                      className={cn("w-full text-left px-2 py-1 rounded text-xs transition-colors capitalize", platformFilter === platform ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                    >
                      {PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.label || platform} ({count})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> Supplier Intelligence
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Search AliExpress, Amazon & Temu simultaneously. AI scores every result for eBay resale potential.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search product keyword (e.g. 'wireless earbuds', 'phone case')"
              className="flex-1"
              data-testid="input-supplier-search"
            />
            <Button type="submit" disabled={searchMutation.isPending || !query.trim()} data-testid="btn-supplier-search">
              {searchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
          </form>

          {/* Compare bar */}
          {selectedForCompare.length >= 2 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/30 rounded-lg">
              <GitCompare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{selectedForCompare.length} products selected</span>
              <Button size="sm" onClick={() => setShowCompare(true)} data-testid="btn-compare">
                Compare Side by Side
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedForCompare([])}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Loading */}
          {searchMutation.isPending && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Results */}
          {!searchMutation.isPending && filteredResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredResults.length} results sorted by AI Match Score
                  {selectedForCompare.length > 0 && ` · ${selectedForCompare.length}/4 selected`}
                </p>
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Check up to 4 to compare</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredResults.map((product, idx) => {
                  const isChecked = selectedForCompare.some(p => p.productUrl === product.productUrl);
                  return (
                    <ProductCard
                      key={`${product.platform}-${idx}`}
                      product={product}
                      checked={isChecked}
                      onCheck={(v) => toggleCompare(product, v)}
                      canCheck={selectedForCompare.length < 4}
                    />
                  );
                })}
              </div>

              {/* Platform search links */}
              {searchResult && (
                <div className="border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium">Search directly on each platform:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(searchResult.searchUrls).map(([platform, url]) => {
                      const cfg = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80", cfg.bg, cfg.text, cfg.border)}
                          data-testid={`link-platform-${platform}`}
                        >
                          <Icon className="w-3.5 h-3.5" /> Search {cfg.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!searchMutation.isPending && searchResult && filteredResults.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">Try a different keyword or check back shortly</p>
            </div>
          )}

          {/* Initial state */}
          {!searchMutation.isPending && !searchResult && (
            <div className="text-center py-20 text-muted-foreground">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">Search for supplier products</p>
              <p className="text-sm max-w-md mx-auto">
                Enter a product keyword above. We'll search Amazon, AliExpress & Temu simultaneously and rank results with AI.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {["wireless earbuds", "phone case", "LED strip lights", "yoga mat", "kitchen knife"].map(kw => (
                  <Button
                    key={kw}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => { setQuery(kw); searchMutation.mutate(kw); }}
                  >
                    {kw}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compare Modal */}
      {showCompare && (
        <CompareTable products={selectedForCompare} onClose={() => setShowCompare(false)} />
      )}
    </Layout>
  );
}
