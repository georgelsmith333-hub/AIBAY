import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useListing } from "@/hooks/use-listings";
import { Layout } from "@/components/layout";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft, Download, ImageIcon, FileText, Code, Loader2, Sparkles,
  ListChecks, Package, ExternalLink, BarChart3, Check, Pencil, X, Plus,
  Trash2, RefreshCw, Wand2, Layers, Crown, EyeOff, Archive, ArrowUp,
  ArrowDown, Monitor, Smartphone, SplitSquareHorizontal, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { computeListingScore, type ListingOptimizationScore } from "@/lib/optimizationScore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemSpecific {
  name: string;
  value: string;
  source: "scraped" | "ai";
}

interface CategorySuggestion {
  name: string;
  breadcrumb: string;
  categoryId: string;
  confidence: number;
  reason: string;
}

interface TitleScore {
  overall: number;
  dimensions: {
    lengthUtilization: number;
    keywordPlacement: number;
    specificity: number;
    brandInclusion: number;
    conditionClarity: number;
    forbiddenWords: number;
  };
  suggestions: string[];
  alternatives: { title: string; score: number; changes: string[] }[];
}

interface SourceData {
  platform?: string;
  price?: number;
  brand?: string;
  categoryBreadcrumb?: string;
  lifestylePrompts?: string[];
}

interface ImageProcessedEntry {
  url: string;
  upscaledUrl?: string;
  noBgUrl?: string;
  status?: "done" | "failed" | "skipped";
}

// ─── Score Color Helpers ──────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 80 ? "text-emerald-500" : s >= 60 ? "text-yellow-500" : "text-red-500";
}

function scoreBadgeClass(s: number) {
  return s >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
    : s >= 60 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700"
    : "border-red-500/30 bg-red-500/10 text-red-600";
}

// ─── Before / After Image Slider ─────────────────────────────────────────────

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) updatePos(e.clientX); };
    const onUp = () => { dragging.current = false; };
    const onTouch = (e: TouchEvent) => { if (dragging.current) updatePos(e.touches[0].clientX); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, [updatePos]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden select-none aspect-square cursor-ew-resize border border-border/50"
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
    >
      <img src={after} alt="Processed" className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img src={before} alt="Original" className="w-full h-full object-cover" />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md" style={{ left: `${position}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center">
          <SplitSquareHorizontal className="w-3.5 h-3.5 text-foreground" />
        </div>
      </div>
      <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Original</span>
      <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Processed</span>
    </div>
  );
}

// ─── Image Metadata Editor ────────────────────────────────────────────────────

interface ImageMeta {
  url: string;
  label: string;
  isHero: boolean;
  isExcluded: boolean;
  originalIndex: number;
}

function ImageMetadataEditor({ listingId, images, existingMeta }: {
  listingId: number;
  images: string[];
  existingMeta: ImageMeta[] | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [meta, setMeta] = useState<ImageMeta[]>(() => {
    if (existingMeta && existingMeta.length === images.length) return existingMeta;
    return images.map((url, i) => ({
      url,
      label: `Image ${i + 1}`,
      isHero: i === 0,
      isExcluded: false,
      originalIndex: i,
    }));
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ImageMeta[]) => {
      const res = await apiRequest("PATCH", `/api/listings/${listingId}/images`, { imageMetadata: data });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings", listingId] });
      toast({ title: "Image metadata saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Save failed", description: e.message }),
  });

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= meta.length) return;
    const next = [...meta];
    [next[i], next[j]] = [next[j], next[i]];
    setMeta(next);
  }

  function toggleHero(i: number) {
    setMeta(prev => prev.map((m, idx) => ({ ...m, isHero: idx === i })));
  }

  function toggleExclude(i: number) {
    setMeta(prev => prev.map((m, idx) => idx === i ? { ...m, isExcluded: !m.isExcluded } : m));
  }

  function setLabel(i: number, label: string) {
    setMeta(prev => prev.map((m, idx) => idx === i ? { ...m, label } : m));
  }

  return (
    <div className="space-y-3">
      <div className="border border-border/40 rounded-lg overflow-hidden">
        {meta.map((m, i) => (
          <div key={m.url} className={cn("flex items-center gap-2 px-3 py-2 text-xs border-b border-border/20 last:border-b-0", m.isExcluded && "opacity-40")}>
            <img src={m.url} alt="" className="w-10 h-10 rounded object-cover border border-border/30 shrink-0" />
            <Input
              value={m.label}
              onChange={e => setLabel(i, e.target.value)}
              className="h-7 text-xs flex-1"
              data-testid={`input-img-label-${i}`}
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant={m.isHero ? "default" : "ghost"}
                className="w-7 h-7"
                title="Set as hero image"
                data-testid={`btn-img-hero-${i}`}
                onClick={() => toggleHero(i)}
              >
                <Crown className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant={m.isExcluded ? "destructive" : "ghost"}
                className="w-7 h-7"
                title="Exclude from listing"
                data-testid={`btn-img-exclude-${i}`}
                onClick={() => toggleExclude(i)}
              >
                <EyeOff className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => move(i, 1)} disabled={i === meta.length - 1}><ArrowDown className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span><Crown className="w-3 h-3 inline mr-1 text-amber-500" />Hero = eBay main image  ·  <EyeOff className="w-3 h-3 inline mr-1" />Excluded = hidden from export</span>
        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate(meta)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save Order
        </Button>
      </div>
    </div>
  );
}

// ─── Description Block Editor ─────────────────────────────────────────────────

interface DescriptionBlock {
  id: string;
  name: string;
  html: string;
  enabled: boolean;
}

function parseHtmlIntoBlocks(html: string): DescriptionBlock[] {
  if (typeof document === "undefined") return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) return [{ id: "full", name: "Full Description", html, enabled: true }];

    const children = Array.from(wrapper.children);
    if (children.length < 2) return [{ id: "full", name: "Full Description", html, enabled: true }];

    return children.map((el, i) => {
      const inner = el.outerHTML;
      const text = el.textContent || "";
      let name = `Block ${i + 1}`;
      if (el.getAttribute("style")?.includes("linear-gradient") || el.getAttribute("style")?.includes("gradient")) name = "Header Banner";
      else if (el.querySelector("ul")) name = "Feature Bullets";
      else if (el.querySelector("table")) name = "Specs Table";
      else if (text.includes("Why Buy") || text.includes("Top Rated") || text.includes("⭐") || text.includes("🏆")) name = "Trust Badges";
      else if (text.includes("Return") || text.includes("Dispatch") || text.includes("Shipping") || text.includes("↩️")) name = "Shipping & Returns";
      return { id: `block-${i}`, name, html: inner, enabled: true };
    });
  } catch {
    return [{ id: "full", name: "Full Description", html, enabled: true }];
  }
}

function EBAY_TEMPLATE_1(title: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#212529;line-height:1.6;">
  <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:28px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:22px;font-weight:700;">${title}</h1>
    <p style="margin:8px 0 0;opacity:0.85;font-size:14px;">Premium Quality — Fast UK Dispatch</p>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
    <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e3a8a;">✅ Key Features</h2>
    <ul style="margin:0;padding:0 0 0 0;list-style:none;">
      <li style="padding:6px 0;border-bottom:1px solid #f1f3f5;display:flex;align-items:flex-start;gap:8px;"><span style="color:#2563eb;font-weight:700;">✓</span><span>High-quality construction for long-lasting performance</span></li>
      <li style="padding:6px 0;border-bottom:1px solid #f1f3f5;display:flex;align-items:flex-start;gap:8px;"><span style="color:#2563eb;font-weight:700;">✓</span><span>Compatible with a wide range of devices and setups</span></li>
      <li style="padding:6px 0;display:flex;align-items:flex-start;gap:8px;"><span style="color:#2563eb;font-weight:700;">✓</span><span>Ready to use straight out of the box</span></li>
    </ul>
  </div>
  <div style="padding:24px;background:#f0f7ff;border:1px solid #dee2e6;border-top:none;">
    <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e3a8a;">⭐ Why Buy From Us?</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">🏆</div><div style="font-weight:600;margin-bottom:4px;">Top Rated Seller</div><div style="color:#6c757d;">100% positive feedback</div></div>
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">🚚</div><div style="font-weight:600;margin-bottom:4px;">Fast Dispatch</div><div style="color:#6c757d;">Within 1 business day</div></div>
    </div>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;font-size:13px;color:#6c757d;">📦 Carefully packaged · ↩️ 30-day hassle-free returns · 🔒 Secure checkout</p>
  </div>
</div>`;
}

function DescriptionBlockEditor({ listingId, initialHtml }: { listingId: number; initialHtml: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<DescriptionBlock[]>(() => parseHtmlIntoBlocks(initialHtml));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showTemplate, setShowTemplate] = useState(false);

  const assembledHtml = blocks.filter(b => b.enabled).map(b => b.html).join("\n");
  const wrappedHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#212529;">${assembledHtml}</div>`;

  const saveMutation = useMutation({
    mutationFn: async (html: string) => {
      const res = await apiRequest("PATCH", `/api/listings/${listingId}`, { generatedHtml: html });
      if (!res.ok) throw new Error("Failed to save description");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings", listingId] });
      toast({ title: "Description saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Save failed", description: e.message }),
  });

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  function toggleBlock(id: string) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  }

  function startEdit(b: DescriptionBlock) {
    setEditingId(b.id);
    setEditContent(b.html);
  }

  function saveEdit() {
    setBlocks(prev => prev.map(b => b.id === editingId ? { ...b, html: editContent } : b));
    setEditingId(null);
  }

  function applyTemplate(html: string) {
    const newBlocks = parseHtmlIntoBlocks(html);
    setBlocks(newBlocks);
    setShowTemplate(false);
    toast({ title: "Template applied" });
  }

  return (
    <div className="space-y-4">
      {/* Block list */}
      <div className="border border-border/40 rounded-lg divide-y divide-border/20">
        {blocks.map((b, i) => (
          <div key={b.id} className={cn("flex items-center gap-2 px-3 py-2", !b.enabled && "opacity-40")}>
            <button
              data-testid={`block-toggle-${b.id}`}
              className="shrink-0"
              onClick={() => toggleBlock(b.id)}
              title={b.enabled ? "Disable block" : "Enable block"}
            >
              {b.enabled
                ? <div className="w-9 h-5 bg-primary rounded-full relative"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>
                : <div className="w-9 h-5 bg-border rounded-full relative"><div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>
              }
            </button>
            <span className="flex-1 text-sm font-medium truncate">{b.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => startEdit(b)} data-testid={`block-edit-${b.id}`}><Pencil className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Inline block editor */}
      {editingId && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Edit Block HTML</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={saveEdit}><Check className="w-3 h-3" /> Apply</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="font-mono text-xs h-40 resize-none"
              data-testid="textarea-block-edit"
            />
          </CardContent>
        </Card>
      )}

      {/* Template selector */}
      {showTemplate && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Apply Template
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setShowTemplate(false)}><X className="w-3 h-3" /></Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full text-sm justify-start gap-2"
              data-testid="btn-apply-template-1"
              onClick={() => applyTemplate(EBAY_TEMPLATE_1(
                blocks.find(b => b.name === "Header Banner")
                  ? (new DOMParser().parseFromString(blocks.find(b => b.name === "Header Banner")!.html, "text/html").querySelector("h1")?.textContent || "Your Product")
                  : "Your Product"
              ))}
            >
              <FileText className="w-4 h-4" /> Classic eBay Template (Blue Header)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          size="sm"
          className="gap-1 text-xs"
          data-testid="btn-save-description"
          onClick={() => saveMutation.mutate(wrappedHtml)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Check className="w-3 h-3" />}
          Save to Listing
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowTemplate(true)} data-testid="btn-use-my-template">
          <FileText className="w-3 h-3" /> Apply Template
        </Button>
        <CopyButton text={wrappedHtml} label="Copy HTML" data-testid="btn-copy-assembled-html" />
      </div>

      {/* Preview */}
      <div className="border border-border/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/20">
          <p className="text-xs font-medium text-muted-foreground">Preview ({blocks.filter(b => b.enabled).length} blocks)</p>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant={previewMode === "desktop" ? "default" : "ghost"}
              className="w-7 h-7"
              data-testid="btn-preview-desktop"
              onClick={() => setPreviewMode("desktop")}
            >
              <Monitor className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant={previewMode === "mobile" ? "default" : "ghost"}
              className="w-7 h-7"
              data-testid="btn-preview-mobile"
              onClick={() => setPreviewMode("mobile")}
            >
              <Smartphone className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="p-4 bg-white min-h-[200px] max-h-[600px] overflow-y-auto flex justify-center">
          <div
            style={{ maxWidth: previewMode === "mobile" ? 375 : 700, width: "100%" }}
            className="prose"
            dangerouslySetInnerHTML={{ __html: assembledHtml }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Image Intelligence Panel ─────────────────────────────────────────────────

function ImageCard({
  src,
  index,
  replicateConfigured,
}: {
  src: string;
  index: number;
  replicateConfigured: boolean;
}) {
  const [displayUrl, setDisplayUrl] = useState(src);
  const [upscaled, setUpscaled] = useState(false);
  const [noBg, setNoBg] = useState(false);
  const { toast } = useToast();

  const upscaleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/images/upscale", { imageUrl: src });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<{ upscaledUrl: string }>;
    },
    onSuccess: (data) => { setDisplayUrl(data.upscaledUrl); setUpscaled(true); toast({ title: "Image upscaled 4x" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "Upscale failed", description: e.message }),
  });

  const removeBgMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/images/remove-bg", { imageUrl: src });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<{ resultUrl: string }>;
    },
    onSuccess: (data) => { setDisplayUrl(data.resultUrl); setNoBg(true); toast({ title: "Background removed" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "BG removal failed", description: e.message }),
  });

  const isLoading = upscaleMutation.isPending || removeBgMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-secondary rounded-xl overflow-hidden border border-border/50"
    >
      <div className="aspect-square relative">
        <img
          src={displayUrl}
          alt={`Product ${index + 1}`}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
        {(upscaled || noBg) && (
          <div className="absolute top-2 left-2 flex gap-1">
            {upscaled && <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500">4x</Badge>}
            {noBg && <Badge className="text-[10px] px-1.5 py-0 bg-blue-500">No BG</Badge>}
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[10px] h-7 px-1.5"
            disabled={!replicateConfigured || isLoading || upscaled}
            data-testid={`btn-upscale-${index}`}
            onClick={() => upscaleMutation.mutate()}
            title={!replicateConfigured ? "REPLICATE_API_TOKEN not configured" : "Upscale 4x with AI"}
          >
            {upscaleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "4x Upscale"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[10px] h-7 px-1.5"
            disabled={!replicateConfigured || isLoading || noBg}
            data-testid={`btn-remove-bg-${index}`}
            onClick={() => removeBgMutation.mutate()}
            title={!replicateConfigured ? "REPLICATE_API_TOKEN not configured" : "Remove background"}
          >
            {removeBgMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "No BG"}
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="w-full text-[10px] h-6" asChild>
          <a href={displayUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="w-3 h-3 mr-1" /> Download
          </a>
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Lifestyle Image Generator ────────────────────────────────────────────────

function LifestyleGenerator({
  prompts,
  replicateConfigured,
}: {
  prompts: string[];
  replicateConfigured: boolean;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const { toast } = useToast();

  const genMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/images/lifestyle", { prompt });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<{ imageUrl: string }>;
    },
    onSuccess: (data) => setGenerated(prev => [data.imageUrl, ...prev]),
    onError: (e: Error) => toast({ variant: "destructive", title: "Generation failed", description: e.message }),
  });

  if (!replicateConfigured) {
    return (
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-muted-foreground">
        <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">REPLICATE_API_TOKEN required</p>
        <p className="text-xs">Add your Replicate API token to generate lifestyle images via SDXL.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">AI-Suggested Prompts</p>
        <div className="space-y-2">
          {prompts.map((p, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-secondary/50 rounded-lg border border-border/40">
              <p className="text-xs text-muted-foreground flex-1">{p}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] shrink-0"
                data-testid={`btn-gen-lifestyle-${i}`}
                disabled={genMutation.isPending}
                onClick={() => genMutation.mutate(p)}
              >
                {genMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                Generate
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Custom lifestyle prompt…"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          className="text-xs"
          data-testid="input-lifestyle-prompt"
        />
        <Button
          size="sm"
          disabled={!customPrompt.trim() || genMutation.isPending}
          onClick={() => genMutation.mutate(customPrompt)}
          data-testid="btn-gen-custom-lifestyle"
        >
          {genMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </Button>
      </div>

      {generated.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {generated.map((img, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden border border-border/50 relative group">
              <img src={img} alt={`Lifestyle ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button size="sm" variant="secondary" asChild>
                  <a href={img} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-3.5 h-3.5 mr-1" /> Save
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Specifics Editor ────────────────────────────────────────────────────

interface ValidationResult {
  required: string[];
  recommended: string[];
  missing: string[];
  configured: boolean;
  reason?: string;
}

function ItemSpecificsEditor({ listingId, initialSpecifics }: { listingId: number; initialSpecifics: ItemSpecific[] }) {
  const [specifics, setSpecifics] = useState<ItemSpecific[]>(initialSpecifics);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/listings/${listingId}/specifics`, { specifics });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/listings", listingId] });
      toast({ title: "Item specifics saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Save failed", description: e.message }),
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/listings/${listingId}/validate-specifics`, {});
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ValidationResult>;
    },
    onSuccess: (result) => {
      setValidation(result);
      if (!result.configured) {
        toast({ title: "eBay Validation", description: result.reason || "Configure EBAY_APP_ID to enable taxonomy validation." });
      } else if (result.missing.length === 0) {
        toast({ title: "All required fields present", description: `${result.required.length} required specifics validated.` });
      } else {
        toast({ variant: "destructive", title: `${result.missing.length} required field(s) missing`, description: result.missing.slice(0, 3).join(", ") + (result.missing.length > 3 ? "…" : "") });
      }
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Validation failed", description: e.message }),
  });

  function startEdit(i: number) {
    setEditingIdx(i);
    setEditName(specifics[i].name);
    setEditValue(specifics[i].value);
  }

  function commitEdit() {
    if (editingIdx === null) return;
    setSpecifics(prev => prev.map((s, i) => i === editingIdx ? { ...s, name: editName, value: editValue } : s));
    setEditingIdx(null);
  }

  function removeRow(i: number) {
    setSpecifics(prev => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setSpecifics(prev => [...prev, { name: "New Field", value: "", source: "ai" }]);
    setEditingIdx(specifics.length);
    setEditName("New Field");
    setEditValue("");
  }

  return (
    <div className="space-y-3">
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border/40">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-1/3">Name</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Value</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {specifics.map((s, i) => (
              <tr key={i} className="group border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                {editingIdx === i ? (
                  <>
                    <td className="px-3 py-1.5">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" data-testid={`input-spec-name-${i}`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-xs" maxLength={65} data-testid={`input-spec-value-${i}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commitEdit} data-testid={`btn-spec-save-${i}`}><Check className="w-3.5 h-3.5 text-emerald-500" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingIdx(null)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-medium text-xs">{s.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{s.value || <em className="opacity-40">empty</em>}</span>
                        {s.source === "ai" && <Badge variant="secondary" className="text-[9px] px-1 py-0">AI</Badge>}
                        {s.source === "scraped" && <Badge variant="outline" className="text-[9px] px-1 py-0">Scraped</Badge>}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(i)} data-testid={`btn-spec-edit-${i}`}><Pencil className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(i)} data-testid={`btn-spec-remove-${i}`}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* eBay Taxonomy Validation results */}
      {validation && (
        <div className={cn("rounded-lg border p-3 text-xs space-y-2", validation.missing.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5")}>
          {!validation.configured ? (
            <p className="text-muted-foreground">{validation.reason}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 font-medium">
                {validation.missing.length === 0
                  ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> All {validation.required.length} required fields present</>
                  : <><X className="w-3.5 h-3.5 text-destructive" /> {validation.missing.length} required field(s) missing</>}
              </div>
              {validation.missing.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {validation.missing.map(name => (
                    <Badge key={name} variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                      <Plus className="w-2.5 h-2.5" /> {name}
                    </Badge>
                  ))}
                </div>
              )}
              {validation.recommended.length > 0 && (
                <p className="text-muted-foreground">
                  Recommended: {validation.recommended.slice(0, 5).join(", ")}{validation.recommended.length > 5 ? ` +${validation.recommended.length - 5} more` : ""}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs" data-testid="btn-add-specific">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
            className="gap-1.5 text-xs"
            data-testid="btn-validate-specifics"
          >
            {validateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-primary" />}
            Validate Against eBay
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-1.5 text-xs"
          data-testid="btn-save-specifics"
        >
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ListingDetails() {
  const params = useParams<{ id: string }>();
  const id = params.id ? parseInt(params.id) : null;
  const { data: listing, isLoading, error } = useListing(id);
  const [mainTab, setMainTab] = useState("overview");

  // All hooks must be declared before conditional returns (React rules of hooks)
  const { data: replicateStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/images/replicate-status"],
    staleTime: 60000,
  });
  const replicateConfigured = replicateStatus?.configured ?? false;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading listing…</p>
        </div>
      </Layout>
    );
  }

  if (error || !listing) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-destructive font-medium">Error loading listing</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </Layout>
    );
  }

  const titleScore = listing.titleScore as TitleScore | null;
  const itemSpecifics = (listing.itemSpecifics as ItemSpecific[] | null) || [];
  const categories = (listing.suggestedCategories as CategorySuggestion[] | null) || [];
  const sourceData = listing.sourceData as SourceData | null;
  const lifestylePrompts = sourceData?.lifestylePrompts || [];
  const processedImagesMeta = (listing.processedImages as { original: string; processed: string; status: string }[] | null) || [];
  const imageMetadataRaw = listing.imageMetadata as ImageMeta[] | null;

  const platformLabel = sourceData?.platform
    ? sourceData.platform.charAt(0).toUpperCase() + sourceData.platform.slice(1)
    : null;

  const dimLabels: Record<string, string> = {
    lengthUtilization: "Length Utilization",
    keywordPlacement: "Keyword Placement",
    specificity: "Specificity",
    brandInclusion: "Brand Inclusion",
    conditionClarity: "Condition Clarity",
    forbiddenWords: "Compliance",
  };

  const optimizationScore: ListingOptimizationScore = computeListingScore({
    title: listing.generatedTitle || "",
    htmlDescription: listing.generatedHtml || "",
    itemSpecifics: itemSpecifics.map(s => ({ name: s.name, value: s.value })),
    imageCount: listing.images?.length || 0,
  });

  const confColor: Record<string, string> = {
    green: "text-emerald-500",
    blue: "text-blue-500",
    yellow: "text-amber-500",
    red: "text-red-500",
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/generate">
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="btn-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold">Listing Result</h1>
              {platformLabel && <Badge variant="secondary" className="text-xs">{platformLabel}</Badge>}
              {titleScore && (
                <Badge variant="outline" className={cn("text-xs font-semibold", scoreBadgeClass(titleScore.overall))}>
                  SEO Score: {titleScore.overall}/100
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Generated {new Date(listing.createdAt!).toLocaleString()} ·{" "}
              <a href={listing.productUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-0.5">
                Source <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild data-testid="btn-csv-export">
            <a href={`/api/listings/${listing.id}/export-csv`} download>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} data-testid="main-tabs">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="overview" data-testid="tab-overview" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="images" data-testid="tab-images" className="gap-1.5 text-xs">
              <ImageIcon className="w-3.5 h-3.5" /> Image AI
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{listing.images?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="specifics" data-testid="tab-specifics" className="gap-1.5 text-xs">
              <ListChecks className="w-3.5 h-3.5" /> Item Specifics
              {itemSpecifics.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{itemSpecifics.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories" className="gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" /> Categories
              {categories.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{categories.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="description" data-testid="tab-description" className="gap-1.5 text-xs">
              <Code className="w-3.5 h-3.5" /> Description
            </TabsTrigger>
            {titleScore && (
              <TabsTrigger value="seo" data-testid="tab-seo" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" /> SEO Score
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview Tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Title */}
            <Card className="border-primary/10 shadow-lg shadow-primary/5">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4 text-primary" /> eBay Optimized Title
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={listing.generatedTitle.length <= 80 ? "outline" : "destructive"} className="text-xs">
                      {listing.generatedTitle.length}/80 chars
                    </Badge>
                    {titleScore && (
                      <Badge variant="outline" className={cn("text-xs", scoreBadgeClass(titleScore.overall))}>
                        {titleScore.overall}/100
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="bg-secondary/50 p-4 rounded-xl border border-border/50 font-medium text-lg leading-relaxed mb-3" data-testid="text-generated-title">
                  {listing.generatedTitle}
                </div>
                <div className="flex items-center justify-between">
                  <CopyButton text={listing.generatedTitle} label="Copy Title" data-testid="btn-copy-title" />
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setMainTab("seo")}>
                    <BarChart3 className="w-3.5 h-3.5" /> View SEO Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {(sourceData?.price || platformLabel || categories[0]) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {platformLabel && (
                  <div className="p-3 bg-secondary/50 rounded-xl border border-border/40 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source</p>
                    <p className="text-sm font-semibold">{platformLabel}</p>
                  </div>
                )}
                {sourceData?.price ? (
                  <div className="p-3 bg-secondary/50 rounded-xl border border-border/40 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source Price</p>
                    <p className="text-sm font-semibold">${sourceData.price.toFixed(2)}</p>
                  </div>
                ) : null}
                {categories[0] && (
                  <div className="p-3 bg-secondary/50 rounded-xl border border-border/40 text-center col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top Category</p>
                    <p className="text-sm font-semibold truncate">{categories[0].name}</p>
                  </div>
                )}
              </div>
            )}

            {/* Image preview grid (first 4) */}
            {listing.images?.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Images Preview</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setMainTab("images")}>
                    View All <Layers className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {listing.images.slice(0, 4).map((img, i) => (
                      <div key={i} className="aspect-square bg-secondary rounded-lg overflow-hidden border border-border/30">
                        <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Image Intelligence Tab ────────────────────────────────────── */}
          <TabsContent value="images" className="mt-6 space-y-6">
            <ReplicateStatusBanner />

            {listing.images?.length > 0 ? (
              <div className="space-y-6">
                {/* Action bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    data-testid="btn-download-images-zip"
                    onClick={() => window.open(`/api/listings/${listing.id}/images-zip`, "_blank")}
                  >
                    <Archive className="w-3.5 h-3.5" /> Download All Images (ZIP)
                  </Button>
                </div>

                {/* Before/After sliders for processed images */}
                {processedImagesMeta.filter(m => m.original !== m.processed && m.status === "done").length > 0 && (
                  <Card className="border-border/40">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <SplitSquareHorizontal className="w-4 h-4 text-primary" /> Before / After Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {processedImagesMeta.filter(m => m.original !== m.processed && m.status === "done").slice(0, 4).map((m, i) => (
                          <BeforeAfterSlider key={i} before={m.original} after={m.processed} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Individual image cards with per-image AI actions */}
                <Card className="border-border/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" /> Image Gallery ({listing.images.length} images)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {listing.images.map((img, i) => (
                        <ImageCard key={i} src={img} index={i} replicateConfigured={replicateConfigured} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Image metadata editor */}
                <Card className="border-border/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-primary" /> Image Manager
                      <Badge variant="secondary" className="text-[10px] ml-1">Reorder · Hero · Exclude</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageMetadataEditor
                      listingId={listing.id}
                      images={listing.images}
                      existingMeta={imageMetadataRaw}
                    />
                  </CardContent>
                </Card>

                {lifestylePrompts.length > 0 && (
                  <Card className="border-border/40">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Lifestyle Image Generator
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <LifestyleGenerator prompts={lifestylePrompts} replicateConfigured={replicateConfigured} />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                <p>No images were scraped from this URL</p>
              </div>
            )}
          </TabsContent>

          {/* ── Item Specifics Tab ────────────────────────────────────────── */}
          <TabsContent value="specifics" className="mt-6">
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-primary" /> Item Specifics
                  </CardTitle>
                  <div className="flex gap-2 text-[10px] text-muted-foreground items-center">
                    <Badge variant="secondary" className="text-[10px]">AI</Badge> = AI-extracted
                    <Badge variant="outline" className="text-[10px]">Scraped</Badge> = from source
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {itemSpecifics.length > 0 ? (
                  <ItemSpecificsEditor listingId={listing.id} initialSpecifics={itemSpecifics} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ListChecks className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No item specifics — regenerate with the enhanced pipeline</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Category Suggestions Tab ──────────────────────────────────── */}
          <TabsContent value="categories" className="mt-6 space-y-4">
            {categories.length > 0 ? (
              categories.map((cat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className={cn("border-border/40", i === 0 && "border-primary/20 shadow-sm shadow-primary/5")}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {i === 0 && <Badge className="text-[10px] px-1.5 bg-primary">Best Match</Badge>}
                            <h3 className="font-semibold text-sm truncate" data-testid={`category-name-${i}`}>{cat.name}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{cat.breadcrumb}</p>
                          {cat.reason && <p className="text-xs text-muted-foreground italic">"{cat.reason}"</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-lg font-bold tabular-nums", scoreColor(cat.confidence))} data-testid={`category-confidence-${i}`}>
                            {cat.confidence}%
                          </div>
                          <p className="text-[10px] text-muted-foreground">confidence</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <Progress value={cat.confidence} className="h-1.5" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Category ID: {cat.categoryId}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No category suggestions — regenerate with the enhanced pipeline</p>
              </div>
            )}
          </TabsContent>

          {/* ── Description Tab ───────────────────────────────────────────── */}
          <TabsContent value="description" className="mt-6">
            <Card className="overflow-hidden border-border/60">
              <CardHeader className="border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" /> Description HTML
                </CardTitle>
                <CopyButton text={listing.generatedHtml} label="Copy HTML" data-testid="btn-copy-html" />
              </CardHeader>
              <Tabs defaultValue="blocks" className="w-full">
                <div className="bg-secondary/20 px-6 border-b border-border/40">
                  <TabsList className="bg-transparent p-0 gap-6">
                    <TabsTrigger value="blocks" data-testid="tab-desc-blocks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-medium text-muted-foreground data-[state=active]:text-foreground transition-all">
                      Block Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview" data-testid="tab-desc-preview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-medium text-muted-foreground data-[state=active]:text-foreground transition-all">
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="code" data-testid="tab-desc-code" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-medium text-muted-foreground data-[state=active]:text-foreground transition-all">
                      HTML Code
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="blocks" className="m-0 p-4">
                  <DescriptionBlockEditor
                    listingId={listing.id}
                    initialHtml={listing.generatedHtml}
                  />
                </TabsContent>
                <TabsContent value="preview" className="m-0">
                  <div className="p-6 min-h-[500px] max-h-[700px] overflow-y-auto bg-white">
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: listing.generatedHtml }} />
                  </div>
                </TabsContent>
                <TabsContent value="code" className="m-0">
                  <textarea
                    readOnly
                    data-testid="textarea-html-code"
                    className="w-full h-[500px] p-6 font-mono text-sm bg-slate-950 text-slate-300 resize-none focus:outline-none"
                    value={listing.generatedHtml}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          {/* ── SEO Score Tab ─────────────────────────────────────────────── */}
          {titleScore && (
            <TabsContent value="seo" className="mt-6 space-y-4">

              {/* Full Listing Optimization Score */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> Full Listing Optimization Score
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-3xl font-black tabular-nums", scoreColor(optimizationScore.overall))}>
                        {optimizationScore.overall}
                        <span className="text-sm text-muted-foreground font-normal">/100</span>
                      </span>
                      <Badge className={cn("text-xs font-black", {
                        "bg-emerald-500/20 text-emerald-500 border-emerald-500/30": optimizationScore.grade === "A+" || optimizationScore.grade === "A",
                        "bg-blue-500/20 text-blue-500 border-blue-500/30": optimizationScore.grade === "B+" || optimizationScore.grade === "B",
                        "bg-amber-500/20 text-amber-500 border-amber-500/30": optimizationScore.grade === "C",
                        "bg-red-500/20 text-red-500 border-red-500/30": optimizationScore.grade === "D",
                      })} variant="outline">{optimizationScore.grade}</Badge>
                    </div>
                  </div>
                  <p className={cn("text-xs font-semibold flex items-center gap-1 mt-1", confColor[optimizationScore.rankingConfidenceColor])}>
                    <BarChart3 className="w-3 h-3" />
                    {optimizationScore.rankingConfidence} to Rank in eBay Search
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {optimizationScore.dimensions.map((dim, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          {dim.name}
                          <span className="text-muted-foreground/50 text-[10px]">({dim.weight}%)</span>
                        </span>
                        <span className={cn("font-semibold tabular-nums", scoreColor(dim.score))}>{dim.score}</span>
                      </div>
                      <Progress value={dim.score} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground/60">{dim.detail}</p>
                    </div>
                  ))}
                  {optimizationScore.suggestions.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">Quick Wins to Improve Ranking</p>
                      <ul className="space-y-1">
                        {optimizationScore.suggestions.map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold mt-0.5 flex-shrink-0">→</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> Title SEO Score
                    </CardTitle>
                    <span className={cn("text-3xl font-bold tabular-nums", scoreColor(titleScore.overall))} data-testid="text-seo-score">
                      {titleScore.overall}<span className="text-sm text-muted-foreground font-normal">/100</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(titleScore.dimensions).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{dimLabels[key] || key}</span>
                        <span className={cn("font-medium tabular-nums", scoreColor(val))}>{val}</span>
                      </div>
                      <Progress value={val} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {titleScore.suggestions.length > 0 && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Improvement Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {titleScore.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-amber-500 font-bold mt-0.5">→</span> {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {titleScore.alternatives?.length > 0 && (
                <Card className="border-border/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /> Alternative Titles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {titleScore.alternatives.map((alt, i) => (
                      <div key={i} className="p-3 bg-secondary/50 rounded-xl border border-border/40">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium flex-1" data-testid={`text-alt-title-${i}`}>{alt.title}</p>
                          <Badge variant="outline" className={cn("text-xs shrink-0", scoreColor(alt.score))}>{alt.score}</Badge>
                        </div>
                        {alt.changes.map((c, ci) => (
                          <p key={ci} className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="text-primary">→</span> {c}
                          </p>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

// ─── Replicate Status Banner ──────────────────────────────────────────────────

function ReplicateStatusBanner() {
  const { data } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/images/replicate-status"],
    staleTime: 60000,
  });

  if (data?.configured) return null;

  return (
    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm">
      <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Image AI requires REPLICATE_API_TOKEN</p>
      <p className="text-xs text-muted-foreground">
        Add your Replicate API token to enable 4x upscaling, background removal, and AI lifestyle image generation.
        The image gallery is still available for download below.
      </p>
    </div>
  );
}
