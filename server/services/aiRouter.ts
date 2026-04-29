// ─── AIBAY AI Engine — Pollinations.AI ──────────────────────────────────────
// Pollinations.AI: 100% free, zero API key, zero registration.
// Endpoint: https://text.pollinations.ai/openai/v1 (OpenAI-compatible)

import axios from "axios";

// Pollinations.AI — 100% free, zero API key
// Correct endpoint (Apr 2026): https://text.pollinations.ai/openai/v1
const POLLINATIONS_BASE = "https://text.pollinations.ai/openai/v1";

// Models in priority order — all free, no key
const MODELS = [
  "openai",          // GPT-4o
  "mistral",         // Mistral Large
  "gemini",          // Google Gemini
  "deepseek",        // DeepSeek
  "claude",          // Claude Sonnet
];

async function callAI(prompt: string, jsonMode = true): Promise<string | null> {
  // Try each model via direct HTTP (more reliable than SDK for Pollinations)
  for (const model of MODELS) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const resp = await axios.post(
        `${POLLINATIONS_BASE}/chat/completions`,
        body,
        {
          timeout: 25000,
          headers: { "Content-Type": "application/json" },
        }
      );
      const content = resp.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response");
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
      console.log(`[AI] ${model} succeeded`);
      return cleaned;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[AI] ${model} failed: ${msg}`);
    }
  }
  console.warn("[AI] All Pollinations models failed, using template fallback.");
  return null;
}

// ─── Template Engine (zero-API fallback) ─────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","for","of","in","on","at","to","by","is","it",
  "this","that","with","from","as","are","was","were","be","been","has","have",
  "had","will","would","could","should","may","might","about","their","there",
  "these","those","which","who","what","when","where","how","all","any","each",
  "both","few","more","most","some","such","no","not","only","same","than","too",
  "very","just","but","if","then","than","so","up","out","also","into","over",
  "after","between","through","during","before","under","while","against",
  "without","within","including","perfect","great","good","best","amazing","top",
  "high","quality","premium","excellent","beautiful","nice","free","fast","quick",
]);

const TITLE_TARGET = 68;
const TITLE_MAX = 80;

function optimizeTitle(rawTitle: string): string {
  const words = rawTitle.split(/\s+/).filter(w => w.length > 1);
  const keywords = words.filter(w => !STOP_WORDS.has(w.toLowerCase()));
  let title = keywords.join(" ");
  if (title.length < TITLE_TARGET && keywords.length < words.length) {
    const fillers = words.filter(w => STOP_WORDS.has(w.toLowerCase()));
    for (const f of fillers) {
      if (title.length + f.length + 1 <= TITLE_TARGET) title += " " + f;
    }
  }
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX).trim();
  return title;
}

function buildDescription(productTitle: string, specs: Record<string,string> = {}, bullets: string[] = []): string {
  const brandColor = "#1e3a8a";
  const accentColor = "#2563eb";
  const defaultBullets = bullets.length > 0 ? bullets : [
    "Premium quality — inspected before shipping",
    "Fast & secure packaging — arrives safely",
    "Compatible with all major brands",
    "Easy to install / use — no tools required",
    "30-day money-back guarantee",
    "Responsive customer support — we reply within 24h",
  ];
  const specsRows = Object.entries(specs).map(([k, v]) =>
    `<tr><td style="padding:8px 12px;font-weight:bold;background:#f8faff;border-bottom:1px solid #e2e8f0;width:35%">${k}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${v}</td></tr>`
  ).join("") || `<tr><td style="padding:8px 12px;font-weight:bold;background:#f8faff;border-bottom:1px solid #e2e8f0">Condition</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">New</td></tr>`;

  return `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
<div style="background:linear-gradient(135deg,${brandColor},${accentColor});padding:28px 24px;border-radius:8px 8px 0 0;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px;font-weight:bold">${productTitle}</h1>
<p style="color:#bfdbfe;margin:8px 0 0;font-size:14px">Premium Quality · Fast Dispatch · Satisfaction Guaranteed</p>
</div>
<div style="padding:24px;background:#fff;border:1px solid #e2e8f0">
<h2 style="color:${brandColor};font-size:16px;margin:0 0 12px;border-left:4px solid ${accentColor};padding-left:10px">Key Features</h2>
<ul style="margin:0;padding:0 0 0 18px;line-height:1.9">
${defaultBullets.map(b => `<li style="margin-bottom:4px">${b}</li>`).join("")}
</ul>
<h2 style="color:${brandColor};font-size:16px;margin:24px 0 12px;border-left:4px solid ${accentColor};padding-left:10px">Item Specifics</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">${specsRows}</table>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0">
${["✅ Fast Dispatch","🔒 Secure Payment","↩️ Easy Returns","⭐ Top Rated Seller"].map(b=>`<div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;text-align:center;font-size:13px;font-weight:bold;color:${brandColor}">${b}</div>`).join("")}
</div>
<div style="background:#f8faff;border-radius:6px;padding:16px;border:1px solid #e2e8f0;font-size:13px;color:#475569">
<strong>Shipping:</strong> Fast dispatch, tracked delivery. <strong>Returns:</strong> 30-day hassle-free returns accepted. <strong>Payment:</strong> All major payment methods accepted.
</div></div></div>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ListingContent {
  title: string;
  htmlDescription: string;
  html_description: string;
  bullets: string[];
  keywords: string[];
  itemSpecifics: { name: string; value: string }[];
}

export async function generateListingContent(
  paramsOrScrapedData: {
    productTitle?: string;
    productDescription?: string;
    category?: string;
    condition?: string;
    specs?: Record<string, string>;
    targetMarket?: string;
    pricePoint?: string;
    title?: string;
    description?: string;
    specifications?: Record<string, string>;
    categoryBreadcrumb?: string;
    platform?: string;
  },
  titleOverride?: string
): Promise<ListingContent> {
  const productTitle = titleOverride || paramsOrScrapedData.productTitle || paramsOrScrapedData.title || "Product";
  const productDescription = paramsOrScrapedData.productDescription || paramsOrScrapedData.description;
  const specs = paramsOrScrapedData.specs || paramsOrScrapedData.specifications;
  const category = paramsOrScrapedData.category || paramsOrScrapedData.categoryBreadcrumb;

  const prompt = `You are an elite eBay listing expert. Generate a complete, optimized eBay listing.

PRODUCT: ${productTitle}
${productDescription ? `DESCRIPTION: ${productDescription.slice(0, 800)}` : ""}
${category ? `CATEGORY: ${category}` : ""}
${specs ? `SPECS: ${JSON.stringify(specs).slice(0, 400)}` : ""}

RULES:
- Title: 60-68 characters (max 80). Front-load primary keyword. Include condition. No "Free", "Best", "Amazing", punctuation except hyphens.
- Description: Full professional inline-styled HTML. Gradient header, feature bullets (min 6), specs table (min 5 rows), trust badges grid, shipping section. max-width:700px, colors #1e3a8a/#2563eb.
- Bullets: 6-8 powerful selling points
- Keywords: 8-12 high-volume eBay search terms
- ItemSpecifics: 5-8 structured key-value pairs

OUTPUT: Valid JSON only (no markdown):
{"title":"...","htmlDescription":"...","bullets":["..."],"keywords":["..."],"itemSpecifics":[{"name":"...","value":"..."}]}`;

  const raw = await callAI(prompt);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.title && parsed.htmlDescription) {
        return { ...parsed, html_description: parsed.htmlDescription };
      }
    } catch {}
  }

  const optimized = optimizeTitle(productTitle);
  const specsObj = specs || {};
  const htmlDescription = buildDescription(productTitle, specsObj);
  return {
    title: optimized,
    htmlDescription,
    html_description: htmlDescription,
    bullets: [
      "Premium quality product",
      "Fast and secure shipping",
      "30-day money-back guarantee",
      "Compatible with all major brands",
      "Professional grade materials",
      "Easy setup and use",
    ],
    keywords: productTitle.split(/\s+/).filter(w => w.length > 3),
    itemSpecifics: Object.entries(specsObj).map(([name, value]) => ({ name, value })),
  };
}

export async function generateKeywordSuggestions(keyword: string): Promise<{ keywords: string[]; searchVolume?: Record<string, string>; titleTemplate?: string }> {
  const prompt = `Generate 12 high-volume eBay search keyword variations for: "${keyword}"
Focus on: buyer intent phrases, model/spec variations, long-tail keywords, related accessories, condition variations.
Output JSON: {"keywords":["..."],"searchVolume":{"keyword":"High/Medium/Low"},"titleTemplate":"[Brand] ${keyword} [Model] - [Condition]"}`;
  const raw = await callAI(prompt);
  try { if (raw) return JSON.parse(raw); } catch {}
  const base = keyword.split(" ").filter(w => w.length > 2);
  return {
    keywords: [keyword, `${keyword} new`, `${keyword} used`, `${keyword} lot`, `buy ${keyword}`, `${keyword} bundle`, ...base.flatMap(w => [`${w} replacement`, `${w} parts`])].slice(0, 12),
    titleTemplate: `[Brand] ${keyword} [Model] - New`,
  };
}

export async function generateScanVerdicts(items: { title: string; price: number; watchCount: number; sellThrough?: number }[]): Promise<Record<string, string>> {
  const top = items.slice(0, 5);
  const prompt = `Analyze these eBay listings and give a 1-sentence profit verdict for each.
Items: ${JSON.stringify(top)}
Output JSON: {"0":"verdict for item 0","1":"verdict","2":"verdict","3":"verdict","4":"verdict"}`;
  const raw = await callAI(prompt);
  try { if (raw) return JSON.parse(raw); } catch {}
  return Object.fromEntries(top.map((_, i) => [String(i), "Review pricing and competition before listing."]));
}

export async function scoreTitleSEO(title: string): Promise<{ score: number; suggestions: string[]; improvedTitle: string }> {
  const prompt = `Analyze this eBay title for SEO quality: "${title}"
Score 0-100. Give 3 specific improvement suggestions. Provide an improved version.
Output JSON: {"score":75,"suggestions":["...","...","..."],"improvedTitle":"..."}`;
  const raw = await callAI(prompt);
  try { if (raw) return JSON.parse(raw); } catch {}
  const len = title.length;
  return {
    score: len >= 60 && len <= 80 ? 70 : 45,
    suggestions: ["Add primary keyword in first 3 words", "Include model number or specification", "Add condition word (New/Used)"],
    improvedTitle: optimizeTitle(title),
  };
}

export async function extractItemSpecifics(
  titleOrText: string,
  descriptionOrCategory?: string,
  specs?: Record<string, string>
): Promise<{ name: string; value: string }[]> {
  const title = titleOrText;
  const description = descriptionOrCategory;
  const prompt = `Extract 6-10 eBay item specifics from this product info.
Title: "${title}"
${description ? `Description: ${description.slice(0, 400)}` : ""}
Output JSON: {"specifics":[{"name":"Brand","value":"..."},{"name":"Model","value":"..."},...]}`;
  const raw = await callAI(prompt);
  try {
    if (raw) {
      const p = JSON.parse(raw);
      if (p.specifics?.length) return p.specifics;
    }
  } catch {}
  const fromSpecs = specs ? Object.entries(specs).map(([name, value]) => ({ name, value })) : [];
  return fromSpecs.length ? fromSpecs : [{ name: "Condition", value: "New" }, { name: "Brand", value: "Unbranded" }];
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  name: string;
  confidence: number;
}

export async function suggestCategories(title: string, description?: string): Promise<CategorySuggestion[]> {
  const lower = title.toLowerCase();
  const cats: CategorySuggestion[] = [];
  if (/phone|iphone|samsung|android|mobile/i.test(lower)) cats.push({ categoryId: "15032", categoryName: "Cell Phones & Accessories", name: "Cell Phones & Accessories", confidence: 90 });
  if (/laptop|computer|pc|macbook|tablet|ipad/i.test(lower)) cats.push({ categoryId: "58058", categoryName: "Computers & Tablets", name: "Computers & Tablets", confidence: 88 });
  if (/camera|lens|gopro|dslr|mirrorless/i.test(lower)) cats.push({ categoryId: "625", categoryName: "Cameras & Photo", name: "Cameras & Photo", confidence: 88 });
  if (/game|xbox|playstation|nintendo|ps4|ps5/i.test(lower)) cats.push({ categoryId: "1249", categoryName: "Video Games & Consoles", name: "Video Games & Consoles", confidence: 92 });
  if (/shirt|shoes|dress|jacket|clothing|apparel/i.test(lower)) cats.push({ categoryId: "11450", categoryName: "Clothing & Accessories", name: "Clothing & Accessories", confidence: 85 });
  if (/watch|jewelry|ring|necklace|bracelet/i.test(lower)) cats.push({ categoryId: "281", categoryName: "Jewelry & Watches", name: "Jewelry & Watches", confidence: 85 });
  if (!cats.length) cats.push({ categoryId: "293", categoryName: "Consumer Electronics", name: "Consumer Electronics", confidence: 60 });
  return cats;
}

export async function generateLifestylePrompts(title: string, description?: string): Promise<string[]> {
  return [
    `Professional product photo of ${title} on white background, studio lighting`,
    `${title} in use, lifestyle setting, natural daylight, high quality`,
    `Close-up detail shot of ${title}, showing quality and features`,
  ];
}

export async function scoreSupplierMatch(productTitle: string, supplierTitleOrProduct: string | { title?: string; [key: string]: any }): Promise<{ score: number; verdict: string; reason?: string }> {
  const supplierTitle = typeof supplierTitleOrProduct === "string"
    ? supplierTitleOrProduct
    : (supplierTitleOrProduct?.title || "");
  const words = productTitle.toLowerCase().split(/\s+/);
  const match = words.filter(w => supplierTitle.toLowerCase().includes(w) && w.length > 3).length;
  const score = Math.round((match / Math.max(words.length, 1)) * 100);
  const verdict = score > 70 ? "Strong match" : score > 40 ? "Possible match — verify specs" : "Low match — verify manually";
  return { score, verdict, reason: verdict };
}

export async function suggestMinSalePrice(costPrice: number, targetMarginPct?: number, categoryKey?: string): Promise<{ minPrice: number; targetPrice: number; maxPrice: number }> {
  const ebayFee = 0.1325;
  const shipping = 4.99;
  const marginRate = targetMarginPct ? targetMarginPct / 100 : 0.15;
  const minProfit = costPrice * marginRate;
  const minPrice = Math.ceil((costPrice + shipping + minProfit) / (1 - ebayFee - 0.029) * 100) / 100;
  return { minPrice, targetPrice: Math.ceil(minPrice * 1.25 * 100) / 100, maxPrice: Math.ceil(minPrice * 1.8 * 100) / 100 };
}

export async function analyzeExistingListing(url: string): Promise<{
  seoScore: number;
  titleScore: number;
  descriptionScore: number;
  issues: string[];
  improvements: string[];
  estimatedRank: string;
}> {
  const prompt = `You are an eBay SEO expert. Analyze this eBay listing URL and provide optimization insights.
URL: ${url}
Since you cannot browse URLs, generate a professional analysis framework with common eBay listing issues.
Output JSON: {"seoScore":72,"titleScore":65,"descriptionScore":78,"issues":["Title too short","Missing item specifics","No condition keywords"],"improvements":["Add model number to title","Include 6+ bullet points","Add UPC/EAN barcode"],"estimatedRank":"Page 2-3"}`;
  const raw = await callAI(prompt);
  try { if (raw) return JSON.parse(raw); } catch {}
  return {
    seoScore: 68, titleScore: 62, descriptionScore: 72,
    issues: ["Title may be under-optimized", "Description may lack structured content", "Item specifics may be incomplete"],
    improvements: ["Front-load primary keyword in title", "Add at least 8 item specifics", "Include professional HTML description"],
    estimatedRank: "Page 2-4 estimated",
  };
}

export async function generateBulkListings(products: { title: string; price?: number; category?: string }[]): Promise<{ title: string; description: string; keywords: string[] }[]> {
  const results = [];
  for (const p of products.slice(0, 20)) {
    const content = await generateListingContent({ productTitle: p.title, category: p.category });
    results.push({ title: content.title, description: content.htmlDescription, keywords: content.keywords });
  }
  return results;
}

export async function calculateROAS(params: {
  adSpend: number;
  revenue: number;
  cogs: number;
  ebayFeePercent?: number;
  shippingCost?: number;
}): Promise<{
  roas: number;
  breakEvenROAS: number;
  netProfit: number;
  profitMargin: number;
  verdict: string;
}> {
  const { adSpend, revenue, cogs, ebayFeePercent = 13.25, shippingCost = 0 } = params;
  const ebayFees = revenue * (ebayFeePercent / 100);
  const netRevenue = revenue - ebayFees - shippingCost;
  const netProfit = netRevenue - cogs - adSpend;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const breakEvenROAS = adSpend > 0 ? (cogs + adSpend + ebayFees + shippingCost) / adSpend : 0;
  const verdict = roas >= breakEvenROAS * 1.5 ? "Excellent — highly profitable campaign"
    : roas >= breakEvenROAS ? "Profitable — positive ROI"
    : roas >= breakEvenROAS * 0.8 ? "Near break-even — optimize targeting"
    : "Loss-making — pause and review campaign";
  return { roas: Math.round(roas * 100) / 100, breakEvenROAS: Math.round(breakEvenROAS * 100) / 100, netProfit: Math.round(netProfit * 100) / 100, profitMargin: Math.round(profitMargin * 100) / 100, verdict };
}
