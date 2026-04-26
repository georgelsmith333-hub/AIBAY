import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  Info,
  AlertCircle,
  CheckCircle2,
  Zap,
  Package,
  ArrowRight,
  Globe,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MARKETPLACES = [
  { id: "EBAY-US", label: "eBay USA", flag: "🇺🇸", currency: "USD" },
  { id: "EBAY-GB", label: "eBay UK", flag: "🇬🇧", currency: "GBP" },
  { id: "EBAY-AU", label: "eBay Australia", flag: "🇦🇺", currency: "AUD" },
  { id: "EBAY-DE", label: "eBay Germany", flag: "🇩🇪", currency: "EUR" },
  { id: "EBAY-CA", label: "eBay Canada", flag: "🇨🇦", currency: "CAD" },
  { id: "EBAY-FR", label: "eBay France", flag: "🇫🇷", currency: "EUR" },
];

const FVF_RATES: Record<string, number> = {
  "EBAY-US": 13.25,
  "EBAY-GB": 12.0,
  "EBAY-AU": 13.5,
  "EBAY-DE": 10.5,
  "EBAY-CA": 13.25,
  "EBAY-FR": 10.5,
};

function MetricRow({
  label,
  value,
  sub,
  highlight,
  negative,
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  negative?: boolean;
  info?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", highlight && "bg-primary/5 rounded-lg px-3 -mx-3")}>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm", highlight ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
        {info && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="text-right">
        <span className={cn("font-semibold tabular-nums", highlight ? "text-base text-foreground" : negative ? "text-red-400" : "text-foreground")}>
          {value}
        </span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function GaugeMeter({ pct }: { pct: number }) {
  const clamped = Math.max(-20, Math.min(60, pct));
  const normalized = ((clamped + 20) / 80) * 100;
  const color = clamped >= 30 ? "#22c55e" : clamped >= 20 ? "#3b82f6" : clamped >= 5 ? "#eab308" : "#ef4444";
  return (
    <div className="relative w-full mt-2">
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, normalized)}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Loss</span>
        <span>5% Marginal</span>
        <span>20% Good</span>
        <span>30%+ Excellent</span>
      </div>
    </div>
  );
}

export default function ProfitCalculatorPage() {
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [marketplace, setMarketplace] = useState("EBAY-US");
  const [international, setInternational] = useState(false);

  const mk = MARKETPLACES.find((m) => m.id === marketplace)!;

  const params = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const sell = parseFloat(sellingPrice) || 0;
    const ship = parseFloat(shippingCost) || 0;
    return { costPrice: cost, sellingPrice: sell, shippingCost: ship, marketplace, international };
  }, [costPrice, sellingPrice, shippingCost, marketplace, international]);

  const { data } = useQuery({
    queryKey: ["/api/profit/calculate", params],
    queryFn: async () => {
      if (params.sellingPrice <= 0) return null;
      const qs = new URLSearchParams({
        costPrice: String(params.costPrice),
        sellingPrice: String(params.sellingPrice),
        shippingCost: String(params.shippingCost),
        marketplace: params.marketplace,
        international: String(params.international),
      });
      const res = await fetch(`/api/profit/calculate?${qs}`);
      if (!res.ok) throw new Error("Failed to calculate");
      return res.json();
    },
    enabled: params.sellingPrice > 0,
  });

  const fvfRate = FVF_RATES[marketplace] || 13.25;
  const cur = mk.currency;

  const hasResult = data && params.sellingPrice > 0;

  const recColor = !hasResult
    ? "border-border"
    : data.recommendation === "excellent"
    ? "border-emerald-500/40 bg-emerald-500/5"
    : data.recommendation === "good"
    ? "border-blue-500/40 bg-blue-500/5"
    : data.recommendation === "marginal"
    ? "border-yellow-500/40 bg-yellow-500/5"
    : "border-red-500/40 bg-red-500/5";

  const recIcon = !hasResult ? null : data.recommendation === "excellent" ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
  ) : data.recommendation === "good" ? (
    <TrendingUp className="w-5 h-5 text-blue-400" />
  ) : data.recommendation === "marginal" ? (
    <AlertCircle className="w-5 h-5 text-yellow-400" />
  ) : (
    <TrendingDown className="w-5 h-5 text-red-400" />
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Profit Calculator</h1>
            <p className="text-sm text-muted-foreground">
              Real eBay fee breakdown — Final Value Fees, Managed Payments, shipping
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ─── Input Panel ─── */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Your Numbers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cost-price" className="text-sm">Cost / Purchase Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                    <Input
                      id="cost-price"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-7"
                      placeholder="0.00"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      data-testid="input-cost-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">What you pay to source this product</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="selling-price" className="text-sm">eBay Selling Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                    <Input
                      id="selling-price"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-7"
                      placeholder="0.00"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      data-testid="input-selling-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">What buyers will pay on eBay</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shipping-cost" className="text-sm">Shipping Cost <span className="text-muted-foreground">(to buyer)</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                    <Input
                      id="shipping-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-7"
                      placeholder="0.00"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      data-testid="input-shipping-cost"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Leave 0 for free shipping or if buyer pays</p>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-sm">Marketplace</Label>
                  <Select value={marketplace} onValueChange={setMarketplace}>
                    <SelectTrigger data-testid="select-marketplace">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.flag} {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="international-toggle" className="text-sm">International buyer</Label>
                    <p className="text-xs text-muted-foreground">Adds 2.35% cross-border fee</p>
                  </div>
                  <Switch
                    id="international-toggle"
                    checked={international}
                    onCheckedChange={setInternational}
                    data-testid="switch-international"
                  />
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground/70">Fee Rate for {mk.flag} {mk.label}</p>
                  <p>• Final Value Fee: <strong className="text-foreground">{fvfRate}%</strong> on first $7,500</p>
                  <p>• Above $7,500: <strong className="text-foreground">2.35%</strong></p>
                  {international && <p>• International: <strong className="text-foreground">+2.35%</strong></p>}
                  <p>• Insertion fee: <strong className="text-foreground">Free</strong> (first 250/mo)</p>
                  <p>• Payment processing: <strong className="text-foreground">Included in FVF</strong></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Results Panel ─── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Recommendation Banner */}
            <Card className={cn("border transition-all", recColor)}>
              <CardContent className="p-5">
                {!hasResult ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calculator className="w-5 h-5" />
                    <div>
                      <p className="font-semibold text-foreground">Enter your numbers to calculate</p>
                      <p className="text-sm">Fill in cost price and selling price to see your profit breakdown</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {recIcon}
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{data.recommendationText}</p>
                      <GaugeMeter pct={data.marginPct} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Net Profit",
                  value: hasResult ? `${data.netProfit >= 0 ? "+" : ""}${cur} ${data.netProfit.toFixed(2)}` : "—",
                  sub: "after all fees",
                  color: hasResult ? (data.netProfit >= 0 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground",
                  icon: DollarSign,
                },
                {
                  label: "ROI",
                  value: hasResult ? `${data.roi.toFixed(1)}%` : "—",
                  sub: "return on cost",
                  color: hasResult ? (data.roi >= 30 ? "text-emerald-400" : data.roi >= 10 ? "text-blue-400" : "text-red-400") : "text-muted-foreground",
                  icon: TrendingUp,
                },
                {
                  label: "Net Margin",
                  value: hasResult ? `${data.marginPct.toFixed(1)}%` : "—",
                  sub: "of selling price",
                  color: hasResult ? (data.marginPct >= 20 ? "text-emerald-400" : data.marginPct >= 10 ? "text-yellow-400" : "text-red-400") : "text-muted-foreground",
                  icon: BarChart3,
                },
              ].map((m) => (
                <Card key={m.label} className="border-border/60">
                  <CardContent className="p-4 text-center">
                    <m.icon className={cn("w-4 h-4 mx-auto mb-1", m.color)} />
                    <p className={cn("text-xl font-black tabular-nums", m.color)}>{m.value}</p>
                    <p className="text-xs font-semibold text-foreground/70 mt-0.5">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Full Fee Breakdown */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  eBay Fee Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border/30">
                <MetricRow
                  label="Selling Price"
                  value={hasResult ? `${cur} ${params.sellingPrice.toFixed(2)}` : "—"}
                  info="What the buyer pays on eBay"
                />
                <MetricRow
                  label={`Cost Price`}
                  value={hasResult ? `- ${cur} ${params.costPrice.toFixed(2)}` : "—"}
                  negative
                  info="Your sourcing / purchase cost"
                />
                <MetricRow
                  label="Shipping Cost"
                  value={hasResult ? `- ${cur} ${params.shippingCost.toFixed(2)}` : "—"}
                  negative={params.shippingCost > 0}
                  info="What you pay to ship to the buyer"
                />
                <MetricRow
                  label={`eBay Final Value Fee (${fvfRate}%)`}
                  value={hasResult ? `- ${cur} ${data.finalValueFee.toFixed(2)}` : "—"}
                  negative
                  info="eBay's primary fee, charged on the total sale price including shipping"
                />
                {international && (
                  <MetricRow
                    label="International Transaction Fee (2.35%)"
                    value={hasResult ? `- ${cur} ${data.internationalFee.toFixed(2)}` : "—"}
                    negative
                    info="Additional fee for cross-border transactions"
                  />
                )}
                <MetricRow
                  label="Insertion Fee"
                  value="Free"
                  info="Free for the first 250 fixed-price listings per month"
                />
                <MetricRow
                  label="Total eBay Fees"
                  value={hasResult ? `- ${cur} ${data.totalFees.toFixed(2)}` : "—"}
                  negative
                  info="Sum of all eBay charges"
                />
                <div className="pt-1">
                  <MetricRow
                    label="NET PROFIT"
                    value={hasResult ? `${data.netProfit >= 0 ? "+" : ""}${cur} ${data.netProfit.toFixed(2)}` : "—"}
                    highlight
                    info="Your take-home after all costs and eBay fees"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing Intelligence */}
            {hasResult && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Pricing Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Break-even Price</p>
                      <p className="text-lg font-black text-foreground tabular-nums">
                        {cur} {data.breakEvenPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Minimum to avoid loss</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Suggested Price</p>
                      <p className="text-lg font-black text-emerald-400 tabular-nums">
                        {cur} {data.suggestedListingPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">For 30%+ net margin</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-sm space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-400" /> Quick Checks
                    </p>
                    <p className="text-muted-foreground text-xs">
                      • List at <strong className="text-foreground">{cur} {data.suggestedListingPrice.toFixed(2)}</strong> or above for a healthy 30%+ margin
                    </p>
                    <p className="text-muted-foreground text-xs">
                      • Never go below <strong className="text-foreground">{cur} {data.breakEvenPrice.toFixed(2)}</strong> or you'll sell at a loss
                    </p>
                    {data.recommendation === "loss" && (
                      <p className="text-red-400 text-xs font-semibold">
                        ⚠ At this selling price you lose money. Either lower your cost or raise the price.
                      </p>
                    )}
                    {(data.recommendation === "excellent" || data.recommendation === "good") && (
                      <p className="text-emerald-400 text-xs font-semibold">
                        ✓ This product is viable. Consider searching suppliers to find an even cheaper source.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
