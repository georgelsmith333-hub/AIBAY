import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Grid3X3, ExternalLink, TrendingUp, DollarSign, Package,
  ArrowRight, Loader2, ChevronDown, ChevronRight, Search,
  Flame, Zap, TrendingDown, Minus
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  children?: { id: string; name: string; emoji: string }[];
}

const CATEGORIES: Category[] = [
  {
    id: "293", name: "Consumer Electronics", emoji: "📱", desc: "Phones, TVs, Audio, Accessories",
    children: [
      { id: "15032", name: "Cell Phones & Smartphones", emoji: "📱" },
      { id: "3676", name: "Televisions", emoji: "📺" },
      { id: "14946", name: "Home Audio", emoji: "🔊" },
      { id: "3944", name: "Portable Audio & Headphones", emoji: "🎧" },
    ]
  },
  {
    id: "15032", name: "Cell Phones & Accessories", emoji: "📞", desc: "Smartphones, Cases, Chargers",
    children: [
      { id: "9355", name: "Cell Phone Cases", emoji: "📋" },
      { id: "35190", name: "Cell Phone Chargers", emoji: "🔌" },
      { id: "9394", name: "Screen Protectors", emoji: "🛡️" },
    ]
  },
  {
    id: "58058", name: "Computers & Tablets", emoji: "💻", desc: "Laptops, Desktops, Components",
    children: [
      { id: "177", name: "Laptops & Netbooks", emoji: "💻" },
      { id: "171830", name: "Desktops & All-In-Ones", emoji: "🖥️" },
      { id: "175673", name: "Computer Components", emoji: "🔧" },
      { id: "171485", name: "Tablets & eBook Readers", emoji: "📱" },
    ]
  },
  {
    id: "625", name: "Cameras & Photo", emoji: "📷", desc: "DSLR, Mirrorless, Lenses",
    children: [
      { id: "31388", name: "Digital Cameras", emoji: "📷" },
      { id: "3323", name: "Lenses & Filters", emoji: "🔭" },
      { id: "15230", name: "Camera Drones", emoji: "🚁" },
    ]
  },
  {
    id: "11450", name: "Clothing, Shoes & Accessories", emoji: "👗", desc: "Fashion, Sneakers, Bags",
    children: [
      { id: "11483", name: "Men's Clothing", emoji: "👔" },
      { id: "15724", name: "Women's Clothing", emoji: "👗" },
      { id: "93427", name: "Sneakers & Athletic Shoes", emoji: "👟" },
      { id: "169291", name: "Handbags & Purses", emoji: "👜" },
    ]
  },
  {
    id: "11700", name: "Home & Garden", emoji: "🏡", desc: "Furniture, Tools, Decor",
    children: [
      { id: "20444", name: "Furniture", emoji: "🛋️" },
      { id: "631", name: "Tools", emoji: "🔨" },
      { id: "10033", name: "Kitchen & Dining", emoji: "🍽️" },
    ]
  },
  {
    id: "281", name: "Jewelry & Watches", emoji: "💎", desc: "Rings, Necklaces, Luxury Watches",
    children: [
      { id: "10968", name: "Fine Jewelry", emoji: "💍" },
      { id: "14324", name: "Watches, Parts & Accessories", emoji: "⌚" },
      { id: "3513", name: "Fashion Jewelry", emoji: "✨" },
    ]
  },
  {
    id: "382", name: "Sporting Goods", emoji: "⚽", desc: "Exercise, Outdoor, Team Sports",
    children: [
      { id: "888", name: "Exercise & Fitness", emoji: "🏋️" },
      { id: "1316", name: "Outdoor Sports", emoji: "🏕️" },
      { id: "159043", name: "Team Sports", emoji: "⚽" },
    ]
  },
  {
    id: "26395", name: "Health & Beauty", emoji: "💄", desc: "Skincare, Supplements, Fitness",
    children: [
      { id: "31786", name: "Skin Care", emoji: "✨" },
      { id: "67169", name: "Vitamins & Dietary Supplements", emoji: "💊" },
      { id: "26348", name: "Hair Care & Styling", emoji: "💇" },
    ]
  },
  {
    id: "1", name: "Collectibles", emoji: "🎭", desc: "Coins, Stamps, Memorabilia",
    children: [
      { id: "11116", name: "Coins: US", emoji: "🪙" },
      { id: "260", name: "Stamps", emoji: "📮" },
      { id: "45100", name: "Entertainment Memorabilia", emoji: "🏆" },
    ]
  },
  {
    id: "267", name: "Books", emoji: "📚", desc: "Fiction, Non-Fiction, Textbooks",
    children: [
      { id: "171228", name: "Fiction Books", emoji: "📖" },
      { id: "171229", name: "Non-Fiction Books", emoji: "📕" },
      { id: "2228", name: "Textbooks, Education", emoji: "🎓" },
    ]
  },
  {
    id: "220", name: "Toys & Hobbies", emoji: "🎮", desc: "Action Figures, Board Games, Models",
    children: [
      { id: "246", name: "Action Figures", emoji: "🦸" },
      { id: "2550", name: "Board Games", emoji: "♟️" },
      { id: "1188", name: "LEGO Sets & Packs", emoji: "🧱" },
    ]
  },
  { id: "2984", name: "Baby", emoji: "🍼", desc: "Clothing, Gear, Toys" },
  { id: "1281", name: "Pet Supplies", emoji: "🐾", desc: "Food, Accessories, Health" },
  {
    id: "1249", name: "Video Games & Consoles", emoji: "🎯", desc: "Consoles, Games, Controllers",
    children: [
      { id: "139973", name: "Video Games", emoji: "🕹️" },
      { id: "54968", name: "Video Game Consoles", emoji: "🎮" },
      { id: "117042", name: "Gaming Accessories", emoji: "🖱️" },
    ]
  },
  { id: "11233", name: "Music", emoji: "🎵", desc: "CDs, Vinyl, Digital Media" },
  { id: "11232", name: "DVDs & Movies", emoji: "🎬", desc: "Blu-ray, DVD, Streaming" },
  { id: "619", name: "Musical Instruments", emoji: "🎸", desc: "Guitars, Keyboards, Drums" },
  { id: "12576", name: "Business & Industrial", emoji: "🏭", desc: "Office, Manufacturing, Tools" },
  { id: "45100", name: "Entertainment Memorabilia", emoji: "🏆", desc: "Autographs, Props, Costumes" },
];

function calcOpportunity(stats: { totalActive?: number; avgPrice?: number; sellThroughRate?: number } | null | undefined): number {
  if (!stats) return 0;
  const str = stats.sellThroughRate ?? 0;
  const price = stats.avgPrice ?? 0;
  const active = stats.totalActive ?? 0;
  // Higher STR = better demand, higher price = better margin potential, moderate competition
  const strScore = Math.min(str * 0.5, 40); // up to 40 pts
  const priceScore = price >= 200 ? 30 : price >= 50 ? 22 : price >= 20 ? 14 : 6; // up to 30 pts
  const compScore = active > 100000 ? 5 : active > 50000 ? 12 : active > 10000 ? 20 : 25; // up to 30 pts
  return Math.min(Math.round(strScore + priceScore + compScore), 100);
}

function OpportunityBadge({ score }: { score: number }) {
  if (score >= 70) return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md">
      <Flame className="w-2.5 h-2.5" /> Hot
    </span>
  );
  if (score >= 50) return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">
      <TrendingUp className="w-2.5 h-2.5" /> Rising
    </span>
  );
  if (score >= 30) return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
      <Zap className="w-2.5 h-2.5" /> Moderate
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
      <Minus className="w-2.5 h-2.5" /> Low
    </span>
  );
}

function heatmapBorder(score: number) {
  if (score >= 70) return "border-orange-400/70 dark:border-orange-500/50";
  if (score >= 50) return "border-emerald-400/60 dark:border-emerald-500/40";
  if (score >= 30) return "border-blue-300/60 dark:border-blue-500/30";
  return "border-border/50";
}

function heatmapBg(score: number) {
  if (score >= 70) return "bg-orange-50/60 dark:bg-orange-950/10";
  if (score >= 50) return "bg-emerald-50/40 dark:bg-emerald-950/10";
  if (score >= 30) return "bg-blue-50/30 dark:bg-blue-950/10";
  return "";
}

function CategoryCard({ category, onResearch }: { category: Category; onResearch: (id: string, keyword?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery<{
    totalActive?: number; avgPrice?: number; sellThroughRate?: number; topItems?: { itemId: string; title: string; price: number; galleryUrl?: string }[];
  }>({
    queryKey: ["/api/ebay/category", category.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/ebay/category/${category.id}/stats`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: expanded,
    staleTime: 15 * 60 * 1000,
  });

  const opportunity = calcOpportunity(stats);
  const hasStats = !!stats && !isLoading;

  return (
    <Card
      className={cn(
        "border transition-all duration-200 overflow-hidden",
        heatmapBorder(hasStats ? opportunity : 0),
        heatmapBg(hasStats ? opportunity : 0),
        expanded && "shadow-md ring-1 ring-primary/20",
      )}
    >
      {/* Main header — always visible */}
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded(v => !v)}
        data-testid={`category-card-${category.id}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none flex-shrink-0">{category.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{category.name}</span>
              {hasStats && <OpportunityBadge score={opportunity} />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{category.desc}</p>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
        </div>

        {/* Opportunity score bar — visible when stats loaded */}
        {hasStats && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Opportunity Score</span>
              <span className={cn("text-[10px] font-bold",
                opportunity >= 70 ? "text-orange-600 dark:text-orange-400" :
                opportunity >= 50 ? "text-emerald-600 dark:text-emerald-400" :
                opportunity >= 30 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
              )}>{opportunity}/100</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full",
                  opportunity >= 70 ? "bg-orange-500" :
                  opportunity >= 50 ? "bg-emerald-500" :
                  opportunity >= 30 ? "bg-blue-400" : "bg-border"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${opportunity}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-border/60 pt-3 space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading category data...
                </div>
              ) : stats ? (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Active</p>
                      <p className="text-sm font-display font-bold">{stats.totalActive?.toLocaleString() ?? "—"}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Avg Price</p>
                      <p className="text-sm font-display font-bold">${stats.avgPrice?.toFixed(0) ?? "—"}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">STR</p>
                      <p className={cn("text-sm font-display font-bold",
                        (stats.sellThroughRate ?? 0) >= 50 ? "text-emerald-500" :
                        (stats.sellThroughRate ?? 0) >= 25 ? "text-amber-500" : "text-red-500"
                      )}>{stats.sellThroughRate ? `${stats.sellThroughRate.toFixed(0)}%` : "—"}</p>
                    </div>
                  </div>

                  {/* Top items */}
                  {stats.topItems && stats.topItems.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Top Listings</p>
                      {stats.topItems.slice(0, 3).map(item => (
                        <div key={item.itemId} className="flex items-center gap-2 py-1">
                          {item.galleryUrl && (
                            <img src={item.galleryUrl} alt="" className="w-7 h-7 object-cover rounded flex-shrink-0" />
                          )}
                          <p className="text-xs flex-1 line-clamp-1 text-muted-foreground">{item.title}</p>
                          <span className="text-xs font-semibold text-primary flex-shrink-0">${item.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sub-categories tree */}
                  {category.children && category.children.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Sub-categories</p>
                      <div className="space-y-1">
                        {category.children.map(child => (
                          <button
                            key={child.id}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-xs",
                              expandedChild === child.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setExpandedChild(prev => prev === child.id ? null : child.id)}
                            data-testid={`subcategory-${child.id}`}
                          >
                            <span className="text-base leading-none">{child.emoji}</span>
                            <span className="flex-1 font-medium">{child.name}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                                onClick={(e) => { e.stopPropagation(); onResearch(child.id); }}
                                data-testid={`btn-research-subcategory-${child.id}`}
                              >
                                Research
                              </button>
                              <ChevronRight className="w-3 h-3 flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={(e) => { e.stopPropagation(); onResearch(category.id); }}
                    data-testid={`btn-research-category-${category.id}`}
                  >
                    <Search className="w-3 h-3 mr-1.5" /> Research this category
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Stats unavailable (eBay API not configured)</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function CategoriesPage() {
  const [, setLocation] = useLocation();
  const [searchFilter, setSearchFilter] = useState("");

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });

  function handleResearch(categoryId: string) {
    setLocation(`/market-research?categoryId=${categoryId}`);
  }

  const filtered = searchFilter.trim()
    ? CATEGORIES.filter(c =>
        c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.desc.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : CATEGORIES;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Grid3X3 className="w-6 h-6 text-primary" /> Category Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Click any category to explore stats, opportunity score, and sub-categories
          </p>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Heatmap:</span>
          {[
            { label: "Hot (70+)", color: "bg-orange-500", text: "text-orange-600" },
            { label: "Rising (50+)", color: "bg-emerald-500", text: "text-emerald-600" },
            { label: "Moderate (30+)", color: "bg-blue-400", text: "text-blue-600" },
            { label: "Low", color: "bg-border", text: "text-muted-foreground" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={cn("w-2.5 h-2.5 rounded-full inline-block", item.color)} />
              <span className={cn("text-xs", item.text)}>{item.label}</span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">— expand a card to load opportunity score</span>
        </div>

        {/* Search filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter categories..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-border/70 bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            data-testid="input-category-filter"
          />
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.25 }}
            >
              <CategoryCard category={cat} onResearch={handleResearch} />
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No categories match your filter</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
