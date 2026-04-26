import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Trophy, Star, Cpu, Clock, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, Eye, Copy, Save, Sparkles, BarChart2, AlertTriangle,
  Play, RotateCcw, Flame, Crown, Shield, Gauge, ArrowUp, Info
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  free: boolean;
  contextK: number;
  strengths: string[];
  speed: "fast" | "medium" | "slow";
  recommended?: boolean;
}

interface OptimizationDimension {
  name: string;
  score: number;
  max: number;
  detail: string;
}

interface OptimizationScore {
  overall: number;
  grade: string;
  rankingConfidence: string;
  rankingConfidenceColor: string;
  dimensions: OptimizationDimension[];
  suggestions: string[];
  delta?: number;
}

interface ArenaEntry {
  modelId: string;
  modelName: string;
  provider: string;
  free: boolean;
  title: string;
  htmlDescription: string;
  optimizationScore: OptimizationScore;
  latencyMs: number;
  status: "success" | "error";
  errorMessage?: string;
  recommended?: boolean;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white leading-none">{score}</span>
        <span className="text-[9px] text-white/50 uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

function GradeTag({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    "A+": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "A": "bg-green-500/20 text-green-300 border-green-500/30",
    "B+": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "B": "bg-blue-400/20 text-blue-300 border-blue-400/30",
    "C": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "D": "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded border ${colors[grade] || colors["C"]}`}>
      {grade}
    </span>
  );
}

function RankingBadge({ confidence, color }: { confidence: string; color: string }) {
  const styles: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-300",
    blue: "bg-blue-500/20 text-blue-300",
    yellow: "bg-amber-500/20 text-amber-300",
    red: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${styles[color] || styles.yellow}`}>
      <Gauge className="w-3 h-3" />
      {confidence} to Rank
    </span>
  );
}

function DimensionBar({ dim }: { dim: OptimizationDimension }) {
  const pct = Math.round((dim.score / dim.max) * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70">{dim.name}</span>
        <span className="font-semibold text-white">{dim.score}<span className="text-white/40">/{dim.max}</span></span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-white/40">{dim.detail}</p>
    </div>
  );
}

function ModelCard({
  entry,
  rank,
  onSelect,
  onPreview,
}: {
  entry: ArenaEntry;
  rank: number;
  onSelect: (entry: ArenaEntry) => void;
  onPreview: (entry: ArenaEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  if (entry.status === "error") {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">{entry.modelName}</p>
          <p className="text-xs text-red-400 mt-0.5">{entry.errorMessage || "Model failed to respond"}</p>
        </div>
      </div>
    );
  }

  const score = entry.optimizationScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className={`rounded-xl border bg-white/[0.03] overflow-hidden ${
        entry.recommended
          ? "border-yellow-500/50 ring-1 ring-yellow-500/20"
          : "border-white/10"
      }`}
    >
      {/* Card Header */}
      <div className="p-4 flex items-start gap-4">
        {/* Rank + Score */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
            rank === 0 ? "bg-yellow-500 text-black" : rank === 1 ? "bg-slate-400 text-black" : "bg-amber-700/60 text-white"
          }`}>
            {rank + 1}
          </div>
          <ScoreRing score={score.overall} size={68} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">{entry.modelName}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${entry.free ? "border-emerald-500/40 text-emerald-400" : "border-violet-500/40 text-violet-400"}`}>
                  {entry.free ? "FREE" : "PREMIUM"}
                </Badge>
                {entry.recommended && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    <Crown className="w-2.5 h-2.5 mr-1" /> WINNER
                  </Badge>
                )}
              </div>
              <p className="text-xs text-white/40 mt-0.5">{entry.provider} · {(entry.latencyMs / 1000).toFixed(1)}s</p>
            </div>
            <div className="flex items-center gap-2">
              <GradeTag grade={score.grade} />
              <RankingBadge confidence={score.rankingConfidence} color={score.rankingConfidenceColor} />
            </div>
          </div>

          {/* Generated title */}
          <div className="mt-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Generated Title · {entry.title.length} chars</p>
            <p className="text-sm font-medium text-white leading-snug">{entry.title}</p>
          </div>

          {/* Delta */}
          {score.delta !== undefined && score.delta !== 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <ArrowUp className={`w-3 h-3 ${score.delta > 0 ? "text-emerald-400" : "text-red-400 rotate-180"}`} />
              <span className={score.delta > 0 ? "text-emerald-400" : "text-red-400"}>
                {score.delta > 0 ? "+" : ""}{score.delta} title optimization points vs. raw input
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable scoring */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          data-testid={`arena-expand-${entry.modelId}`}
        >
          <span className="flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> View Scoring Breakdown
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {score.dimensions.map((dim, i) => (
                  <DimensionBar key={i} dim={dim} />
                ))}
                {score.suggestions.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Suggestions to Improve
                    </p>
                    <ul className="space-y-1">
                      {score.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-white/60 flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5">·</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="border-t border-white/5 p-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs border-white/10 hover:bg-white/5 text-white/70"
          onClick={() => onPreview(entry)}
          data-testid={`arena-preview-${entry.modelId}`}
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 border-white/10 hover:bg-white/5 text-white/70"
          onClick={() => {
            navigator.clipboard.writeText(entry.title);
            toast({ title: "Title copied", description: entry.title });
          }}
          data-testid={`arena-copy-${entry.modelId}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          className={`flex-1 h-8 text-xs ${entry.recommended ? "bg-yellow-500 hover:bg-yellow-400 text-black font-bold" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          onClick={() => onSelect(entry)}
          data-testid={`arena-select-${entry.modelId}`}
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {entry.recommended ? "Use Winner" : "Select"}
        </Button>
      </div>
    </motion.div>
  );
}

function ModelCheckbox({ model, checked, onChange }: { model: ModelInfo; checked: boolean; onChange: (v: boolean) => void }) {
  const speedColor = model.speed === "fast" ? "text-emerald-400" : model.speed === "medium" ? "text-amber-400" : "text-red-400";
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
        checked ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5"
      }`}
      data-testid={`model-checkbox-${model.id}`}
    >
      <div className="mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-blue-500 w-4 h-4"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{model.name}</span>
          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${model.free ? "border-emerald-500/40 text-emerald-400" : "border-violet-500/40 text-violet-400"}`}>
            {model.free ? "FREE" : "PAID"}
          </Badge>
          {model.recommended && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
        </div>
        <p className="text-xs text-white/40 mt-0.5">{model.provider}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] font-medium ${speedColor}`}>● {model.speed}</span>
          <span className="text-[10px] text-white/30">·</span>
          {model.strengths.slice(0, 2).map(s => (
            <span key={s} className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      </div>
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIArenaPage() {
  const { toast } = useToast();

  // Input state
  const [inputTab, setInputTab] = useState<"url" | "manual">("url");
  const [productUrl, setProductUrl] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set([
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
  ]));

  // Results
  const [results, setResults] = useState<ArenaEntry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<ArenaEntry | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "free" | "premium">("all");

  // Fetch model registry
  const { data: modelsData } = useQuery<{ models: ModelInfo[] }>({
    queryKey: ["/api/arena/models"],
  });
  const allModels = modelsData?.models || [];

  const freeModels = allModels.filter(m => m.free);
  const premiumModels = allModels.filter(m => !m.free);

  // Arena compare mutation
  const compareMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        modelIds: Array.from(selectedModels),
      };
      if (inputTab === "url" && productUrl) {
        payload.productUrl = productUrl;
      } else {
        payload.productData = {
          title: productTitle,
          description: productDescription,
        };
      }
      const res = await apiRequest("POST", "/api/arena/compare", payload);
      return res.json() as Promise<{ results: ArenaEntry[]; productData: any }>;
    },
    onSuccess: (data) => {
      setResults(data.results);
      toast({
        title: `Arena complete — ${data.results.filter(r => r.status === "success").length} results`,
        description: "Models ranked by eBay optimization score.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Arena failed", description: err.message, variant: "destructive" });
    },
  });

  // Full auto mutation
  const autoMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      if (inputTab === "url" && productUrl) {
        payload.productUrl = productUrl;
      } else {
        payload.productData = { title: productTitle, description: productDescription };
      }
      const res = await apiRequest("POST", "/api/arena/auto", payload);
      return res.json() as Promise<{ winner: ArenaEntry; listing: any }>;
    },
    onSuccess: (data) => {
      setResults([data.winner]);
      toast({
        title: "Full Auto Complete",
        description: `Winner: ${data.winner.modelName} · Score: ${data.winner.optimizationScore.overall}/100`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Auto failed", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = compareMutation.isPending || autoMutation.isPending;

  const handleSelectAll = (free: boolean) => {
    const models = free ? freeModels : premiumModels;
    const newSet = new Set(selectedModels);
    models.forEach(m => newSet.add(m.id));
    setSelectedModels(newSet);
  };

  const handleDeselectAll = () => setSelectedModels(new Set());

  const filteredResults = results.filter(r => {
    if (filterTab === "free") return r.free;
    if (filterTab === "premium") return !r.free;
    return true;
  });

  const canRun = (inputTab === "url" ? productUrl.trim() : productTitle.trim()) && selectedModels.size > 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">AI Model Arena</h1>
                <p className="text-sm text-white/50">Compare free AI models side-by-side · Ranked by eBay optimization score</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs">
              <Zap className="w-3 h-3 mr-1" /> {freeModels.length} Free Models
            </Badge>
            <Badge className="bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs">
              <Crown className="w-3 h-3 mr-1" /> {premiumModels.length} Premium Models
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Panel: Input + Model Selection ────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Input Tabs */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" /> Product Input
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <Tabs value={inputTab} onValueChange={v => setInputTab(v as "url" | "manual")}>
                  <TabsList className="w-full bg-white/5">
                    <TabsTrigger value="url" className="flex-1 text-xs">From URL</TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1 text-xs">Manual</TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-3">
                    <Input
                      placeholder="AliExpress / Amazon / Temu URL..."
                      value={productUrl}
                      onChange={e => setProductUrl(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                      data-testid="arena-url-input"
                    />
                    <p className="text-[10px] text-white/30 mt-1.5">The product will be auto-scraped before models run.</p>
                  </TabsContent>
                  <TabsContent value="manual" className="mt-3 space-y-2">
                    <Input
                      placeholder="Product name / title..."
                      value={productTitle}
                      onChange={e => setProductTitle(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                      data-testid="arena-title-input"
                    />
                    <Textarea
                      placeholder="Product description (optional)..."
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
                      rows={4}
                      data-testid="arena-description-input"
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold h-11 shadow-lg shadow-violet-500/20"
                disabled={!canRun || isLoading}
                onClick={() => compareMutation.mutate()}
                data-testid="arena-run-btn"
              >
                {compareMutation.isPending ? (
                  <><RotateCcw className="w-4 h-4 mr-2 animate-spin" /> Running {selectedModels.size} models...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Run Arena ({selectedModels.size} models)</>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-semibold h-10"
                disabled={!canRun || isLoading}
                onClick={() => autoMutation.mutate()}
                data-testid="arena-auto-btn"
              >
                {autoMutation.isPending ? (
                  <><RotateCcw className="w-4 h-4 mr-2 animate-spin" /> Auto-picking best...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> One-Click Full Auto</>
                )}
              </Button>
              <p className="text-[10px] text-white/30 text-center">Full Auto runs all fast free models and picks the highest-scoring result automatically.</p>
            </div>

            {/* Model Selection */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-white/50" /> Select Models
                </h2>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleSelectAll(true)} className="text-[10px] text-emerald-400 hover:text-emerald-300">+Free</button>
                  <span className="text-white/20">·</span>
                  <button onClick={handleDeselectAll} className="text-[10px] text-white/40 hover:text-white/60">Clear</button>
                </div>
              </div>

              <div className="p-3 space-y-1 max-h-[480px] overflow-y-auto">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-2 px-1">Free Tier (No Credits)</p>
                {freeModels.map(model => (
                  <ModelCheckbox
                    key={model.id}
                    model={model}
                    checked={selectedModels.has(model.id)}
                    onChange={v => {
                      const s = new Set(selectedModels);
                      v ? s.add(model.id) : s.delete(model.id);
                      setSelectedModels(s);
                    }}
                  />
                ))}

                <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mt-4 mb-2 px-1">Premium (Requires Credits)</p>
                {premiumModels.map(model => (
                  <ModelCheckbox
                    key={model.id}
                    model={model}
                    checked={selectedModels.has(model.id)}
                    onChange={v => {
                      const s = new Set(selectedModels);
                      v ? s.add(model.id) : s.delete(model.id);
                      setSelectedModels(s);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Strategy tip */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Recommended Strategy
              </p>
              <ul className="space-y-1">
                {[
                  "Run 3–5 free models for best variety",
                  "Gemini 2.0 Flash = fastest + most structured",
                  "Llama 3.3 70B = best natural descriptions",
                  "Use Full Auto for instant single best result",
                ].map((tip, i) => (
                  <li key={i} className="text-[10px] text-white/50 flex items-start gap-1">
                    <span className="text-blue-400">·</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Right Panel: Results ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Loading state */}
            {isLoading && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
                  <p className="text-white font-semibold">Running {selectedModels.size} models in parallel...</p>
                  <p className="text-white/40 text-sm mt-1">Generating and scoring eBay listings simultaneously</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 max-w-sm mx-auto text-xs text-white/50">
                    {Array.from(selectedModels).map(id => {
                      const m = allModels.find(m => m.id === id);
                      return m ? (
                        <div key={id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                          {m.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* No results placeholder */}
            {!isLoading && results.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Arena Ready</h3>
                <p className="text-white/40 text-sm max-w-xs mx-auto">
                  Select models and enter a product to see them compete. Each model generates a listing and gets scored for eBay ranking potential.
                </p>
              </div>
            )}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <>
                {/* Summary bar */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold text-white">{results.filter(r => r.status === "success").length} Results</span>
                  </div>
                  {results[0]?.status === "success" && (
                    <>
                      <div className="h-4 w-px bg-white/10" />
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-white/60">Winner: <span className="text-white font-semibold">{results[0].modelName}</span> · Score {results[0].optimizationScore.overall}/100</span>
                      </div>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {(["all", "free", "premium"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFilterTab(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-colors ${filterTab === t ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredResults.map((entry, i) => (
                    <ModelCard
                      key={entry.modelId}
                      entry={entry}
                      rank={i}
                      onSelect={(e) => {
                        toast({
                          title: "Listing saved",
                          description: `${e.modelName}'s output saved to your listing history.`,
                        });
                      }}
                      onPreview={setPreviewEntry}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Description Preview Modal ───────────────────────────────── */}
      <AnimatePresence>
        {previewEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setPreviewEntry(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <p className="font-bold text-white">{previewEntry.modelName} · Description Preview</p>
                  <p className="text-xs text-white/40">{previewEntry.provider} · Score {previewEntry.optimizationScore.overall}/100</p>
                </div>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-white/50" onClick={() => setPreviewEntry(null)}>
                  ✕
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-white rounded-b-2xl">
                <div dangerouslySetInnerHTML={{ __html: previewEntry.htmlDescription }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
