import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users, Search, Loader2, ExternalLink, Star, ShoppingBag,
  DollarSign, Package, BarChart3, Trash2, UserPlus, AlertCircle,
  PlusCircle, Columns3, X, ChevronLeft, ChevronRight, TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TopCategory { name: string; count: number }
interface SellerListing { itemId: string; title: string; price: number; watchCount: number; galleryUrl?: string; viewItemURL?: string; viewItemUrl?: string }
interface SellerProfile {
  username: string;
  feedbackScore: number;
  positiveFeedbackPercent: number;
  totalListings: number;
  avgPrice: number;
  estimatedMonthlyRevenue: number;
  topCategories: TopCategory[];
  listings?: SellerListing[];
}
interface SavedSeller { id: number; username: string; feedbackScore?: number | null; positiveFeedbackPercent?: string | null; totalListings?: number | null; avgPrice?: string | null; topCategories?: TopCategory[] | null }

const MAX_COMPARE = 3;


function ComparisonTable({ profiles }: { profiles: SellerProfile[] }) {
  if (profiles.length < 2) return null;

  const ratingColor = (pct: number) =>
    pct >= 99 ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 97 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  const rows = [
    { label: "Feedback Score", getValue: (p: SellerProfile) => p.feedbackScore?.toLocaleString() || "—" },
    { label: "Positive %", getValue: (p: SellerProfile) => `${p.positiveFeedbackPercent?.toFixed(1)}%`, colorFn: (p: SellerProfile) => ratingColor(p.positiveFeedbackPercent) },
    { label: "Total Listings", getValue: (p: SellerProfile) => p.totalListings?.toLocaleString() || "—" },
    { label: "Avg Price", getValue: (p: SellerProfile) => `$${p.avgPrice?.toFixed(2) || "0.00"}` },
    { label: "Est. Monthly Revenue", getValue: (p: SellerProfile) => `$${p.estimatedMonthlyRevenue?.toFixed(0) || "0"}`, highlight: true },
    { label: "Top Category", getValue: (p: SellerProfile) => p.topCategories?.[0]?.name || "—" },
  ];

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="p-4 border-b border-border/60 flex items-center gap-2">
        <Columns3 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Side-by-Side Comparison</h3>
        <Badge variant="secondary" className="text-xs">{profiles.length} sellers</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/30">
              <th className="text-left text-xs font-semibold text-muted-foreground p-3 w-36">Metric</th>
              {profiles.map(p => (
                <th key={p.username} className="text-center text-xs font-semibold p-3">
                  <span className="text-foreground">{p.username}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={cn("border-t border-border/40", i % 2 === 0 ? "bg-background" : "bg-secondary/10")}>
                <td className="p-3 text-xs text-muted-foreground font-medium">{row.label}</td>
                {profiles.map(p => {
                  const val = row.getValue(p);
                  const colClass = row.colorFn?.(p) || (row.highlight ? "text-emerald-600 dark:text-emerald-400 font-bold" : "");
                  return (
                    <td key={p.username} className={cn("p-3 text-sm text-center font-medium", colClass)}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function TopSellers() {
  const [username, setUsername] = useState("");
  const [searchedSeller, setSearchedSeller] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareProfiles, setCompareProfiles] = useState<SellerProfile[]>([]);
  const [listingsPage, setListingsPage] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });
  const { data: savedSellers } = useQuery<SavedSeller[]>({ queryKey: ["/api/tracked-sellers"] });

  const { data: profile, isLoading: loadingProfile, error: profileError } = useQuery<SellerProfile>({
    queryKey: ["/api/ebay/seller", searchedSeller],
    queryFn: async () => {
      const res = await fetch(`/api/ebay/seller/${searchedSeller}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    enabled: !!searchedSeller,
    staleTime: 10 * 60 * 1000,
  });

  const { data: listingsData, isLoading: loadingListings } = useQuery<{ items: SellerListing[]; totalPages: number; page: number }>({
    queryKey: ["/api/ebay/seller", searchedSeller, "listings", listingsPage],
    queryFn: async () => {
      const res = await fetch(`/api/ebay/seller/${searchedSeller}/listings?page=${listingsPage}`);
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
    enabled: !!searchedSeller && !!profile,
    staleTime: 5 * 60 * 1000,
  });

  const deleteSeller = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tracked-sellers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tracked-sellers"] });
      toast({ title: "Seller removed" });
    },
  });

  const trackSeller = useMutation({
    mutationFn: (p: {
      username: string; feedbackScore: number; positiveFeedbackPercent: number;
      totalListings: number; avgPrice: number; topCategories: { name: string; count: number }[];
    }) => apiRequest("POST", "/api/tracked-sellers", p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tracked-sellers"] });
      toast({ title: "Seller tracked", description: `${profile?.username} added to your tracking list.` });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to track seller" }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setListingsPage(1);
    setSearchedSeller(username.trim());
  }

  function addToComparison(p: SellerProfile) {
    if (compareProfiles.find(cp => cp.username === p.username)) {
      toast({ title: "Already in comparison", description: `${p.username} is already in the comparison.` });
      return;
    }
    if (compareProfiles.length >= MAX_COMPARE) {
      toast({ variant: "destructive", title: "Max 3 sellers", description: "Remove a seller before adding another." });
      return;
    }
    setCompareProfiles(prev => [...prev, p]);
    toast({ title: "Added to comparison", description: `${p.username} added.` });
  }

  function removeFromComparison(username: string) {
    setCompareProfiles(prev => prev.filter(p => p.username !== username));
  }

  const isTracked = (username: string) =>
    !!savedSellers?.find(s => s.username.toLowerCase() === username.toLowerCase());

  const ratingColor = (pct: number) =>
    pct >= 99 ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 97 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Top Sellers Tracker
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analyze any eBay seller — spy on listings, revenue, and categories. Compare up to 3 sellers side-by-side.
            </p>
          </div>
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setCompareMode(!compareMode)}
            data-testid="btn-compare-mode"
          >
            <Columns3 className="w-3.5 h-3.5" />
            {compareMode ? `Comparing (${compareProfiles.length})` : "Compare Mode"}
          </Button>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Compare mode chips */}
        {compareMode && compareProfiles.length > 0 && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-primary">Comparing:</span>
              {compareProfiles.map(p => (
                <span key={p.username} className="flex items-center gap-1.5 bg-white dark:bg-secondary text-xs font-medium px-3 py-1.5 rounded-full shadow-sm border border-border/60">
                  {p.username}
                  <button onClick={() => removeFromComparison(p.username)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {compareProfiles.length < MAX_COMPARE && (
                <span className="text-xs text-muted-foreground">Search for another seller to add ({MAX_COMPARE - compareProfiles.length} slot{MAX_COMPARE - compareProfiles.length !== 1 ? "s" : ""} left)</span>
              )}
            </div>
          </Card>
        )}

        {/* Search */}
        <Card className="p-5 border-border/60">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter eBay username or seller ID"
                className="pl-9 h-10"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="input-seller-username"
              />
            </div>
            <Button type="submit" disabled={loadingProfile} className="h-10 px-5" data-testid="btn-search-seller">
              {loadingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
          </form>
        </Card>

        {/* Profile error */}
        {profileError && (
          <Card className="p-5 border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{(profileError as Error).message}</p>
            </div>
          </Card>
        )}

        {/* Loading skeleton */}
        {loadingProfile && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-secondary/30 rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Profile Result */}
        {profile && !loadingProfile && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Seller header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">{profile.username}</h2>
                  <p className={cn("text-xs font-semibold", ratingColor(profile.positiveFeedbackPercent))}>
                    {profile.positiveFeedbackPercent?.toFixed(1)}% positive · {profile.feedbackScore?.toLocaleString()} feedback
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {compareMode && compareProfiles.length < MAX_COMPARE && !compareProfiles.find(cp => cp.username === profile.username) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => addToComparison(profile)}
                    data-testid="btn-add-to-compare"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add to Compare
                  </Button>
                )}
                {compareProfiles.find(cp => cp.username === profile.username) && (
                  <Badge variant="secondary" className="text-xs">In Comparison ✓</Badge>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Feedback Score</span>
                </div>
                <p className="text-2xl font-display font-black">{profile.feedbackScore?.toLocaleString()}</p>
                <p className={cn("text-xs font-semibold mt-0.5", ratingColor(profile.positiveFeedbackPercent))}>
                  {profile.positiveFeedbackPercent?.toFixed(1)}% positive
                </p>
              </Card>
              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Total Listings</span>
                </div>
                <p className="text-2xl font-display font-black">{profile.totalListings?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">active on eBay</p>
              </Card>
              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Avg Price</span>
                </div>
                <p className="text-2xl font-display font-black">${profile.avgPrice?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">per listing</p>
              </Card>
              <Card className="p-5 border-border/60 relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/5" />
                <div className="flex items-center gap-2 mb-1 relative">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Est. Monthly Rev.</span>
                </div>
                <p className="text-2xl font-display font-black relative text-emerald-600 dark:text-emerald-400">
                  ${profile.estimatedMonthlyRevenue?.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 relative">based on sell rate</p>
              </Card>
            </div>

            {/* Track + Compare actions */}
            <div className="flex items-center gap-3">
              <Button
                variant={isTracked(profile.username) ? "secondary" : "default"}
                size="sm"
                disabled={trackSeller.isPending}
                onClick={() => {
                  if (!isTracked(profile.username)) {
                    trackSeller.mutate({
                      username: profile.username,
                      feedbackScore: profile.feedbackScore,
                      positiveFeedbackPercent: profile.positiveFeedbackPercent,
                      totalListings: profile.totalListings,
                      avgPrice: profile.avgPrice,
                      topCategories: profile.topCategories || [],
                    });
                  }
                }}
                data-testid="btn-track-seller"
              >
                {trackSeller.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-2" />}
                {isTracked(profile.username) ? "Tracked ✓" : "Track Seller"}
              </Button>
              {compareMode && !compareProfiles.find(cp => cp.username === profile.username) && compareProfiles.length < MAX_COMPARE && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToComparison(profile)}
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-2" /> Add to Comparison
                </Button>
              )}
            </div>

            {/* Top Categories */}
            {profile.topCategories?.length > 0 && (
              <Card className="p-5 border-border/60">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Top Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.topCategories.map((cat: TopCategory) => (
                    <Badge key={cat.name} variant="secondary" className="text-xs">
                      {cat.name} <span className="ml-1 opacity-60">({cat.count})</span>
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Paginated Listings Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> Listings
                  {listingsData && (
                    <Badge variant="secondary" className="text-xs">Page {listingsData.page} of {listingsData.totalPages}</Badge>
                  )}
                </h3>
                {listingsData && listingsData.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={listingsPage <= 1 || loadingListings}
                      onClick={() => setListingsPage(p => p - 1)}
                      data-testid="btn-listings-prev"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{listingsPage} / {listingsData.totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={listingsPage >= listingsData.totalPages || loadingListings}
                      onClick={() => setListingsPage(p => p + 1)}
                      data-testid="btn-listings-next"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {loadingListings ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] bg-secondary/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : listingsData?.items && listingsData.items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {listingsData.items.map((item: SellerListing) => (
                    <Card key={item.itemId} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow group" data-testid={`listing-card-${item.itemId}`}>
                      <div className="aspect-square bg-secondary overflow-hidden relative">
                        {item.galleryUrl ? (
                          <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 space-y-1.5">
                        <p className="text-xs line-clamp-2 leading-snug">{item.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">${item.price.toFixed(2)}</span>
                          <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-6 text-[10px] px-2 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => setLocation(`/market-research?keyword=${encodeURIComponent(item.title)}`)}
                          data-testid={`btn-research-product-${item.itemId}`}
                        >
                          <TrendingUp className="w-2.5 h-2.5 mr-1" /> Research This Product
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (profile.listings?.length ?? 0) > 0 ? (
                /* fallback to profile.listings if paginated endpoint not yet available */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {(profile.listings ?? []).slice(0, 20).map((item: SellerListing) => (
                    <Card key={item.itemId} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow group" data-testid={`listing-card-${item.itemId}`}>
                      <div className="aspect-square bg-secondary overflow-hidden">
                        {item.galleryUrl ? (
                          <img src={item.galleryUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 space-y-1.5">
                        <p className="text-xs line-clamp-2 leading-snug">{item.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">${item.price.toFixed(2)}</span>
                          <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-6 text-[10px] px-2 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => setLocation(`/market-research?keyword=${encodeURIComponent(item.title)}`)}
                          data-testid={`btn-research-product-${item.itemId}`}
                        >
                          <TrendingUp className="w-2.5 h-2.5 mr-1" /> Research This Product
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* Comparison Table */}
        {compareMode && compareProfiles.length >= 2 && (
          <ComparisonTable profiles={compareProfiles} />
        )}

        {compareMode && compareProfiles.length === 1 && (
          <Card className="p-6 text-center border-dashed border-border/60">
            <PlusCircle className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Search and add one more seller to start comparing</p>
          </Card>
        )}

        {/* Saved Sellers */}
        {savedSellers && savedSellers.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Tracked Sellers
              <Badge variant="secondary" className="text-xs">{savedSellers.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedSellers.map((seller: SavedSeller) => (
                <Card
                  key={seller.id}
                  className="p-4 border-border/60 hover:shadow-sm transition-shadow cursor-pointer group"
                  onClick={() => { setUsername(seller.username); setSearchedSeller(seller.username); }}
                  data-testid={`tracked-seller-${seller.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{seller.username}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {seller.feedbackScore?.toLocaleString()} feedback · {seller.totalListings} listings
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {compareMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToComparison({ username: seller.username, feedbackScore: seller.feedbackScore ?? 0, positiveFeedbackPercent: parseFloat(seller.positiveFeedbackPercent ?? "0"), totalListings: seller.totalListings ?? 0, avgPrice: parseFloat(seller.avgPrice ?? "0"), estimatedMonthlyRevenue: 0, topCategories: (seller.topCategories || []).map((c: TopCategory | string) => typeof c === "string" ? { name: c, count: 0 } : c) }); }}
                          className="text-muted-foreground/40 hover:text-primary transition-colors"
                          data-testid={`btn-compare-${seller.id}`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSeller.mutate(seller.id); }}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                        data-testid={`btn-delete-seller-${seller.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {(seller.topCategories?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(seller.topCategories ?? []).slice(0, 2).map((cat) => (
                        <Badge key={typeof cat === "string" ? cat : cat.name} variant="outline" className="text-[10px] py-0 px-1.5">{typeof cat === "string" ? cat : cat.name}</Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!profile && !loadingProfile && !profileError && compareProfiles.length === 0 && (
          <Card className="p-16 text-center border-dashed border-border/60">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-muted-foreground">Search any eBay seller</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
              Enter a username to analyze their store. Enable Compare Mode to benchmark up to 3 sellers side-by-side.
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
