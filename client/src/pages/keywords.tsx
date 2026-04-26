import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { EbaySetupBanner } from "@/components/ebay-setup-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Loader2, Copy, Check, ExternalLink, TrendingUp,
  AlertCircle, Sparkles, Clock, ArrowUpRight, ArrowDownRight, Minus,
  PlusCircle, X, Zap, GripVertical, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MARKETPLACES = [
  { id: "EBAY-US", label: "🇺🇸 US" },
  { id: "EBAY-GB", label: "🇬🇧 UK" },
  { id: "EBAY-AU", label: "🇦🇺 AU" },
];

interface KwResult {
  keyword: string;
  charCount: number;
  placement: "front" | "middle" | "end";
  relevanceScore: number;
  reason: string;
  competition?: { activeCount: number; soldCount: number; avgPrice: number };
}

function PlacementBadge({ placement }: { placement: string }) {
  const colors: Record<string, string> = {
    front: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    middle: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    end: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium capitalize", colors[placement] || colors.end)}>
      {placement}
    </span>
  );
}

function STRIndicator({ active, sold }: { active: number; sold: number }) {
  const str = active > 0 ? Math.round((sold / (active + sold)) * 100) : 0;
  const Icon = str >= 50 ? ArrowUpRight : str >= 20 ? Minus : ArrowDownRight;
  const color = str >= 50 ? "text-emerald-500" : str >= 20 ? "text-amber-500" : "text-red-500";
  return (
    <div className={cn("flex items-center gap-0.5 text-xs font-medium", color)}>
      <Icon className="w-3 h-3" /> {str}%
    </div>
  );
}

interface SeoBreakdown {
  total: number;
  dimensions: { label: string; score: number; max: number; tip: string }[];
}

const STOP_WORDS = /\b(the|and|or|for|of|in|on|at|to|by|is|it|a|an|this|that|with|from|into)\b/gi;
const BUYER_SIGNALS = /\b(new|sealed|genuine|oem|authentic|original|free shipping|fast shipping|with box|warranty|unused|mint|rare|refurbished)\b/gi;

function calcSeoScore(title: string, keywords: KwResult[]): SeoBreakdown {
  if (!title.trim()) return { total: 0, dimensions: [] };
  const t = title.trim();
  const len = t.length;

  // Dimension 1 — Length (0-20 pts)
  const lengthScore = len >= 60 ? 20 : len >= 40 ? 14 : len >= 20 ? 8 : 2;
  const lengthTip = len >= 60 ? "Great length" : len >= 40 ? "Try to reach 60+ chars" : "Title is too short — add more keywords";

  // Dimension 2 — Keywords front-loaded (0-25 pts)
  const first40 = t.slice(0, 40).toLowerCase();
  const highRelevance = keywords.filter(k => k.relevanceScore >= 70);
  const frontLoaded = highRelevance.filter(k => first40.includes(k.keyword.toLowerCase().split(" ")[0])).length;
  const frontScore = Math.min(Math.round((frontLoaded / Math.max(highRelevance.length, 1)) * 25), 25);
  const frontTip = frontScore >= 20 ? "Strong front-loaded keywords" : "Move high-relevance keywords to the start of the title";

  // Dimension 3 — Stop word ratio (0-20 pts)
  const stopMatches = (t.match(STOP_WORDS) || []).length;
  const wordCount = t.split(/\s+/).length;
  const stopRatio = wordCount > 0 ? stopMatches / wordCount : 0;
  const stopScore = stopRatio < 0.1 ? 20 : stopRatio < 0.2 ? 14 : stopRatio < 0.3 ? 8 : 0;
  const stopTip = stopScore >= 20 ? "Minimal stop words" : `Remove filler words like "the", "and", "for" to free up space`;

  // Dimension 4 — Buyer signal words (0-20 pts)
  const signalMatches = (t.match(BUYER_SIGNALS) || []).length;
  const signalScore = Math.min(signalMatches * 7, 20);
  const signalTip = signalScore >= 14 ? "Good buyer signals present" : "Add words like New, Sealed, Free Shipping, or Genuine to boost trust";

  // Dimension 5 — Keyword coverage (0-15 pts)
  const topKws = keywords.filter(k => k.relevanceScore >= 75).slice(0, 10);
  const covered = topKws.filter(k => t.toLowerCase().includes(k.keyword.toLowerCase().split(" ")[0])).length;
  const coverageScore = topKws.length > 0 ? Math.round((covered / topKws.length) * 15) : 0;
  const coverageTip = coverageScore >= 12 ? "Excellent keyword coverage" : "Include more of the top-ranked keywords from the list below";

  const total = lengthScore + frontScore + stopScore + signalScore + coverageScore;

  return {
    total,
    dimensions: [
      { label: "Length", score: lengthScore, max: 20, tip: lengthTip },
      { label: "Front-loaded", score: frontScore, max: 25, tip: frontTip },
      { label: "Stop words", score: stopScore, max: 20, tip: stopTip },
      { label: "Buyer signals", score: signalScore, max: 20, tip: signalTip },
      { label: "KW coverage", score: coverageScore, max: 15, tip: coverageTip },
    ],
  };
}

function SeoScoreBar({ breakdown }: { breakdown: SeoBreakdown }) {
  const { total: score, dimensions } = breakdown;
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">SEO Score</span>
        <span className={cn("font-bold text-sm", textColor)}>
          {score}/100 · {label}
        </span>
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {dimensions.length > 0 && (
        <div className="grid grid-cols-5 gap-1 mt-2">
          {dimensions.map(d => {
            const pct = Math.round((d.score / d.max) * 100);
            const dimColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
            return (
              <div key={d.label} className="group relative text-center" title={d.tip}>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-1">
                  <motion.div
                    className={cn("h-full rounded-full", dimColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground leading-none">{d.label}</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 w-40 bg-popover border border-border rounded-lg shadow-lg px-2.5 py-2">
                  <p className="text-[10px] font-semibold text-foreground mb-0.5">{d.label}: {d.score}/{d.max}</p>
                  <p className="text-[10px] text-muted-foreground">{d.tip}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KeywordsPage() {
  const [seed, setSeed] = useState("");
  const [marketplace, setMarketplace] = useState("EBAY-US");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [titleWords, setTitleWords] = useState<string[]>([]);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const dragWord = useRef<string | null>(null);

  const { data: ebayStatus } = useQuery<{ configured: boolean }>({ queryKey: ["/api/ebay/status"] });
  const { data: recentSearches } = useQuery<any[]>({ queryKey: ["/api/keywords/history"] });

  const {
    mutate: doResearch,
    isPending,
    data: results,
    error,
    reset,
  } = useMutation<any, Error, { keyword: string; marketplace: string }>({
    mutationFn: async ({ keyword, marketplace }) => {
      const res = await apiRequest("POST", "/api/keywords/research", { keyword, marketplace });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.titleTemplate) {
        setTitleWords(data.titleTemplate.trim().split(/\s+/).filter(Boolean));
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seed.trim()) return;
    setTitleWords([]);
    doResearch({ keyword: seed.trim(), marketplace });
  }

  function copyKeyword(keyword: string, idx: number) {
    navigator.clipboard.writeText(keyword);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function copyTemplate() {
    const title = titleWords.join(" ");
    if (!title) return;
    navigator.clipboard.writeText(title);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  }

  function addWordToTitle(word: string) {
    const currentTitle = titleWords.join(" ");
    if (currentTitle.length + word.length + 1 > 80) {
      toast({ variant: "destructive", title: "Title too long", description: "eBay titles have an 80 character limit." });
      return;
    }
    setTitleWords(prev => [...prev, ...word.trim().split(/\s+/)]);
  }

  function removeWord(idx: number) {
    setTitleWords(prev => prev.filter((_, i) => i !== idx));
  }

  function handleDragStart(word: string) {
    dragWord.current = word;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (dragWord.current) {
      addWordToTitle(dragWord.current);
      dragWord.current = null;
    }
    setDragOverIdx(null);
  }

  function handleTitleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOverIdx(0);
  }

  function handleTitleDragLeave() {
    setDragOverIdx(null);
  }

  function sendToGenerator() {
    const title = titleWords.join(" ");
    if (!title) return;
    setLocation(`/generate?prefillTitle=${encodeURIComponent(title)}`);
  }

  const keywords: KwResult[] = results?.keywords || [];
  const sortedKws = [...keywords].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const currentTitle = titleWords.join(" ");
  const seoScore = calcSeoScore(currentTitle, sortedKws);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" /> Keyword Research Tool
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-generated keyword variations with live eBay competition data, SEO scoring, and title builder
          </p>
        </div>

        {ebayStatus && !ebayStatus.configured && <EbaySetupBanner />}

        {/* Search Form */}
        <Card className="p-5 border-border/60">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder='Enter seed keyword e.g. "iPhone case", "Nike shoes"'
                className="pl-9 h-10"
                value={seed}
                onChange={(e) => { setSeed(e.target.value); reset(); }}
                data-testid="input-seed-keyword"
              />
            </div>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger className="w-32 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isPending || !seed.trim()} className="h-10 px-6" data-testid="btn-keyword-research">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Research
            </Button>
          </form>
        </Card>

        {/* Error */}
        {error && (
          <Card className="p-5 border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{error.message}</p>
            </div>
          </Card>
        )}

        {/* Loading */}
        {isPending && (
          <div className="space-y-3">
            <div className="h-10 bg-secondary/30 rounded-xl animate-pulse" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-secondary/20 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Results */}
        {results && !isPending && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Title Builder */}
            <Card className="p-5 border-primary/30 bg-primary/[0.02]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Title Builder
                  <span className="text-xs text-muted-foreground font-normal">— drag or click keywords to add</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{currentTitle.length}/80 chars</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={copyTemplate}
                    data-testid="btn-copy-template"
                  >
                    {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={sendToGenerator}
                    disabled={!currentTitle.trim()}
                    data-testid="btn-send-to-generator"
                  >
                    <Send className="w-3 h-3" /> Send to Generator
                  </Button>
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={cn(
                  "min-h-12 border-2 border-dashed rounded-xl p-3 flex flex-wrap gap-1.5 transition-colors mb-3",
                  dragOverIdx !== null ? "border-primary/60 bg-primary/5" : "border-border/60 bg-secondary/20",
                  !currentTitle && "items-center justify-center"
                )}
                onDrop={handleDrop}
                onDragOver={handleTitleDragOver}
                onDragLeave={handleTitleDragLeave}
                data-testid="title-builder-zone"
              >
                {titleWords.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Drop keywords here or click the + button on any keyword</p>
                ) : (
                  titleWords.map((word, idx) => (
                    <motion.span
                      key={`${word}-${idx}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-md font-medium"
                    >
                      {word}
                      <button
                        onClick={() => removeWord(idx)}
                        className="hover:text-destructive transition-colors"
                        data-testid={`btn-remove-word-${idx}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </motion.span>
                  ))
                )}
              </div>

              <SeoScoreBar breakdown={seoScore} />

              {/* Tips */}
              {currentTitle && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTitle.length < 60 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                      💡 Add more keywords — eBay rewards titles near 80 chars
                    </span>
                  )}
                  {!/\bnew\b/i.test(currentTitle) && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                      💡 Add "New" to front — boosts condition filter visibility
                    </span>
                  )}
                  {/\b(the|and|or|for)\b/i.test(currentTitle) && (
                    <span className="text-[10px] text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 px-2 py-0.5 rounded">
                      ⚠️ Remove stop words (the, and, or, for) — they waste title space
                    </span>
                  )}
                </div>
              )}
            </Card>

            {/* Keywords Table */}
            <Card className="border-border/60 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/60">
                <h3 className="font-semibold text-sm">
                  Keyword Suggestions
                  <Badge variant="secondary" className="ml-2 text-xs">{sortedKws.length}</Badge>
                </h3>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Drag to Title Builder · Click + to add</span>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {sortedKws.map((kw, idx) => (
                  <motion.div
                    key={kw.keyword}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    draggable
                    onDragStart={() => handleDragStart(kw.keyword)}
                    className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors group cursor-grab active:cursor-grabbing"
                    data-testid={`keyword-row-${idx}`}
                  >
                    {/* Drag handle */}
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0" />

                    {/* Score */}
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                      kw.relevanceScore >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : kw.relevanceScore >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-secondary text-muted-foreground"
                    )}>
                      {kw.relevanceScore}
                    </div>

                    {/* Keyword info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{kw.keyword}</span>
                        <span className="text-xs text-muted-foreground">{kw.charCount}c</span>
                        <PlacementBadge placement={kw.placement} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{kw.reason}</p>
                    </div>

                    {/* Competition data */}
                    {kw.competition && (
                      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                        <div className="text-center">
                          <p className="font-medium text-foreground">{kw.competition.activeCount?.toLocaleString()}</p>
                          <p className="text-[10px]">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-foreground">{kw.competition.soldCount?.toLocaleString()}</p>
                          <p className="text-[10px]">Sold</p>
                        </div>
                        <div className="text-center">
                          <STRIndicator active={kw.competition.activeCount} sold={kw.competition.soldCount} />
                          <p className="text-[10px]">STR</p>
                        </div>
                        {kw.competition.avgPrice > 0 && (
                          <div className="text-center">
                            <p className="font-medium text-foreground">${kw.competition.avgPrice.toFixed(0)}</p>
                            <p className="text-[10px]">Avg</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => addWordToTitle(kw.keyword)}
                        className="w-7 h-7 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
                        title="Add to title"
                        data-testid={`btn-add-to-title-${idx}`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => copyKeyword(kw.keyword, idx)}
                        className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-secondary transition-all"
                        data-testid={`btn-copy-keyword-${idx}`}
                      >
                        {copiedId === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Recent searches */}
        {recentSearches && recentSearches.length > 0 && !results && (
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Recent Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.slice(0, 8).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSeed(s.query)}
                  className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
                >
                  {s.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && !isPending && !error && (
          <Card className="p-16 text-center border-dashed border-border/60">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-muted-foreground">Enter a seed keyword to get started</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
              Get 20 AI-curated keyword variations, build your title with drag-and-drop, check SEO score, then send directly to the listing generator
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
