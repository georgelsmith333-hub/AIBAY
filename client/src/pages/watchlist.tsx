import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bookmark, Trash2, ExternalLink, ShoppingBag, Plus,
  DollarSign, TrendingUp, Search, RefreshCw, Download,
  AlertTriangle, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface WatchlistItem {
  id: number;
  productTitle: string;
  productUrl?: string;
  imageUrl?: string;
  searchKeyword?: string;
  targetPrice?: string;
  currentAvgPrice?: string;
  sellThroughRate?: string;
  notes?: string;
  marketplace: string;
  lastCheckedAt?: string;
  createdAt: string;
}

function SellThroughBadge({ rate }: { rate: number }) {
  if (rate >= 60) return <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-xs">STR {rate.toFixed(0)}% — Hot</Badge>;
  if (rate >= 30) return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/20 text-xs">STR {rate.toFixed(0)}% — Good</Badge>;
  return <Badge className="bg-red-500/15 text-red-500 border-red-500/20 text-xs">STR {rate.toFixed(0)}% — Slow</Badge>;
}

function STRRecommendation({ rate }: { rate: number }) {
  if (rate >= 60) return <p className="text-xs text-green-500 mt-1">High demand — consider raising your price by 10–15%</p>;
  if (rate >= 30) return <p className="text-xs text-yellow-600 mt-1">Steady demand — current pricing is competitive</p>;
  return <p className="text-xs text-red-500 mt-1">Low demand — try a lower price or different keyword strategy</p>;
}

export default function WatchlistPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [addMode, setAddMode] = useState(false);
  const [newItem, setNewItem] = useState({
    productTitle: "",
    productUrl: "",
    searchKeyword: "",
    targetPrice: "",
    notes: "",
  });

  const { data: items = [], isLoading } = useQuery<WatchlistItem[]>({ queryKey: ["/api/watchlist"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/watchlist/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Removed from Watchlist" });
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/watchlist", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Added to Watchlist" });
      setNewItem({ productTitle: "", productUrl: "", searchKeyword: "", targetPrice: "", notes: "" });
      setAddMode(false);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/watchlist/${id}/refresh`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/watchlist"] }),
    onError: (err: any) => toast({ title: "Refresh failed", description: err.message, variant: "destructive" }),
  });

  const refreshAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/watchlist/refresh-all").then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: `Refreshed ${data.refreshed}/${data.total} items` });
    },
    onError: () => toast({ title: "Refresh all failed", variant: "destructive" }),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.productTitle.trim()) return;
    addMutation.mutate({
      productTitle: newItem.productTitle,
      productUrl: newItem.productUrl || null,
      searchKeyword: newItem.searchKeyword || null,
      targetPrice: newItem.targetPrice || null,
      notes: newItem.notes || null,
    });
  }

  function exportCSV() {
    const headers = ["ID", "Title", "Keyword", "Target Price", "Current Avg Price", "Sell-Through Rate", "Last Checked", "URL"];
    const rows = items.map(item => [
      item.id,
      `"${item.productTitle.replace(/"/g, '""')}"`,
      item.searchKeyword || "",
      item.targetPrice || "",
      item.currentAvgPrice || "",
      item.sellThroughRate || "",
      item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString() : "",
      item.productUrl || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function isPriceAlerted(item: WatchlistItem): boolean {
    if (!item.targetPrice || !item.currentAvgPrice) return false;
    return parseFloat(item.currentAvgPrice) <= parseFloat(item.targetPrice);
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-primary" /> Watchlist
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track products and get alerted when prices hit your target
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={exportCSV}
              disabled={items.length === 0}
              data-testid="btn-export-csv"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending || items.length === 0}
              data-testid="btn-refresh-all"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1.5", refreshAllMutation.isPending && "animate-spin")} />
              Refresh All
            </Button>
            <Button onClick={() => setAddMode(!addMode)} size="sm" data-testid="btn-add-watchlist">
              <Plus className="w-4 h-4 mr-1.5" /> Add Item
            </Button>
          </div>
        </div>

        {/* Add Form */}
        {addMode && (
          <Card className="border-primary/30">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-4">Add to Watchlist</h3>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Product Title *</Label>
                    <Input
                      placeholder="e.g. iPhone 15 Case Clear"
                      value={newItem.productTitle}
                      onChange={e => setNewItem({ ...newItem, productTitle: e.target.value })}
                      data-testid="input-watchlist-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">eBay Search Keyword</Label>
                    <Input
                      placeholder="e.g. iPhone 15 clear case"
                      value={newItem.searchKeyword}
                      onChange={e => setNewItem({ ...newItem, searchKeyword: e.target.value })}
                      data-testid="input-watchlist-keyword"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Buy Alert Price ($)</Label>
                    <Input
                      type="number" step="0.01" placeholder="e.g. 15.99"
                      value={newItem.targetPrice}
                      onChange={e => setNewItem({ ...newItem, targetPrice: e.target.value })}
                      data-testid="input-watchlist-price"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Product URL (optional)</Label>
                    <Input
                      placeholder="https://..."
                      value={newItem.productUrl}
                      onChange={e => setNewItem({ ...newItem, productUrl: e.target.value })}
                      data-testid="input-watchlist-url"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={addMutation.isPending || !newItem.productTitle.trim()} data-testid="btn-add-submit">
                    Add to Watchlist
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAddMode(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Bookmark className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">Your watchlist is empty</p>
            <p className="text-sm max-w-sm mx-auto">Add products you want to track. Set a buy alert price to get notified when the market dips below your threshold.</p>
            <Button onClick={() => setAddMode(true)} className="mt-4" size="sm" data-testid="btn-start-watchlist">
              <Plus className="w-4 h-4 mr-1.5" /> Add Your First Item
            </Button>
          </div>
        )}

        {/* Items Grid */}
        {!isLoading && items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(item => {
              const alerted = isPriceAlerted(item);
              const avgPrice = item.currentAvgPrice ? parseFloat(item.currentAvgPrice) : null;
              const targetPrice = item.targetPrice ? parseFloat(item.targetPrice) : null;
              const str = item.sellThroughRate ? parseFloat(item.sellThroughRate) : null;

              return (
                <Card
                  key={item.id}
                  className={cn("relative transition-all", alerted && "ring-2 ring-orange-500/50")}
                  data-testid={`card-watchlist-${item.id}`}
                >
                  {alerted && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-orange-500 text-white text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Price Alert!
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-3">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-muted" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{item.productTitle}</p>
                        {item.searchKeyword && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Search className="w-3 h-3" /> {item.searchKeyword}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price data */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {avgPrice !== null && (
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-muted-foreground mb-0.5">Avg eBay Price</div>
                          <div className="font-bold text-base">${avgPrice.toFixed(2)}</div>
                        </div>
                      )}
                      {targetPrice !== null && (
                        <div className={cn("rounded-lg p-2", alerted ? "bg-orange-500/10" : "bg-muted/50")}>
                          <div className="text-muted-foreground mb-0.5">Buy Alert</div>
                          <div className={cn("font-bold text-base", alerted ? "text-orange-500" : "")}>
                            ${targetPrice.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* STR */}
                    {str !== null && (
                      <div>
                        <SellThroughBadge rate={str} />
                        <STRRecommendation rate={str} />
                      </div>
                    )}

                    {/* Last checked */}
                    {item.lastCheckedAt && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Checked {new Date(item.lastCheckedAt).toLocaleString()}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="sm" variant="outline" className="flex-1 text-xs h-7"
                        onClick={() => refreshMutation.mutate(item.id)}
                        disabled={refreshMutation.isPending}
                        data-testid={`btn-refresh-${item.id}`}
                      >
                        <RefreshCw className={cn("w-3 h-3 mr-1", refreshMutation.isPending && "animate-spin")} /> Refresh
                      </Button>
                      <Button
                        size="sm" variant="outline" className="flex-1 text-xs h-7"
                        onClick={() => setLocation(`/supplier?q=${encodeURIComponent(item.searchKeyword || item.productTitle)}`)}
                        data-testid={`btn-supplier-${item.id}`}
                      >
                        <ArrowRight className="w-3 h-3 mr-1" /> Find Supplier
                      </Button>
                      {item.productUrl && (
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2" asChild>
                          <a href={item.productUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-external-${item.id}`}>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`btn-delete-watchlist-${item.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
