import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ShoppingBag,
  ExternalLink,
  Zap,
  TrendingDown,
  Star,
  Package,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Globe,
  AlertCircle,
  CheckCircle2,
  Copy,
  BarChart3,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { SiAmazon, SiAliexpress } from "react-icons/si";
import { cn } from "@/lib/utils";

interface SupplierProduct {
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
}

interface SupplierSearchResult {
  keyword: string;
  amazon: SupplierProduct[];
  aliexpress: SupplierProduct[];
  temu: SupplierProduct[];
  searchUrls: { amazon: string; aliexpress: string; temu: string };
  scrapedAt: number;
}

interface EbaySoldSummary {
  keyword: string;
  marketplace: string;
  avgSoldPrice: number;
  minSoldPrice: number;
  maxSoldPrice: number;
  totalSold: number;
  topSoldItems: { title: string; price: number; itemId: string; url: string; endDate: string }[];
  configured: boolean;
}

const PLATFORM_CONFIG = {
  amazon: {
    label: "Amazon",
    color: "from-orange-500 to-orange-600",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
    icon: SiAmazon,
  },
  aliexpress: {
    label: "AliExpress",
    color: "from-red-500 to-red-600",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    icon: SiAliexpress,
  },
  temu: {
    label: "Temu",
    color: "from-orange-400 to-pink-500",
    bg: "bg-pink-500/10",
    text: "text-pink-400",
    border: "border-pink-500/20",
    icon: ShoppingBag,
  },
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cfg = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return <Icon className={cn("w-4 h-4", cfg.text, className)} />;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-3 h-3",
            i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

function ProfitBadge({ cost, estEbayPrice }: { cost: number; estEbayPrice: number }) {
  const fvf = estEbayPrice * 0.1325;
  const netProfit = estEbayPrice - cost - fvf;
  const pct = estEbayPrice > 0 ? (netProfit / estEbayPrice) * 100 : 0;
  if (pct >= 30) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">🔥 {pct.toFixed(0)}% net margin</Badge>;
  if (pct >= 20) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">✓ {pct.toFixed(0)}% net margin</Badge>;
  if (pct >= 5) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">⚠ {pct.toFixed(0)}% net margin</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">✗ Low margin</Badge>;
}

function EbaySoldPanel({ soldData, keyword, cheapestSupplierPrice }: {
  soldData: EbaySoldSummary;
  keyword: string;
  cheapestSupplierPrice: number;
}) {
  if (!soldData.configured) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">eBay API Not Configured</p>
            <p className="text-xs text-muted-foreground">Add your EBAY_APP_ID to see live eBay sold prices alongside supplier costs. Get a free key at developer.ebay.com</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const netProfit = soldData.avgSoldPrice > 0
    ? soldData.avgSoldPrice - cheapestSupplierPrice - (soldData.avgSoldPrice * 0.1325)
    : 0;
  const marginPct = soldData.avgSoldPrice > 0 ? (netProfit / soldData.avgSoldPrice) * 100 : 0;

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400">eBay Live Sold Prices</span>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Last 30 days</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {soldData.totalSold === 0 ? (
          <p className="text-sm text-muted-foreground">No recent sold listings found for "{keyword}". Try a broader keyword.</p>
        ) : (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-background/50 border border-blue-500/20 p-3 text-center">
                <p className="text-xl font-black text-blue-400 tabular-nums">
                  ${soldData.avgSoldPrice.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Avg Sold Price</p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/50 p-3 text-center">
                <p className="text-xl font-black text-foreground tabular-nums">
                  {soldData.totalSold.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Items Sold</p>
              </div>
              <div className={cn(
                "rounded-lg border p-3 text-center",
                netProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
              )}>
                <p className={cn("text-xl font-black tabular-nums", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Est. Net Profit</p>
              </div>
            </div>

            {/* Price range */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Low: <strong className="text-foreground">${soldData.minSoldPrice.toFixed(2)}</strong></span>
              <span className="mx-1">—</span>
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>High: <strong className="text-foreground">${soldData.maxSoldPrice.toFixed(2)}</strong></span>
              {cheapestSupplierPrice > 0 && (
                <>
                  <span className="mx-1">—</span>
                  <span className={cn("font-semibold", marginPct >= 20 ? "text-emerald-400" : "text-yellow-400")}>
                    {marginPct.toFixed(1)}% margin at avg sold price
                  </span>
                </>
              )}
            </div>

            {/* Top sold items */}
            {soldData.topSoldItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recently Sold on eBay</p>
                {soldData.topSoldItems.slice(0, 4).map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 hover:bg-background border border-border/30 hover:border-blue-500/30 transition-all group"
                    data-testid={`link-ebay-sold-${i}`}
                  >
                    <p className="text-xs text-foreground group-hover:text-blue-400 truncate flex-1 transition-colors">{item.title}</p>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums flex-shrink-0">${item.price.toFixed(2)}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Sold=1&LH_Complete=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                  <ExternalLink className="w-3 h-3" />
                  View All eBay Sold
                </Button>
              </a>
              <a href="/profit-calculator">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Calculator className="w-3 h-3" />
                  Full Profit Calc
                </Button>
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductCard({
  product,
  onImport,
  estEbayPrice,
}: {
  product: SupplierProduct;
  onImport: (url: string) => void;
  estEbayPrice: number;
}) {
  const cfg = PLATFORM_CONFIG[product.platform];
  const [imgErr, setImgErr] = useState(false);
  const { toast } = useToast();

  function copyUrl() {
    navigator.clipboard.writeText(product.productUrl);
    toast({ title: "URL copied to clipboard" });
  }

  return (
    <Card className={cn("border transition-all hover:shadow-md hover:border-primary/30 group", cfg.border)}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
            {product.imageUrl && !imgErr ? (
              <img
                src={product.imageUrl}
                alt={product.title}
                className="w-full h-full object-cover"
                onError={() => setImgErr(true)}
              />
            ) : (
              <Package className="w-8 h-8 text-muted-foreground/30" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
                <PlatformIcon platform={product.platform} />
                {cfg.label}
              </div>
              {estEbayPrice > 0 && <ProfitBadge cost={product.price} estEbayPrice={estEbayPrice} />}
            </div>

            <p
              className="text-sm font-medium leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors"
              data-testid={`product-title-${product.platform}-${product.price}`}
            >
              {product.title}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-foreground" data-testid={`product-price-${product.platform}`}>
                ${product.price.toFixed(2)}
              </span>
              {product.rating && product.rating > 0 && <StarRating rating={product.rating} />}
              {product.reviewCount && (
                <span className="text-xs text-muted-foreground">({product.reviewCount.toLocaleString()} reviews)</span>
              )}
            </div>

            {product.shipping && (
              <p className="text-xs text-emerald-400 mt-1">{product.shipping}</p>
            )}
            {product.seller && (
              <p className="text-xs text-muted-foreground mt-0.5">Seller: {product.seller}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90"
                onClick={() => onImport(product.productUrl)}
                data-testid={`btn-import-${product.platform}-${product.price}`}
              >
                <Zap className="w-3 h-3" />
                Import to Generator
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => window.open(product.productUrl, "_blank")}
                data-testid={`btn-open-${product.platform}-${product.price}`}
              >
                <ExternalLink className="w-3 h-3" />
                View
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={copyUrl}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformSection({
  platform,
  products,
  searchUrl,
  estEbayPrice,
  onImport,
  loading,
}: {
  platform: "amazon" | "aliexpress" | "temu";
  products: SupplierProduct[];
  searchUrl: string;
  estEbayPrice: number;
  onImport: (url: string) => void;
  loading: boolean;
}) {
  const cfg = PLATFORM_CONFIG[platform];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", cfg.color)}>
            <PlatformIcon platform={platform} className="text-white w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm">{cfg.label}</h3>
          {!loading && (
            <Badge variant="outline" className="text-xs">
              {products.length} results
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => window.open(searchUrl, "_blank")}
          data-testid={`btn-open-${platform}-search`}
        >
          <ExternalLink className="w-3 h-3" />
          Open {cfg.label}
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className={cn("rounded-xl border p-6 text-center", cfg.bg, cfg.border)}>
          <AlertCircle className={cn("w-8 h-8 mx-auto mb-2 opacity-50", cfg.text)} />
          <p className="text-sm font-medium mb-1">No results scraped</p>
          <p className="text-xs text-muted-foreground mb-3">
            {cfg.label} may have blocked the search. Click below to search manually.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => window.open(searchUrl, "_blank")}
          >
            <ExternalLink className="w-3 h-3" />
            Search on {cfg.label}
          </Button>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-2">
          {products.map((p, i) => (
            <ProductCard
              key={`${p.productUrl}-${i}`}
              product={p}
              onImport={onImport}
              estEbayPrice={estEbayPrice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BestDealBanner({
  amazon,
  aliexpress,
  temu,
}: {
  amazon: SupplierProduct[];
  aliexpress: SupplierProduct[];
  temu: SupplierProduct[];
}) {
  const all = [
    ...(amazon.map((p) => ({ ...p, platform: "amazon" as const }))),
    ...(aliexpress.map((p) => ({ ...p, platform: "aliexpress" as const }))),
    ...(temu.map((p) => ({ ...p, platform: "temu" as const }))),
  ];
  if (all.length === 0) return null;

  const cheapest = [...all].sort((a, b) => a.price - b.price)[0];
  const cfg = PLATFORM_CONFIG[cheapest.platform];

  return (
    <Card className={cn("border", cfg.border)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", cfg.color)}>
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Lowest Price Found</span>
              <Badge className={cn("text-xs", cfg.bg, cfg.text, cfg.border)}>{cfg.label}</Badge>
            </div>
            <p className="text-sm font-medium truncate">{cheapest.title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-foreground">${cheapest.price.toFixed(2)}</p>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs mt-1 gap-1"
              onClick={() => window.open(cheapest.productUrl, "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              View Deal
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupplierFinderPage() {
  const [, navigate] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [ebayPriceInput, setEbayPriceInput] = useState("");
  const { toast } = useToast();

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery<SupplierSearchResult>({
    queryKey: ["/api/supplier/search", searchKeyword],
    queryFn: async () => {
      const res = await fetch(`/api/supplier/search?q=${encodeURIComponent(searchKeyword)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Search failed" }));
        throw new Error(err.message || "Search failed");
      }
      return res.json();
    },
    enabled: searchKeyword.length >= 2,
    staleTime: 30 * 60 * 1000,
  });

  const { data: ebayData, isLoading: ebayLoading } = useQuery<EbaySoldSummary>({
    queryKey: ["/api/ebay/sold-summary", searchKeyword],
    queryFn: async () => {
      const res = await fetch(`/api/ebay/sold-summary?q=${encodeURIComponent(searchKeyword)}`);
      if (!res.ok) throw new Error("Failed to fetch eBay sold data");
      return res.json();
    },
    enabled: searchKeyword.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  const ebayAvgSoldPrice = ebayData?.avgSoldPrice || 0;
  const manualEbayPrice = parseFloat(ebayPriceInput) || 0;
  const estEbayPrice = manualEbayPrice || ebayAvgSoldPrice;

  function handleSearch() {
    const kw = inputValue.trim();
    if (!kw || kw.length < 2) {
      toast({ title: "Enter a product keyword", description: "At least 2 characters required", variant: "destructive" });
      return;
    }
    setSearchKeyword(kw);
  }

  function handleImport(url: string) {
    navigate(`/generate?url=${encodeURIComponent(url)}`);
  }

  const totalResults = (data?.amazon.length || 0) + (data?.aliexpress.length || 0) + (data?.temu.length || 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Supplier Finder
              </h1>
              <p className="text-sm text-muted-foreground">
                Find the cheapest suppliers on Amazon, AliExpress & Temu
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-11 text-base"
                  placeholder="e.g. bluetooth earbuds, phone case, led strip lights..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-supplier-keyword"
                />
              </div>
              <Button
                className="h-11 px-6 font-semibold gap-2"
                onClick={handleSearch}
                disabled={isLoading || isFetching}
                data-testid="btn-supplier-search"
              >
                {(isLoading || isFetching) ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {(isLoading || isFetching) ? "Searching..." : "Search Suppliers"}
              </Button>
            </div>

            {/* eBay price calculator */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50 flex-wrap">
              <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground flex-shrink-0">eBay target price override:</p>
              <Input
                type="number"
                className="h-8 w-32 text-sm"
                placeholder="Auto from eBay"
                value={ebayPriceInput}
                onChange={(e) => setEbayPriceInput(e.target.value)}
                data-testid="input-ebay-price"
              />
              {ebayAvgSoldPrice > 0 && !manualEbayPrice && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  Auto: ${ebayAvgSoldPrice.toFixed(2)} avg sold price
                </Badge>
              )}
              {manualEbayPrice > 0 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  Override: ${manualEbayPrice.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform quick-links if no search yet */}
        {!searchKeyword && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["amazon", "aliexpress", "temu"] as const).map((platform) => {
              const cfg = PLATFORM_CONFIG[platform];
              const Icon = cfg.icon;
              return (
                <Card
                  key={platform}
                  className={cn("border cursor-pointer hover:shadow-md transition-all group", cfg.border, cfg.bg)}
                  onClick={() => window.open(`https://www.${platform}.com`, "_blank")}
                  data-testid={`card-platform-${platform}`}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", cfg.color)}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("font-bold text-base", cfg.text)}>{cfg.label}</h3>
                      <p className="text-xs text-muted-foreground">Browse supplier catalog</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* How it works */}
        {!searchKeyword && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                How AIBAY Supplier Finder Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Search, title: "1. Search", desc: "Enter any product keyword and we search Amazon, AliExpress and Temu simultaneously" },
                  { icon: TrendingDown, title: "2. Compare", desc: "Compare prices across all platforms instantly. Set your eBay target price to see profit margins" },
                  { icon: Zap, title: "3. Import", desc: 'Hit "Import to Generator" to auto-fill the AI Listing Engine with the product URL' },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-0.5">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Search Error</p>
                <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1">
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {(data || isLoading) && searchKeyword && (
          <div className="space-y-5">
            {/* Status bar */}
            {data && !isFetching && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">
                  Found <strong className="text-foreground">{totalResults} products</strong> for{" "}
                  <strong className="text-foreground">"{data.keyword}"</strong>
                  {totalResults === 0 && " — platforms may have blocked scraping. Use the direct links below."}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-xs"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            )}

            {/* Best deal */}
            {data && !isFetching && totalResults > 0 && (
              <BestDealBanner amazon={data.amazon} aliexpress={data.aliexpress} temu={data.temu} />
            )}

            {/* eBay Live Sold Prices cross-reference */}
            {searchKeyword && (ebayData || ebayLoading) && (
              ebayLoading ? (
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                    <p className="text-sm text-blue-400">Fetching live eBay sold prices for "{searchKeyword}"…</p>
                  </CardContent>
                </Card>
              ) : ebayData ? (
                <EbaySoldPanel
                  soldData={ebayData}
                  keyword={searchKeyword}
                  cheapestSupplierPrice={
                    Math.min(
                      ...[
                        ...(data?.amazon.map((p) => p.price) || []),
                        ...(data?.aliexpress.map((p) => p.price) || []),
                        ...(data?.temu.map((p) => p.price) || []),
                      ].filter((p) => p > 0),
                      Infinity,
                    )
                  }
                />
              ) : null
            )}

            {/* Platform tabs */}
            <Tabs defaultValue="all">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1 text-xs" data-testid="tab-all-platforms">
                  All Platforms
                  {data && <span className="ml-1 text-muted-foreground">({totalResults})</span>}
                </TabsTrigger>
                <TabsTrigger value="amazon" className="flex-1 text-xs" data-testid="tab-amazon">
                  <PlatformIcon platform="amazon" className="mr-1" />
                  Amazon
                  {data && <span className="ml-1 text-muted-foreground">({data.amazon.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="aliexpress" className="flex-1 text-xs" data-testid="tab-aliexpress">
                  <PlatformIcon platform="aliexpress" className="mr-1" />
                  AliExpress
                  {data && <span className="ml-1 text-muted-foreground">({data.aliexpress.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="temu" className="flex-1 text-xs" data-testid="tab-temu">
                  <PlatformIcon platform="temu" className="mr-1" />
                  Temu
                  {data && <span className="ml-1 text-muted-foreground">({data.temu.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {(["amazon", "aliexpress", "temu"] as const).map((platform) => (
                    <PlatformSection
                      key={platform}
                      platform={platform}
                      products={data?.[platform] || []}
                      searchUrl={data?.searchUrls[platform] || `https://www.${platform}.com`}
                      estEbayPrice={estEbayPrice}
                      onImport={handleImport}
                      loading={isLoading}
                    />
                  ))}
                </div>
              </TabsContent>

              {(["amazon", "aliexpress", "temu"] as const).map((platform) => (
                <TabsContent key={platform} value={platform} className="mt-4">
                  <PlatformSection
                    platform={platform}
                    products={data?.[platform] || []}
                    searchUrl={data?.searchUrls[platform] || `https://www.${platform}.com`}
                    estEbayPrice={estEbayPrice}
                    onImport={handleImport}
                    loading={isLoading}
                  />
                </TabsContent>
              ))}
            </Tabs>

            {/* Direct search links */}
            {data && (
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Direct Search Links
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.searchUrls).map(([platform, url]) => {
                      const cfg = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
                      return (
                        <Button
                          key={platform}
                          size="sm"
                          variant="outline"
                          className={cn("gap-1.5 text-xs h-8", cfg.text)}
                          onClick={() => window.open(url, "_blank")}
                          data-testid={`btn-search-link-${platform}`}
                        >
                          <PlatformIcon platform={platform} />
                          Search {cfg.label}
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
