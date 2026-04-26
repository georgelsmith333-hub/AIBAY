import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import {
  Zap, Loader2, ExternalLink, Sparkles, Globe, Cpu, FileText, Image,
  Tag, AlignLeft, ListChecks, BarChart3, RefreshCw, ArrowRight,
  CheckCircle2, XCircle, ChevronRight, Layers, Package, LayoutTemplate, Copy, Eye,
  PenLine, Calculator, TrendingUp, Trophy, GitCompare, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Listing } from "@shared/schema";
import { LISTING_TEMPLATES, applyTemplate, type ListingTemplate } from "@/lib/listingTemplates";

// ─── Next Steps Suggest ───────────────────────────────────────────────────────
function NextStepsBanner({ context }: { context: "after-generate" | "after-score" }) {
  const [, setLocation] = useLocation();
  const steps = context === "after-generate"
    ? [
        { icon: Calculator, label: "Check Profit", desc: "Calculate eBay fees & margins", href: "/profit-calculator", color: "text-emerald-500" },
        { icon: TrendingUp, label: "Market Research", desc: "See sell-through rate & demand", href: "/market-research", color: "text-blue-500" },
        { icon: Globe, label: "Find Cheaper Supplier", desc: "Amazon / AliExpress / Temu", href: "/supplier-finder", color: "text-orange-500" },
      ]
    : [
        { icon: Sparkles, label: "Generate Full Listing", desc: "Turn this title into a listing", href: "/generate", color: "text-primary" },
        { icon: Calculator, label: "Profit Calculator", desc: "Estimate eBay fees & profit", href: "/profit-calculator", color: "text-emerald-500" },
      ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggested Next Steps</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <Button key={s.href} variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => setLocation(s.href)}>
            <s.icon className={cn("w-3.5 h-3.5", s.color)} />
            {s.label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Platform Detection ───────────────────────────────────────────────────────

interface PlatformInfo {
  name: string;
  icon: string;
  badgeClass: string;
}

function detectPlatformInfo(url: string): PlatformInfo | null {
  const lower = url.toLowerCase();
  if (lower.includes("aliexpress.com")) return { name: "AliExpress", icon: "🌐", badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
  if (lower.includes("amazon.")) return { name: "Amazon", icon: "🛒", badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" };
  if (lower.includes("temu.com")) return { name: "Temu", icon: "🎯", badgeClass: "bg-orange-600/10 text-orange-700 border-orange-600/30" };
  if (lower.includes("cjdropshipping.com") || lower.includes("cjdrop.com")) return { name: "CJ Dropshipping", icon: "📦", badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
  if (lower.startsWith("http")) return { name: "Generic Product Page", icon: "🔗", badgeClass: "bg-secondary text-muted-foreground border-border" };
  return null;
}

// ─── Radar Chart (SVG) ───────────────────────────────────────────────────────

interface RadarDimension {
  label: string;
  value: number;
}

function RadarChart({ dimensions, size = 200 }: { dimensions: RadarDimension[]; size?: number }) {
  const n = dimensions.length;
  if (n === 0) return null;
  const center = size / 2;
  const radius = size * 0.35;
  const labelRadius = size * 0.47;

  const getXY = (index: number, r: number) => {
    const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = dimensions.map((d, i) => getXY(i, (d.value / 100) * radius));
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {gridLevels.map((level, gi) => {
        const gpts = dimensions.map((_, i) => getXY(i, level * radius));
        return <polygon key={gi} points={gpts.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="hsl(var(--border))" strokeWidth="0.8" />;
      })}
      {dimensions.map((_, i) => {
        const end = getXY(i, radius);
        return <line key={i} x1={center} y1={center} x2={end.x} y2={end.y} stroke="hsl(var(--border))" strokeWidth="0.8" />;
      })}
      <polygon points={polygon} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="2" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />)}
      {dimensions.map((d, i) => {
        const lp = getXY(i, labelRadius);
        const anchor = lp.x < center - 5 ? "end" : lp.x > center + 5 ? "start" : "middle";
        return (
          <text key={i} x={lp.x} y={lp.y + 4} textAnchor={anchor} fontSize="9" fill="hsl(var(--muted-foreground))">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Bulk Progress ────────────────────────────────────────────────────────────

interface BulkJobData {
  id: number;
  status: string;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  results: { url: string; listingId?: number; error?: string }[];
}

function BulkProgress({ jobId, onDone, onRetry }: { jobId: number; onDone: (r: BulkJobData) => void; onRetry: (failedUrls: string[]) => void }) {
  const { data: job } = useQuery<BulkJobData>({
    queryKey: ["/api/optimize/bulk", jobId],
    queryFn: () => fetch(`/api/optimize/bulk/${jobId}`).then(r => r.json()),
    refetchInterval: (q) => {
      const d = q.state.data as BulkJobData | undefined;
      if (!d || d.status === "done" || d.status === "failed") return false;
      return 2000;
    },
  });

  // All hooks must be declared before any conditional returns (React rules of hooks)
  const calledDone = useRef(false);
  const isDone = job ? (job.status === "done" || job.status === "failed") : false;
  useEffect(() => {
    if (job && isDone && job.status === "done" && !calledDone.current) {
      calledDone.current = true;
      onDone(job);
    }
  }, [isDone, job?.status]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Starting bulk job…
      </div>
    );
  }

  const pct = job.totalUrls ? Math.round(((job.completedCount + job.failedCount) / job.totalUrls) * 100) : 0;
  const failedUrls = job.results.filter(r => r.error).map(r => r.url);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Aggregate progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isDone ? `Completed ${job.totalUrls} URLs` : `Processing ${job.totalUrls} URLs…`}
          </span>
          <span className="font-medium">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {job.completedCount} done</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-destructive" /> {job.failedCount} failed</span>
          <span className="flex items-center gap-1"><Loader2 className={cn("w-3.5 h-3.5", isDone ? "hidden" : "animate-spin")} /> {job.totalUrls - job.completedCount - job.failedCount} pending</span>
        </div>
      </div>

      {/* Per-URL status rows */}
      {job.results.length > 0 && (
        <div className="border border-border/40 rounded-lg divide-y divide-border/30 max-h-64 overflow-y-auto">
          {job.results.map((r, i) => {
            const shortUrl = r.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60);
            const status = r.error ? "failed" : r.listingId ? "done" : "pending";
            return (
              <div key={i} data-testid={`bulk-url-row-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="shrink-0">
                  {status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {status === "failed" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                  {status === "pending" && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                </span>
                <span className="flex-1 text-muted-foreground truncate" title={r.url}>{shortUrl}</span>
                {status === "done" && r.listingId && (
                  <a
                    href={`/listing/${r.listingId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`bulk-view-listing-${r.listingId}`}
                    className="text-primary hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    View <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {status === "failed" && (
                  <span className="text-destructive truncate max-w-[120px]" title={r.error}>{r.error}</span>
                )}
              </div>
            );
          })}
          {/* Pending rows not yet in results */}
          {!isDone && Array.from({ length: Math.max(0, job.totalUrls - job.results.length) }).map((_, i) => (
            <div key={`pending-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
              <span className="text-muted-foreground italic">Queued…</span>
            </div>
          ))}
        </div>
      )}

      {/* Retry failed + bulk export */}
      {isDone && (
        <div className="flex gap-2 pt-1 flex-wrap">
          {failedUrls.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              data-testid="button-retry-failed"
              onClick={() => onRetry(failedUrls)}
              className="text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry {failedUrls.length} Failed
            </Button>
          )}
          {job.completedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              data-testid="button-export-bulk-csv"
              onClick={() => window.open(`/api/optimize/bulk/${jobId}/export-csv`, "_blank")}
              className="text-xs gap-1"
            >
              <FileText className="w-3 h-3" /> Export All to eBay CSV
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<"generate" | "optimizer" | "templates">("generate");
  const [selectedTemplate, setSelectedTemplate] = useState<ListingTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const searchStr = useSearch();
  const [url, setUrl] = useState(() => new URLSearchParams(searchStr).get("url") || "");
  const [inputMode, setInputMode] = useState<"url" | "manual" | "bulk">("url");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkJobId, setBulkJobId] = useState<number | null>(null);
  const [bulkDone, setBulkDone] = useState<BulkJobData | null>(null);
  const [titleInput, setTitleInput] = useState("");

  // Manual input state
  const [manualName, setManualName] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualImageUrls, setManualImageUrls] = useState("");

  const [titleScore, setTitleScore] = useState<{
    overall: number;
    dimensions: Record<string, number>;
    suggestions: string[];
    alternatives: { title: string; score: number; changes: string[] }[];
  } | null>(null);

  // ── Arena (multi-model compare) state ──────────────────────────────────────
  const [arenaMode, setArenaMode] = useState(false);
  type ArenaResult = { modelId: string; modelName: string; provider: string; free: boolean; title: string; htmlDescription: string; optimizationScore: { overall: number; grade: string }; latencyMs: number; status: "success" | "error"; recommended?: boolean };
  const [arenaResults, setArenaResults] = useState<ArenaResult[]>([]);
  const [arenaProductData, setArenaProductData] = useState<{ title: string; images?: string[] } | null>(null);
  const [arenaProductUrl, setArenaProductUrl] = useState<string>("");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const prefillTitle = new URLSearchParams(searchStr).get("prefillTitle") || "";
  const prefillUrl = new URLSearchParams(searchStr).get("url") || "";

  const platform = detectPlatformInfo(url.trim());

  const generateMutation = useMutation({
    mutationFn: async (data: { productUrl: string; titleOverride?: string }) => {
      const res = await apiRequest("POST", "/api/optimize", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Generation failed");
      }
      return res.json() as Promise<Listing>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "✨ Listing Generated!", description: "Redirecting to your full results…" });
      setLocation(`/listing/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: err.message });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const res = await apiRequest("POST", "/api/optimize/bulk", { urls });
      return res.json() as Promise<{ jobId: number }>;
    },
    onSuccess: (data) => setBulkJobId(data.jobId),
    onError: (err: Error) => toast({ variant: "destructive", title: "Bulk Job Failed", description: err.message }),
  });

  const manualMutation = useMutation({
    mutationFn: async (data: { productName: string; description: string; notes: string; category: string; imageUrls: string[] }) => {
      const res = await apiRequest("POST", "/api/optimize/manual", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Generation failed");
      }
      return res.json() as Promise<Listing>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "✨ Listing Generated!", description: "Redirecting to your full results…" });
      setLocation(`/listing/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: err.message });
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/title/score", { title });
      return res.json();
    },
    onSuccess: (data) => setTitleScore(data),
    onError: (err: Error) => toast({ variant: "destructive", title: "Scoring Failed", description: err.message }),
  });

  const arenaMutation = useMutation({
    mutationFn: async (data: { productUrl?: string; productData?: { title: string } }) => {
      const res = await apiRequest("POST", "/api/arena/compare", {
        ...data,
        modelIds: ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free", "mistralai/mistral-7b-instruct:free"],
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Arena compare failed");
      }
      return res.json() as Promise<{ results: ArenaResult[]; productData: { title: string; images?: string[] } }>;
    },
    onSuccess: (data) => {
      setArenaResults(data.results.filter(r => r.status === "success"));
      setArenaProductData(data.productData);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Compare Failed", description: err.message }),
  });

  const arenaSaveMutation = useMutation({
    mutationFn: async (result: ArenaResult) => {
      const res = await apiRequest("POST", "/api/arena/save", {
        title: result.title,
        htmlDescription: result.htmlDescription,
        images: arenaProductData?.images || [],
        productUrl: arenaProductUrl || "arena",
        productData: arenaProductData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Save failed");
      }
      return res.json() as Promise<Listing>;
    },
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "✨ Listing Saved!", description: "Redirecting to your results…" });
      setLocation(`/listing/${listing.id}`);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Save Failed", description: err.message }),
  });

  function handleSingleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    if (arenaMode) {
      setArenaResults([]);
      setArenaProductUrl(url.trim());
      arenaMutation.mutate({ productUrl: url.trim() });
    } else {
      generateMutation.mutate({ productUrl: url.trim(), ...(prefillTitle ? { titleOverride: prefillTitle } : {}) });
    }
  }

  function handleBulkGenerate() {
    const urls = bulkUrls.split("\n").map(u => u.trim()).filter(u => u.startsWith("http")).slice(0, 25);
    if (!urls.length) {
      toast({ variant: "destructive", title: "No valid URLs", description: "Enter one URL per line starting with http" });
      return;
    }
    bulkMutation.mutate(urls);
  }

  function handleManualGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) {
      toast({ variant: "destructive", title: "Product name required", description: "Enter a product name to generate a listing." });
      return;
    }
    const imageUrls = manualImageUrls
      .split(/[\n,]/)
      .map(u => u.trim())
      .filter(u => u.startsWith("http"));
    manualMutation.mutate({
      productName: manualName.trim(),
      description: manualDesc.trim(),
      notes: manualNotes.trim(),
      category: manualCategory,
      imageUrls,
    });
  }

  function handleScoreTitle() {
    const t = (titleInput || prefillTitle).trim();
    if (!t) return;
    scoreMutation.mutate(t);
  }

  const radarDimensions: RadarDimension[] = titleScore
    ? [
        { label: "Length", value: titleScore.dimensions.lengthUtilization ?? 0 },
        { label: "Keywords", value: titleScore.dimensions.keywordPlacement ?? 0 },
        { label: "Specific", value: titleScore.dimensions.specificity ?? 0 },
        { label: "Brand", value: titleScore.dimensions.brandInclusion ?? 0 },
        { label: "Condition", value: titleScore.dimensions.conditionClarity ?? 0 },
        { label: "Compliant", value: titleScore.dimensions.forbiddenWords ?? 0 },
      ]
    : [];

  const scoreColor = (s: number) => s >= 80 ? "text-emerald-500" : s >= 60 ? "text-yellow-500" : "text-red-500";
  const overallBadgeClass = titleScore
    ? titleScore.overall >= 80 ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
      : titleScore.overall >= 60 ? "text-yellow-700 border-yellow-500/30 bg-yellow-500/10"
      : "text-red-600 border-red-500/30 bg-red-500/10"
    : "";

  const bulkUrlList = bulkUrls.split("\n").map(u => u.trim()).filter(u => u.startsWith("http")).slice(0, 25);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" /> AI Listing Engine 2.0
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Cassini-optimized listings with item specifics, categories, image AI &amp; bulk mode
            </p>
          </div>
        </div>

        {prefillTitle && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 border-emerald-500/40 bg-emerald-500/5 flex items-start gap-3">
              <Tag className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Keyword prefilled from research</p>
                <p className="text-xs text-muted-foreground truncate">{prefillTitle}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setTitleInput(prefillTitle); setActiveTab("optimizer"); }}>
                Score It <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Card>
          </motion.div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "optimizer" | "templates")}>
          <TabsList className="w-full grid grid-cols-3" data-testid="tab-list">
            <TabsTrigger value="generate" data-testid="tab-generate" className="gap-2">
              <Zap className="w-4 h-4" /> AI Generator
            </TabsTrigger>
            <TabsTrigger value="optimizer" data-testid="tab-optimizer" className="gap-2">
              <BarChart3 className="w-4 h-4" /> Title Optimizer
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates" className="gap-2">
              <LayoutTemplate className="w-4 h-4" /> Quick Templates
            </TabsTrigger>
          </TabsList>

          {/* ── Generator Tab ─────────────────────────────────────────────── */}
          <TabsContent value="generate" className="space-y-6 mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={inputMode === "url" ? "default" : "outline"} size="sm" data-testid="btn-single-mode" onClick={() => { setInputMode("url"); setBulkMode(false); }} className="gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Single URL
              </Button>
              <Button variant={inputMode === "manual" ? "default" : "outline"} size="sm" data-testid="btn-manual-mode" onClick={() => { setInputMode("manual"); setBulkMode(false); }} className="gap-1.5">
                <PenLine className="w-3.5 h-3.5" /> Notes / Manual
              </Button>
              <Button variant={inputMode === "bulk" ? "default" : "outline"} size="sm" data-testid="btn-bulk-mode" onClick={() => { setInputMode("bulk"); setBulkMode(true); }} className="gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Bulk Mode
              </Button>
              {inputMode === "bulk" && <span className="text-xs text-muted-foreground">Up to 25 URLs, one per line</span>}
              {inputMode === "manual" && <span className="text-xs text-muted-foreground">No URL needed — describe your product</span>}
            </div>

            <AnimatePresence mode="wait">
              {inputMode === "url" ? (
                <motion.div key="single" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Card className="border-primary/10 shadow-lg shadow-primary/5">
                    <CardContent className="pt-6">
                      <form onSubmit={handleSingleGenerate} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="product-url">Product URL</Label>
                          <div className="relative">
                            <Input
                              id="product-url"
                              data-testid="input-product-url"
                              placeholder="https://www.amazon.com/dp/B09XY1234"
                              value={url}
                              onChange={e => setUrl(e.target.value)}
                              className="pr-12"
                            />
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2">
                                <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                              </a>
                            )}
                          </div>
                          <AnimatePresence>
                            {platform && url.startsWith("http") && (
                              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <Badge variant="outline" className={cn("text-xs gap-1", platform.badgeClass)}>
                                  {platform.icon} {platform.name} detected
                                </Badge>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button type="submit" data-testid="btn-generate" size="lg" className="flex-1 gap-2 font-semibold" disabled={!url.trim() || generateMutation.isPending || arenaMutation.isPending}>
                              {(generateMutation.isPending || arenaMutation.isPending) ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> {arenaMode ? "Comparing 3 AI Models…" : "Generating Full Listing…"}</>
                              ) : arenaMode ? (
                                <><GitCompare className="w-4 h-4" /> Compare 3 AI Models</>
                              ) : (
                                <><Sparkles className="w-4 h-4" /> Generate Full Listing</>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant={arenaMode ? "default" : "outline"}
                              size="lg"
                              data-testid="btn-arena-toggle"
                              onClick={() => { setArenaMode(!arenaMode); setArenaResults([]); }}
                              className={cn("gap-1.5 px-3", arenaMode && "bg-purple-600 hover:bg-purple-700 border-purple-600")}
                              title="Toggle multi-AI compare mode"
                            >
                              <Trophy className="w-4 h-4" />
                              {arenaMode ? "Arena ON" : "Arena"}
                            </Button>
                          </div>
                          {arenaMode && (
                            <p className="text-[11px] text-muted-foreground text-center">
                              Gemini · Llama · Mistral — runs in parallel, pick the best
                            </p>
                          )}
                        </div>
                      </form>

                      {generateMutation.isPending && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { icon: Globe, title: "Scraping", desc: platform?.name || "Product" },
                              { icon: Cpu, title: "AI Engine", desc: "Optimizing title" },
                              { icon: ListChecks, title: "Item Specifics", desc: "Extracting specs" },
                              { icon: Package, title: "Categories", desc: "Mapping eBay" },
                            ].map((step, i) => (
                              <div key={i} className="flex flex-col items-center gap-2 p-3 bg-secondary/50 rounded-xl text-center">
                                <div className="relative">
                                  <step.icon className="w-5 h-5 text-primary" />
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium">{step.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── Arena Inline Results ─────────────────────────────── */}
                  <AnimatePresence>
                    {arenaResults.length > 0 && (
                      <motion.div key="arena-results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-semibold">AI Arena Results</span>
                          <span className="text-xs text-muted-foreground">— pick the best version</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {arenaResults.map((result, i) => (
                            <motion.div key={result.modelId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                              <Card className={cn("relative border transition-colors", result.recommended ? "border-yellow-500/50 bg-yellow-500/5" : "border-border/50 hover:border-primary/30")}>
                                {result.recommended && (
                                  <div className="absolute -top-2.5 left-3">
                                    <Badge className="bg-yellow-500 text-yellow-950 text-[10px] gap-1 px-2">
                                      <Trophy className="w-2.5 h-2.5" /> Winner
                                    </Badge>
                                  </div>
                                )}
                                <CardContent className="pt-4 pb-3 px-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[120px]" title={result.modelName}>{result.modelName}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={cn("text-xs font-bold", result.optimizationScore.overall >= 80 ? "text-emerald-500" : result.optimizationScore.overall >= 60 ? "text-yellow-500" : "text-red-500")}>
                                        {result.optimizationScore.overall}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">/100</span>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">{result.optimizationScore.grade}</Badge>
                                    </div>
                                  </div>
                                  <p className="text-xs leading-relaxed line-clamp-2 text-foreground/90">{result.title}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span>{Math.round(result.latencyMs / 1000)}s</span>
                                    {result.free && <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-600 border-emerald-500/30">FREE</Badge>}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full text-xs h-7 mt-1"
                                    variant={result.recommended ? "default" : "outline"}
                                    onClick={() => arenaSaveMutation.mutate(result)}
                                    disabled={arenaSaveMutation.isPending}
                                    data-testid={`btn-arena-use-${i}`}
                                  >
                                    {arenaSaveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use This Version"}
                                  </Button>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!generateMutation.isPending && !arenaMode && (
                    <Card className="border-border/40">
                      <CardContent className="pt-5">
                        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">What you get</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { icon: FileText, label: "Cassini-optimized title ≤80 chars" },
                            { icon: AlignLeft, label: "HTML description with feature blocks" },
                            { icon: Image, label: "Product image gallery" },
                            { icon: ListChecks, label: "Auto item specifics table" },
                            { icon: Package, label: "Top 5 eBay category suggestions" },
                            { icon: BarChart3, label: "6-dimension SEO title score" },
                          ].map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <f.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" /> {f.label}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ) : inputMode === "manual" ? (
                <motion.div key="manual" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Card className="border-primary/10 shadow-lg shadow-primary/5">
                    <CardContent className="pt-6">
                      <form onSubmit={handleManualGenerate} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="manual-name">Product Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="manual-name"
                            data-testid="input-manual-name"
                            placeholder='e.g. "Sony WH-1000XM5 Wireless Headphones Black"'
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            maxLength={200}
                          />
                          <p className="text-[11px] text-muted-foreground">{manualName.length}/200 chars</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="manual-category">Category Hint <span className="text-muted-foreground text-xs">(optional)</span></Label>
                          <Select value={manualCategory} onValueChange={setManualCategory}>
                            <SelectTrigger id="manual-category" data-testid="select-manual-category">
                              <SelectValue placeholder="Select a category…" />
                            </SelectTrigger>
                            <SelectContent>
                              {["Electronics", "Fashion", "Home & Garden", "Collectibles", "Sports & Outdoors", "Toys & Games", "Health & Beauty", "Motors Parts", "Books", "Business & Industrial"].map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="manual-desc">Product Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                          <Textarea
                            id="manual-desc"
                            data-testid="textarea-manual-desc"
                            placeholder="Paste any product description, feature list, spec sheet, or bullet points here…"
                            value={manualDesc}
                            onChange={e => setManualDesc(e.target.value)}
                            rows={4}
                            maxLength={5000}
                            className="resize-y"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="manual-notes">Notes for AI <span className="text-muted-foreground text-xs">(optional)</span></Label>
                          <Textarea
                            id="manual-notes"
                            data-testid="textarea-manual-notes"
                            placeholder='e.g. "Target audiophiles & gamers. Emphasize noise cancelling. Competitor: Bose QuietComfort 45."'
                            value={manualNotes}
                            onChange={e => setManualNotes(e.target.value)}
                            rows={2}
                            maxLength={2000}
                            className="resize-y"
                          />
                          <p className="text-[11px] text-muted-foreground">Tell the AI who to target, what to emphasise, or any special instructions.</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="manual-images">Image URLs <span className="text-muted-foreground text-xs">(optional — comma or newline separated)</span></Label>
                          <Textarea
                            id="manual-images"
                            data-testid="textarea-manual-images"
                            placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                            value={manualImageUrls}
                            onChange={e => setManualImageUrls(e.target.value)}
                            rows={2}
                            className="resize-y font-mono text-xs"
                          />
                        </div>

                        <Button type="submit" data-testid="btn-manual-generate" size="lg" className="w-full gap-2 font-semibold" disabled={!manualName.trim() || manualMutation.isPending}>
                          {manualMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating from your notes…</>
                          ) : (
                            <><Sparkles className="w-4 h-4" /> Generate Full eBay Listing</>
                          )}
                        </Button>
                      </form>
                      {manualMutation.isPending && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { icon: PenLine, title: "Reading Notes", desc: "Parsing your input" },
                              { icon: Cpu, title: "AI Engine", desc: "Crafting title" },
                              { icon: ListChecks, title: "Item Specifics", desc: "Auto-extracting" },
                              { icon: Package, title: "Categories", desc: "Mapping eBay" },
                            ].map((step, i) => (
                              <div key={i} className="flex flex-col items-center gap-2 p-3 bg-secondary/50 rounded-xl text-center">
                                <div className="relative">
                                  <step.icon className="w-5 h-5 text-primary" />
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
                                </div>
                                <p className="text-xs font-medium">{step.title}</p>
                                <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="bulk" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Card className="border-primary/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" /> Bulk URL Input
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bulk-urls">One URL per line (max 25)</Label>
                        <Textarea
                          id="bulk-urls"
                          data-testid="textarea-bulk-urls"
                          placeholder={"https://www.amazon.com/dp/B09XY1234\nhttps://www.aliexpress.com/item/123456789.html"}
                          value={bulkUrls}
                          onChange={e => setBulkUrls(e.target.value)}
                          rows={8}
                          className="font-mono text-xs resize-none"
                        />
                        {bulkUrlList.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{bulkUrlList.length} valid URL{bulkUrlList.length !== 1 ? "s" : ""}</Badge>
                            {bulkUrlList.length >= 25 && <Badge variant="destructive">Max 25 URLs</Badge>}
                          </div>
                        )}
                      </div>

                      {bulkJobId && !bulkDone ? (
                        <BulkProgress
                          jobId={bulkJobId}
                          onDone={setBulkDone}
                          onRetry={(failedUrls) => {
                            setBulkDone(null);
                            setBulkJobId(null);
                            setBulkUrls(failedUrls.join("\n"));
                          }}
                        />
                      ) : bulkDone ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Bulk job complete — {bulkDone.completedCount} listings created
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {bulkDone.results.slice(0, 6).map((r, i) => (
                              <a key={i} href={r.listingId ? `/listing/${r.listingId}` : "#"} data-testid={`bulk-result-${i}`}
                                className={cn("text-xs p-2 rounded-lg border flex items-center gap-2", r.listingId ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-destructive/30 bg-destructive/5")}>
                                {r.listingId ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
                                <span className="truncate">{r.url.replace(/^https?:\/\/(?:www\.)?/, "").slice(0, 35)}</span>
                                {!r.listingId && r.error && (
                                  <span className="text-destructive/70 text-[10px] truncate" title={r.error}>{r.error.slice(0, 20)}…</span>
                                )}
                              </a>
                            ))}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {bulkDone.failedCount > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid="btn-retry-failed-done"
                                onClick={() => {
                                  const failedUrls = bulkDone.results.filter(r => r.error).map(r => r.url);
                                  setBulkDone(null);
                                  setBulkJobId(null);
                                  setBulkUrls(failedUrls.join("\n"));
                                }}
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry {bulkDone.failedCount} Failed
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setBulkDone(null); setBulkJobId(null); setBulkUrls(""); }}>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> New Batch
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        <Button data-testid="btn-bulk-generate" size="lg" className="w-full gap-2 font-semibold" disabled={bulkUrlList.length === 0 || bulkMutation.isPending} onClick={handleBulkGenerate}>
                          {bulkMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting Job…</> : <><Layers className="w-4 h-4" /> Generate {Math.min(bulkUrlList.length, 25)} Listings</>}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Title Optimizer Tab ───────────────────────────────────────── */}
          <TabsContent value="optimizer" className="space-y-6 mt-6">
            <Card className="border-primary/10">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title-input">eBay Listing Title to Score</Label>
                  <div className="flex gap-2">
                    <Input
                      id="title-input"
                      data-testid="input-title-optimizer"
                      placeholder="Paste your eBay title here…"
                      value={titleInput || prefillTitle}
                      onChange={e => setTitleInput(e.target.value)}
                      maxLength={200}
                      className="flex-1"
                    />
                    <Button data-testid="btn-score-title" onClick={handleScoreTitle} disabled={(!titleInput && !prefillTitle) || scoreMutation.isPending} className="gap-2 shrink-0">
                      {scoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Score
                    </Button>
                  </div>
                  {(titleInput || prefillTitle) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(titleInput || prefillTitle).length} / 80 chars</span>
                      {(titleInput || prefillTitle).length > 80 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Too long</Badge>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <AnimatePresence>
              {titleScore && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-border/40">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">SEO Radar</CardTitle></CardHeader>
                      <CardContent className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <RadarChart dimensions={radarDimensions} size={200} />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={cn("text-3xl font-bold tabular-nums", scoreColor(titleScore.overall))}>{titleScore.overall}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("text-sm px-3 py-1", overallBadgeClass)}>
                          {titleScore.overall >= 80 ? "Excellent" : titleScore.overall >= 60 ? "Good" : titleScore.overall >= 40 ? "Needs Work" : "Poor"} — {titleScore.overall}/100
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Dimension Scores</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {radarDimensions.map((dim) => (
                          <div key={dim.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{dim.label}</span>
                              <span className={cn("font-medium tabular-nums", scoreColor(dim.value))}>{dim.value}</span>
                            </div>
                            <Progress value={dim.value} className="h-1.5" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {titleScore.suggestions.length > 0 && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Suggestions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5">
                          {titleScore.suggestions.map((s, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" /> {s}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {titleScore.alternatives.length > 0 && (
                    <Card className="border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /> Optimized Alternatives</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {titleScore.alternatives.map((alt, i) => (
                          <div key={i} className="p-3 bg-secondary/50 rounded-xl border border-border/40 space-y-2 group">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium flex-1">{alt.title}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className={cn("text-xs", scoreColor(alt.score))}>{alt.score}</Badge>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`btn-use-alt-${i}`}
                                  onClick={() => { setTitleInput(alt.title); toast({ title: "Title copied to input", description: "Click Score to re-analyze" }); }}>
                                  Use This
                                </Button>
                              </div>
                            </div>
                            {alt.changes.map((c, ci) => (
                              <p key={ci} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <ArrowRight className="w-3 h-3 flex-shrink-0" /> {c}
                              </p>
                            ))}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Quick Templates Tab ────────────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-6 mt-6">
            <div className="space-y-2">
              <h2 className="text-base font-bold text-foreground">Quick HTML Description Templates</h2>
              <p className="text-sm text-muted-foreground">
                Choose a category template to instantly generate a professional eBay description. Paste into your listing or customise it further.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LISTING_TEMPLATES.map((tpl) => (
                <Card
                  key={tpl.id}
                  className={cn(
                    "border cursor-pointer transition-all hover:shadow-md group",
                    selectedTemplate?.id === tpl.id ? "border-primary/60 bg-primary/5 shadow-md" : "border-border/60 hover:border-primary/30"
                  )}
                  onClick={() => {
                    setSelectedTemplate(tpl);
                    setPreviewHtml(applyTemplate(tpl));
                  }}
                  data-testid={`card-template-${tpl.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-foreground">{tpl.name}</p>
                          {selectedTemplate?.id === tpl.id && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Selected</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{tpl.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {tpl.keyFields.slice(0, 4).map((f) => (
                            <Badge key={f} variant="outline" className="text-xs h-5 px-1.5">{f}</Badge>
                          ))}
                          {tpl.keyFields.length > 4 && (
                            <Badge variant="outline" className="text-xs h-5 px-1.5">+{tpl.keyFields.length - 4} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedTemplate && previewHtml && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        {selectedTemplate.emoji} {selectedTemplate.name} — Template Preview
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          data-testid="btn-copy-template-html"
                          onClick={() => {
                            navigator.clipboard.writeText(previewHtml);
                            toast({ title: "HTML copied to clipboard", description: "Paste it into your eBay listing description" });
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy HTML
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          data-testid="btn-use-template"
                          onClick={() => {
                            setActiveTab("generate");
                            toast({ title: "Template ready", description: "Paste the copied HTML into your eBay description field, or use AI Generator to build on top of it" });
                          }}
                        >
                          <Zap className="w-3.5 h-3.5" /> Use with AI Generator
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-1">Example eBay title for this template:</p>
                      <p className="font-mono text-foreground/80">{selectedTemplate.exampleTitle}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-1">Key item specifics you should fill in:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedTemplate.keyFields.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live Preview</p>
                      <div
                        className="border border-border/50 rounded-lg overflow-hidden bg-white"
                        style={{ maxHeight: "500px", overflowY: "auto" }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
