import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Layers, Plus, Trash2, Star, StarOff, GripVertical, Download, Upload,
  Eye, Monitor, Smartphone, ChevronDown, RotateCcw, Save, Settings,
  Type, Image, List, Table, Package, Shield, Video, Code2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Block {
  id: string;
  type: string;
  settings: Record<string, any>;
}

interface Template {
  id: number;
  name: string;
  description?: string;
  blocks: Block[];
  isDefault: boolean;
  versions?: any[];
  createdAt: string;
  updatedAt: string;
}

const BLOCK_TYPES = [
  { type: "hero_banner", label: "Hero Banner", icon: Type, description: "Full-width header with title overlay" },
  { type: "feature_bullets", label: "Feature Bullets", icon: List, description: "Icon + text bullet list" },
  { type: "image_gallery", label: "Image Gallery", icon: Image, description: "Horizontal row of product images" },
  { type: "specifications_table", label: "Specifications Table", icon: Table, description: "2-column item specifics table" },
  { type: "shipping_returns", label: "Shipping & Returns", icon: Package, description: "Pre-styled info box" },
  { type: "seller_promise", label: "Seller Promise", icon: Shield, description: "Trust badge row" },
  { type: "youtube_embed", label: "YouTube Embed", icon: Video, description: "Responsive video player" },
  { type: "custom_html", label: "Custom HTML", icon: Code2, description: "Raw HTML/text block" },
];

const TEMPLATE_VARIABLES = [
  { token: "{{title}}", description: "Product title" },
  { token: "{{brand}}", description: "Brand name" },
  { token: "{{price}}", description: "Product price" },
  { token: "{{category}}", description: "Product category" },
  { token: "{{hero_image}}", description: "Main product image URL" },
  { token: "{{features}}", description: "Product feature bullets" },
  { token: "{{specifications}}", description: "Item specifics list" },
  { token: "{{seller_name}}", description: "Your seller username" },
  { token: "{{condition}}", description: "Item condition" },
  { token: "{{weight}}", description: "Item weight" },
  { token: "{{dimensions}}", description: "Item dimensions" },
  { token: "{{shipping_time}}", description: "Estimated shipping time" },
];

const SAMPLE_DATA: Record<string, string> = {
  "{{title}}": "Premium Wireless Earbuds Pro 2024",
  "{{brand}}": "SoundMax",
  "{{price}}": "$29.99",
  "{{category}}": "Consumer Electronics",
  "{{hero_image}}": "",
  "{{features}}": "Active Noise Cancellation, 40h Battery, Waterproof IPX5, USB-C Charging",
  "{{specifications}}": "Driver: 10mm | Frequency: 20Hz-20kHz | Battery: 800mAh | Weight: 58g",
  "{{seller_name}}": "TechDeals2024",
  "{{condition}}": "New",
  "{{weight}}": "58g",
  "{{dimensions}}": "65 x 50 x 32mm",
  "{{shipping_time}}": "3-5 business days",
};

function applyVars(text: string): string {
  let result = text;
  for (const [token, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

function renderBlockPreview(block: Block): string {
  const s = block.settings || {};
  switch (block.type) {
    case "hero_banner":
      return `<div style="background:${s.bgColor || "#1e3a8a"};color:${s.textColor || "#fff"};padding:32px 24px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="margin:0 0 8px;font-size:${s.fontSize || 22}px;font-family:sans-serif;">${applyVars("{{title}}")}</h1>
        <p style="margin:0;opacity:0.8;font-size:14px;font-family:sans-serif;">Premium Quality · Fast Dispatch · 100% Guaranteed</p>
      </div>`;
    case "feature_bullets":
      const icon = s.iconStyle === "star" ? "⭐" : s.iconStyle === "bolt" ? "⚡" : "✅";
      const features = applyVars("{{features}}").split(",").slice(0, s.bulletCount || 5);
      return `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:16px;font-family:sans-serif;color:#1e3a8a;">${icon} Key Features</h2>
        <ul style="list-style:none;padding:0;margin:0;font-size:14px;font-family:sans-serif;">
          ${features.map(f => `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${icon} ${f.trim()}</li>`).join("")}
        </ul>
      </div>`;
    case "image_gallery":
      return `<div style="padding:16px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:16px;font-family:sans-serif;color:#1e3a8a;">📸 Product Images</h2>
        <div style="display:flex;gap:8px;overflow-x:auto;">
          ${[1,2,3].map(i => `<div style="width:80px;height:80px;background:#e9ecef;border-radius:${s.borderRadius || 6}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#6c757d;">Image ${i}</div>`).join("")}
        </div>
      </div>`;
    case "specifications_table":
      return `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:16px;font-family:sans-serif;color:${s.headerColor || "#1e3a8a"};">📋 Specifications</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:sans-serif;">
          ${["Brand|SoundMax","Model|EP-2024-PRO","Color|Matte Black","Connectivity|Bluetooth 5.3","Battery Life|Up to 40 Hours"].map((row, i) => {
            const [k, v] = row.split("|");
            return `<tr><td style="padding:7px 10px;background:${i % 2 === 0 ? (s.alternateRowColor || "#f8f9fa") : "#fff"};font-weight:600;border:1px solid #dee2e6;width:35%;">${k}</td><td style="padding:7px 10px;background:${i % 2 === 0 ? (s.alternateRowColor || "#f8f9fa") : "#fff"};border:1px solid #dee2e6;">${v}</td></tr>`;
          }).join("")}
        </table>
      </div>`;
    case "shipping_returns":
      return `<div style="padding:20px 24px;background:#f0f7ff;border:1px solid #dee2e6;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:16px;font-family:sans-serif;color:#1e3a8a;">📦 Shipping & Returns</h2>
        <p style="margin:0;font-size:13px;font-family:sans-serif;line-height:1.7;">${applyVars(s.text || "Fast dispatch. Free returns. Tracking provided.")}</p>
      </div>`;
    case "seller_promise":
      const badges = s.badges || ["Free Returns", "Fast Shipping", "100% Authentic", "Top Rated"];
      return `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
        <h2 style="margin:0 0 12px;font-size:16px;font-family:sans-serif;color:#1e3a8a;">⭐ Why Buy From Us?</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${badges.map((b: string) => `<span style="padding:6px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;font-size:12px;font-family:sans-serif;color:#1e40af;">✓ ${b}</span>`).join("")}
        </div>
      </div>`;
    case "youtube_embed":
      const videoId = (s.url || "").match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1] || "";
      return videoId
        ? `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;"><iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`
        : `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;text-align:center;color:#6c757d;font-size:13px;font-family:sans-serif;">▶ YouTube video will appear here</div>`;
    case "custom_html":
      return `<div style="padding:20px 24px;background:#fff;border:1px solid #dee2e6;border-top:none;">${s.html || "<p style='font-family:sans-serif;font-size:14px;'>Custom HTML content</p>"}</div>`;
    default:
      return `<div style="padding:16px;background:#f8f9fa;border:1px solid #dee2e6;border-top:none;font-family:sans-serif;font-size:13px;color:#6c757d;">[${block.type}]</div>`;
  }
}

function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown }: {
  block: Block;
  onChange: (b: Block) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = BLOCK_TYPES.find(bt => bt.type === block.type);
  const Icon = typeConfig?.icon || Code2;

  function setSetting(key: string, value: any) {
    onChange({ ...block, settings: { ...block.settings, [key]: value } });
  }

  return (
    <div className="border border-border rounded-lg bg-background">
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm font-medium flex-1">{typeConfig?.label || block.type}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp}><ChevronDown className="w-3 h-3 rotate-180" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown}><ChevronDown className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            <Settings className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={onRemove}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/30">
          {block.type === "hero_banner" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Background</Label>
                  <Input type="color" value={block.settings.bgColor || "#1e3a8a"} onChange={e => setSetting("bgColor", e.target.value)} className="h-8 p-1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Text Color</Label>
                  <Input type="color" value={block.settings.textColor || "#ffffff"} onChange={e => setSetting("textColor", e.target.value)} className="h-8 p-1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input type="number" value={block.settings.fontSize || 22} onChange={e => setSetting("fontSize", parseInt(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>
            </>
          )}
          {block.type === "feature_bullets" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Icon Style</Label>
                <Select value={block.settings.iconStyle || "checkmark"} onValueChange={v => setSetting("iconStyle", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkmark">✅ Checkmark</SelectItem>
                    <SelectItem value="star">⭐ Star</SelectItem>
                    <SelectItem value="bolt">⚡ Bolt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bullets</Label>
                <Input type="number" min="1" max="12" value={block.settings.bulletCount || 5} onChange={e => setSetting("bulletCount", parseInt(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          )}
          {block.type === "image_gallery" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Max Images</Label>
                <Input type="number" min="1" max="12" value={block.settings.maxImages || 6} onChange={e => setSetting("maxImages", parseInt(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Border Radius</Label>
                <Input type="number" min="0" max="20" value={block.settings.borderRadius || 6} onChange={e => setSetting("borderRadius", parseInt(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          )}
          {block.type === "specifications_table" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Alt Row Color</Label>
                <Input type="color" value={block.settings.alternateRowColor || "#f8f9fa"} onChange={e => setSetting("alternateRowColor", e.target.value)} className="h-8 p-1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Header Color</Label>
                <Input type="color" value={block.settings.headerColor || "#1e3a8a"} onChange={e => setSetting("headerColor", e.target.value)} className="h-8 p-1" />
              </div>
            </div>
          )}
          {block.type === "shipping_returns" && (
            <div className="space-y-1">
              <Label className="text-xs">Text (supports {{variables}})</Label>
              <Textarea value={block.settings.text || ""} onChange={e => setSetting("text", e.target.value)} className="text-xs" rows={3} />
            </div>
          )}
          {block.type === "seller_promise" && (
            <div className="space-y-1">
              <Label className="text-xs">Badges (comma-separated)</Label>
              <Input
                value={(block.settings.badges || []).join(", ")}
                onChange={e => setSetting("badges", e.target.value.split(",").map((b: string) => b.trim()).filter(Boolean))}
                placeholder="Free Returns, Fast Shipping, Authentic"
                className="text-xs"
              />
            </div>
          )}
          {block.type === "youtube_embed" && (
            <div className="space-y-1">
              <Label className="text-xs">YouTube URL</Label>
              <Input value={block.settings.url || ""} onChange={e => setSetting("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." className="text-xs" />
            </div>
          )}
          {block.type === "custom_html" && (
            <div className="space-y-1">
              <Label className="text-xs">HTML Content</Label>
              <Textarea value={block.settings.html || ""} onChange={e => setSetting("html", e.target.value)} className="font-mono text-xs" rows={5} placeholder="<p>Your HTML here</p>" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templateList = [], isLoading } = useQuery<Template[]>({ queryKey: ["/api/templates"] });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("Untitled Template");
  const [description, setDescription] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showVersions, setShowVersions] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [showVars, setShowVars] = useState(false);

  const selected = templateList.find(t => t.id === selectedId);

  function loadTemplate(tmpl: Template) {
    setSelectedId(tmpl.id);
    setName(tmpl.name);
    setDescription(tmpl.description || "");
    setBlocks((tmpl.blocks as Block[]) || []);
    setShowVersions(false);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (selectedId) {
        return apiRequest("PUT", `/api/templates/${selectedId}`, { name, description, blocks }).then(r => r.json());
      }
      return apiRequest("POST", "/api/templates", { name, description, blocks }).then(r => r.json());
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      if (!selectedId) setSelectedId(data.id);
      toast({ title: "Template saved!" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      setSelectedId(null);
      setName("Untitled Template");
      setDescription("");
      setBlocks([]);
      toast({ title: "Template deleted" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/templates/${id}/set-default`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Set as default template" });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: ({ id, idx }: { id: number; idx: number }) =>
      apiRequest("POST", `/api/templates/${id}/restore-version`, { versionIndex: idx }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      loadTemplate(data);
      toast({ title: "Version restored" });
    },
  });

  function addBlock(type: string) {
    const defaultSettings: Record<string, any> = {
      hero_banner: { bgColor: "#1e3a8a", textColor: "#ffffff", fontSize: 22 },
      feature_bullets: { iconStyle: "checkmark", bulletCount: 5 },
      image_gallery: { maxImages: 6, borderRadius: 6, shadow: true },
      specifications_table: { alternateRowColor: "#f8f9fa", headerColor: "#1e3a8a" },
      shipping_returns: { text: "Fast dispatch. Free returns. Tracking provided." },
      seller_promise: { badges: ["Free Returns", "Fast Shipping", "100% Authentic"] },
      youtube_embed: { url: "" },
      custom_html: { html: "<p>Your content here</p>" },
    };
    setBlocks(prev => [...prev, { id: generateId(), type, settings: defaultSettings[type] || {} }]);
    setShowAddBlock(false);
  }

  function updateBlock(idx: number, block: Block) {
    setBlocks(prev => prev.map((b, i) => i === idx ? block : b));
  }

  function removeBlock(idx: number) {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  function moveBlock(idx: number, dir: "up" | "down") {
    setBlocks(prev => {
      const arr = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  }

  function exportTemplate() {
    const data = { name, description, blocks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setSelectedId(null);
        setName(data.name || "Imported Template");
        setDescription(data.description || "");
        setBlocks(data.blocks || []);
        toast({ title: "Template imported" });
      } catch {
        toast({ title: "Invalid template file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const previewHtml = blocks.map(renderBlockPreview).join("");
  const versions = (selected?.versions as any[]) || [];

  return (
    <Layout>
      <div className="flex gap-0 h-[calc(100vh-120px)] -mx-4 md:-mx-6 lg:-mx-8">
        {/* Left: Template List */}
        <aside className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-background">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" /> Templates
            </h2>
            <Button
              size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => { setSelectedId(null); setName("Untitled Template"); setDescription(""); setBlocks([]); }}
              data-testid="btn-new-template"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 rounded bg-muted animate-pulse" />)}
              </div>
            ) : templateList.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground italic">No templates yet</p>
            ) : (
              <div className="p-2 space-y-1">
                {templateList.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => loadTemplate(tmpl)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm",
                      selectedId === tmpl.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                    data-testid={`btn-template-${tmpl.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{tmpl.name}</span>
                      {tmpl.isDefault && (
                        <Star className={cn("w-3 h-3 flex-shrink-0 fill-current", selectedId === tmpl.id ? "text-yellow-300" : "text-yellow-500")} />
                      )}
                    </div>
                    <div className={cn("text-xs mt-0.5", selectedId === tmpl.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {(tmpl.blocks as any[])?.length || 0} blocks
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-border space-y-1">
            <Button size="sm" variant="outline" className="w-full text-xs justify-start h-8" onClick={exportTemplate} data-testid="btn-export-template">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export JSON
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs justify-start h-8" onClick={() => fileInputRef.current?.click()} data-testid="btn-import-template">
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Import JSON
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importTemplate} />
          </div>
        </aside>

        {/* Center: Block Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
            <Input value={name} onChange={e => setName(e.target.value)} className="font-semibold h-8 flex-1 text-sm" placeholder="Template name" data-testid="input-template-name" />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowVars(!showVars)} data-testid="btn-variables">
              <Type className="w-3.5 h-3.5 mr-1" /> Variables
            </Button>
            {selectedId && (
              <>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDefaultMutation.mutate(selectedId)} data-testid="btn-set-default">
                  {selected?.isDefault ? <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> : <StarOff className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(selectedId)} data-testid="btn-delete-template">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button size="sm" className="h-8 text-xs" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="btn-save-template">
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          </div>

          {/* Variables popover */}
          {showVars && (
            <div className="border-b border-border p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Variables</p>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setShowVars(false)}><X className="w-3 h-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.token}
                    title={v.description}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => { navigator.clipboard?.writeText(v.token); toast({ title: `Copied ${v.token}` }); }}
                    data-testid={`var-${v.token.replace(/[{}]/g, "")}`}
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Version history dropdown */}
          {selectedId && versions.length > 0 && (
            <div className="border-b border-border px-3 py-1.5 flex items-center gap-2 bg-muted/20">
              <RotateCcw className="w-3 h-3 text-muted-foreground" />
              <button onClick={() => setShowVersions(!showVersions)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors" data-testid="btn-version-history">
                {versions.length} saved version{versions.length !== 1 ? "s" : ""}
                <ChevronDown className={cn("w-3 h-3 transition-transform", showVersions && "rotate-180")} />
              </button>
              {showVersions && (
                <div className="flex gap-2 overflow-x-auto">
                  {versions.slice(0, 10).map((v, i) => (
                    <button
                      key={i}
                      onClick={() => restoreVersionMutation.mutate({ id: selectedId, idx: i })}
                      className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-accent whitespace-nowrap transition-colors"
                      data-testid={`btn-restore-v${i}`}
                    >
                      {new Date(v.savedAt).toLocaleString()} — {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Blocks */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {blocks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No blocks yet</p>
                <p className="text-xs mt-1">Add blocks to build your template</p>
              </div>
            )}
            {blocks.map((block, idx) => (
              <BlockEditor
                key={block.id}
                block={block}
                onChange={b => updateBlock(idx, b)}
                onRemove={() => removeBlock(idx)}
                onMoveUp={() => moveBlock(idx, "up")}
                onMoveDown={() => moveBlock(idx, "down")}
              />
            ))}

            {/* Add block */}
            {showAddBlock ? (
              <div className="border border-dashed border-primary/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Choose block type:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BLOCK_TYPES.map(bt => {
                    const Icon = bt.icon;
                    return (
                      <button
                        key={bt.type}
                        onClick={() => addBlock(bt.type)}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-accent text-left transition-colors"
                        data-testid={`btn-add-block-${bt.type}`}
                      >
                        <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium">{bt.label}</div>
                          <div className="text-[10px] text-muted-foreground">{bt.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setShowAddBlock(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={() => setShowAddBlock(true)} data-testid="btn-add-block">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Block
              </Button>
            )}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/10">
          <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">Live Preview</span>
            <Badge variant="outline" className="text-xs">Sample data</Badge>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={cn("px-2 py-1 text-xs flex items-center gap-1 transition-colors", previewMode === "desktop" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                data-testid="btn-preview-desktop"
              >
                <Monitor className="w-3 h-3" /> Desktop
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={cn("px-2 py-1 text-xs flex items-center gap-1 transition-colors", previewMode === "mobile" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                data-testid="btn-preview-mobile"
              >
                <Smartphone className="w-3 h-3" /> Mobile
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className={cn("mx-auto transition-all", previewMode === "mobile" ? "max-w-[375px]" : "max-w-[980px]")}>
              {blocks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Preview will appear here</p>
                </div>
              ) : (
                <div
                  className="shadow-lg rounded-lg overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
