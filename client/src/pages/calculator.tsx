import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calculator, DollarSign, TrendingUp, TrendingDown, Save,
  RotateCcw, Package, BarChart2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalcInputs {
  itemCost: number;
  salePrice: number;
  shippingCharged: number;
  actualShippingCost: number;
  paymentMethod: "managed" | "standard";
  storePlan: "none" | "basic" | "premium" | "anchor";
  categoryKey: string;
  promotedListingPct: number;
  quantity: number;
  targetMarginPct: number;
}

interface Breakdown {
  ebayFvf: number;
  insertionFee: number;
  paymentFee: number;
  promotedFee: number;
  totalFees: number;
  netProfit: number;
  profitMarginPct: number;
  roi: number;
  breakEvenSalePrice: number;
  batchNetProfit: number;
  batchTotalRevenue: number;
  batchTotalFees: number;
  marginAdvice?: {
    minSalePrice: number;
    suggestedSalePrice: number;
    reason: string;
  } | null;
}

const CATEGORIES = [
  { key: "general", label: "General (12.35%)" },
  { key: "electronics", label: "Electronics (9.85%)" },
  { key: "computers", label: "Computers (9.85%)" },
  { key: "cameras", label: "Cameras & Photo (9.85%)" },
  { key: "clothing", label: "Clothing & Fashion (15.35%)" },
  { key: "shoes", label: "Shoes (15.35%)" },
  { key: "jewelry", label: "Jewelry & Watches (15.35%)" },
  { key: "automotive", label: "Auto Parts (10.35%)" },
  { key: "books", label: "Books/Music/DVD (14.85%)" },
  { key: "toys", label: "Toys & Hobbies (12.35%)" },
  { key: "sports", label: "Sporting Goods (12.35%)" },
  { key: "home", label: "Home & Garden (12.35%)" },
  { key: "health", label: "Health & Beauty (15.35%)" },
  { key: "baby", label: "Baby Items (15.35%)" },
];

const FVF_RATES: Record<string, number> = {
  general: 0.1235, electronics: 0.0985, computers: 0.0985, cameras: 0.0985,
  clothing: 0.1535, shoes: 0.1535, jewelry: 0.1535, automotive: 0.1035,
  books: 0.1485, music: 0.1485, dvd: 0.1485, toys: 0.1235, sports: 0.1235,
  home: 0.1235, garden: 0.1235, health: 0.1535, beauty: 0.1535, baby: 0.1535,
};

function calculateLocally(inputs: CalcInputs): Breakdown {
  const fvfRate = FVF_RATES[inputs.categoryKey] ?? 0.1235;
  const fvfCap = 750;
  const totalRevenue = inputs.salePrice + inputs.shippingCharged;
  const ebayFvf = Math.min(totalRevenue * fvfRate, fvfCap);
  const insertionFee = inputs.storePlan === "none" ? 0.35 : 0;
  const paymentFee = totalRevenue * 0.0287 + 0.30;
  const promotedFee = inputs.salePrice * (inputs.promotedListingPct / 100);
  const totalFees = ebayFvf + insertionFee + paymentFee + promotedFee;
  const netProfit = inputs.salePrice + inputs.shippingCharged - inputs.itemCost - inputs.actualShippingCost - totalFees;
  const profitMarginPct = inputs.salePrice > 0 ? (netProfit / inputs.salePrice) * 100 : 0;
  const roi = inputs.itemCost > 0 ? (netProfit / inputs.itemCost) * 100 : 0;
  const beDivisor = 1 - fvfRate - 0.0287 - (inputs.promotedListingPct / 100);
  const breakEvenSalePrice = beDivisor > 0 ? (inputs.itemCost + inputs.actualShippingCost + insertionFee + 0.30) / beDivisor : inputs.itemCost * 2;
  return {
    ebayFvf, insertionFee, paymentFee, promotedFee, totalFees,
    netProfit, profitMarginPct, roi, breakEvenSalePrice,
    batchNetProfit: netProfit * inputs.quantity,
    batchTotalRevenue: totalRevenue * inputs.quantity,
    batchTotalFees: totalFees * inputs.quantity,
    marginAdvice: null,
  };
}

function fmt(n: number) { return n.toFixed(2); }
function pct(n: number) { return n.toFixed(1) + "%"; }

interface ProfitScenario {
  id: number;
  name: string;
  inputs: any;
  outputs: any;
  createdAt: string;
}

export default function CalculatorPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [inputs, setInputs] = useState<CalcInputs>({
    itemCost: 10,
    salePrice: 29.99,
    shippingCharged: 0,
    actualShippingCost: 5,
    paymentMethod: "managed",
    storePlan: "none",
    categoryKey: "general",
    promotedListingPct: 0,
    quantity: 1,
    targetMarginPct: 30,
  });

  const [breakdown, setBreakdown] = useState<Breakdown>(() => calculateLocally({
    itemCost: 10, salePrice: 29.99, shippingCharged: 0, actualShippingCost: 5,
    paymentMethod: "managed", storePlan: "none", categoryKey: "general",
    promotedListingPct: 0, quantity: 1, targetMarginPct: 30,
  }));

  const [batchMode, setBatchMode] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const { data: savedScenarios = [] } = useQuery<ProfitScenario[]>({
    queryKey: ["/api/profit/scenarios"],
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profit/save", {
      name: scenarioName || `Scenario ${new Date().toLocaleDateString()}`,
      inputs,
      outputs: breakdown,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profit/scenarios"] });
      toast({ title: "Scenario saved!" });
      setScenarioName("");
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/profit/scenarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/profit/scenarios"] }),
  });

  useEffect(() => {
    setBreakdown(calculateLocally(inputs));
  }, [inputs]);

  function setInput<K extends keyof CalcInputs>(key: K, val: CalcInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: val }));
  }

  const profitColor = breakdown.netProfit >= 0 ? "text-green-500" : "text-red-500";
  const marginColor = breakdown.profitMarginPct >= 20 ? "text-green-500" : breakdown.profitMarginPct >= 10 ? "text-yellow-500" : "text-red-500";

  function FeeRow({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
    return (
      <div className={cn("flex justify-between items-center py-2 text-sm", highlight && "bg-primary/5 rounded px-2 -mx-2")}>
        <span className={highlight ? "font-semibold" : "text-muted-foreground"}>{label}</span>
        <span className={cn("font-mono", highlight ? "font-bold" : "text-red-500")}>-${fmt(amount)}</span>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" /> Profit & Fee Calculator
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real eBay fee schedule (updated March 2025). Instant profit calculation with break-even analysis.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Panel */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Item Cost ($)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={inputs.itemCost}
                      onChange={e => setInput("itemCost", parseFloat(e.target.value) || 0)}
                      data-testid="input-item-cost"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sale Price ($)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={inputs.salePrice}
                      onChange={e => setInput("salePrice", parseFloat(e.target.value) || 0)}
                      data-testid="input-sale-price"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Shipping Charged to Buyer ($)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={inputs.shippingCharged}
                      onChange={e => setInput("shippingCharged", parseFloat(e.target.value) || 0)}
                      data-testid="input-shipping-charged"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Actual Shipping Cost ($)</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={inputs.actualShippingCost}
                      onChange={e => setInput("actualShippingCost", parseFloat(e.target.value) || 0)}
                      data-testid="input-actual-shipping"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> eBay Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={inputs.categoryKey} onValueChange={v => setInput("categoryKey", v)}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Store Plan</Label>
                    <Select value={inputs.storePlan} onValueChange={v => setInput("storePlan", v as any)}>
                      <SelectTrigger data-testid="select-store-plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Store ($0.35/listing)</SelectItem>
                        <SelectItem value="basic">Basic Store</SelectItem>
                        <SelectItem value="premium">Premium Store</SelectItem>
                        <SelectItem value="anchor">Anchor Store</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Method</Label>
                    <Select value={inputs.paymentMethod} onValueChange={v => setInput("paymentMethod", v as any)}>
                      <SelectTrigger data-testid="select-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="managed">Managed Payments</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Promoted Listing %</Label>
                    <span className="text-xs font-mono text-primary">{inputs.promotedListingPct}%</span>
                  </div>
                  <Slider
                    min={0} max={20} step={0.5}
                    value={[inputs.promotedListingPct]}
                    onValueChange={([v]) => setInput("promotedListingPct", v)}
                    data-testid="slider-promoted"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Targets & Batch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Target Margin %</Label>
                    <span className="text-xs font-mono text-primary">{inputs.targetMarginPct}%</span>
                  </div>
                  <Slider
                    min={5} max={80} step={1}
                    value={[inputs.targetMarginPct]}
                    onValueChange={([v]) => setInput("targetMarginPct", v)}
                    data-testid="slider-target-margin"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={batchMode} onCheckedChange={setBatchMode} id="batch-mode" data-testid="switch-batch-mode" />
                    <Label htmlFor="batch-mode" className="text-xs cursor-pointer">Batch Calculator</Label>
                  </div>
                  {batchMode && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Qty:</Label>
                      <Input
                        type="number" min="1" max="9999"
                        value={inputs.quantity}
                        onChange={e => setInput("quantity", parseInt(e.target.value) || 1)}
                        className="w-20 h-8 text-xs"
                        data-testid="input-quantity"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Panel */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> Fee Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0 divide-y divide-border/50">
                  <div className="flex justify-between items-center py-2 text-sm">
                    <span className="text-muted-foreground">Sale Price</span>
                    <span className="font-mono font-semibold text-foreground">+${fmt(inputs.salePrice)}</span>
                  </div>
                  {inputs.shippingCharged > 0 && (
                    <div className="flex justify-between items-center py-2 text-sm">
                      <span className="text-muted-foreground">Shipping Revenue</span>
                      <span className="font-mono text-foreground">+${fmt(inputs.shippingCharged)}</span>
                    </div>
                  )}
                  <FeeRow label={`eBay Final Value Fee (${((FVF_RATES[inputs.categoryKey] ?? 0.1235) * 100).toFixed(2)}%)`} amount={breakdown.ebayFvf} highlight />
                  {breakdown.insertionFee > 0 && <FeeRow label="Insertion Fee" amount={breakdown.insertionFee} />}
                  <FeeRow label="Payment Processing (2.87% + $0.30)" amount={breakdown.paymentFee} />
                  {breakdown.promotedFee > 0 && <FeeRow label={`Promoted Listings (${inputs.promotedListingPct}%)`} amount={breakdown.promotedFee} />}
                  <FeeRow label="Item Cost" amount={inputs.itemCost} />
                  {inputs.actualShippingCost > 0 && <FeeRow label="Actual Shipping Cost" amount={inputs.actualShippingCost} />}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Net Profit</span>
                    <span className={cn("text-2xl font-bold font-mono", profitColor)}>
                      {breakdown.netProfit >= 0 ? "+" : ""}{fmt(breakdown.netProfit)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className={cn("text-xl font-bold font-mono", marginColor)}>{pct(breakdown.profitMarginPct)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Margin</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className={cn("text-xl font-bold font-mono", breakdown.roi >= 0 ? "text-green-500" : "text-red-500")}>{pct(breakdown.roi)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">ROI</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-xl font-bold font-mono text-foreground">${fmt(breakdown.breakEvenSalePrice)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Break-even</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Margin target advice */}
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Target: {inputs.targetMarginPct}% Margin</p>
                    {(() => {
                      const fvfRate = FVF_RATES[inputs.categoryKey] ?? 0.1235;
                      const beDivisor = 1 - fvfRate - 0.0287 - (inputs.promotedListingPct / 100) - (inputs.targetMarginPct / 100);
                      const minPrice = beDivisor > 0 ? (inputs.itemCost + inputs.actualShippingCost + (inputs.storePlan === "none" ? 0.35 : 0) + 0.30) / beDivisor : inputs.itemCost * 2;
                      const diff = minPrice - inputs.salePrice;
                      return (
                        <>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Minimum sale price: <span className="font-bold text-primary">${fmt(minPrice)}</span>
                          </p>
                          {diff > 0.01 ? (
                            <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Raise price by ${fmt(diff)} to hit your {inputs.targetMarginPct}% target
                            </p>
                          ) : (
                            <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Current price exceeds your {inputs.targetMarginPct}% margin target
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Batch totals */}
            {batchMode && inputs.quantity > 1 && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-400">Batch of {inputs.quantity} Units</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-mono font-semibold">+${fmt(breakdown.batchTotalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Fees</span>
                    <span className="font-mono text-red-500">-${fmt(breakdown.batchTotalFees)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                    <span>Batch Net Profit</span>
                    <span className={cn("font-mono", breakdown.batchNetProfit >= 0 ? "text-green-500" : "text-red-500")}>
                      {breakdown.batchNetProfit >= 0 ? "+" : ""}{fmt(breakdown.batchNetProfit)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Save scenario */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Scenario name (optional)"
                    value={scenarioName}
                    onChange={e => setScenarioName(e.target.value)}
                    className="flex-1 h-9 text-sm"
                    data-testid="input-scenario-name"
                  />
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="btn-save-scenario">
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                  </Button>
                </div>
                {savedScenarios.length > 0 && (
                  <button
                    onClick={() => setShowSaved(!showSaved)}
                    className="w-full text-xs text-muted-foreground flex items-center justify-between hover:text-foreground transition-colors"
                    data-testid="btn-toggle-saved"
                  >
                    <span>{savedScenarios.length} saved scenario{savedScenarios.length !== 1 ? "s" : ""}</span>
                    {showSaved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
                {showSaved && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {savedScenarios.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground ml-2">
                            ${fmt((s.outputs as any)?.netProfit || 0)} profit
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon" variant="ghost" className="w-6 h-6"
                            onClick={() => {
                              setInputs(s.inputs as CalcInputs);
                              setShowSaved(false);
                            }}
                            data-testid={`btn-load-scenario-${s.id}`}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="w-6 h-6 text-red-500"
                            onClick={() => deleteMutation.mutate(s.id)}
                            data-testid={`btn-delete-scenario-${s.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
