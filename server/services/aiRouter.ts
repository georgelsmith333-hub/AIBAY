// ─── AIBAY AI Engine ────────────────────────────────────────────────────────
// Uses OpenRouter when OPENROUTER_API_KEY is set; falls back to built-in smart
// templates so the app works fully without any external API key.

import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.replit_dev_domain
  ? `https://${process.env.replit_dev_domain}`
  : "http://localhost:5000";
const SITE_NAME = "AIBAY — eBay Intelligence Platform";

let openai: OpenAI | null = null;
if (OPENROUTER_API_KEY) {
  openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": SITE_URL,
      "X-Title": SITE_NAME,
    },
  });
}

const MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-2.0-pro-exp-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

async function callAI(prompt: string): Promise<string | null> {
  if (!openai) return null;
  let lastError: any = null;
  for (const model of MODELS) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content;
      if (!content) throw new Error("Empty response");
      return content;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn("OpenRouter models failed, using template fallback.", lastError?.message);
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

// Target: ~68 chars, max 80 chars (eBay best practice is under 70)
const TITLE_TARGET = 68;
const TITLE_MAX = 80;

function optimizeTitle(rawTitle: string): string {
  let title = rawTitle.replace(/[^\w\s\-&\/]/g, " ").replace(/\s+/g, " ").trim();
  const words = title.split(" ");
  const important: string[] = [];
  const secondary: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (STOP_WORDS.has(lower) || w.length <= 1) continue;
    if (/\d/.test(w) || /^[A-Z]{2,}/.test(w) || /^[A-Z][a-z]+[A-Z]/.test(w)) {
      important.push(w);
    } else {
      secondary.push(w);
    }
  }
  const combined = [...important, ...secondary].join(" ");
  // Hard cap at TITLE_MAX (80), target TITLE_TARGET (68)
  if (combined.length <= TITLE_MAX) return combined;
  const trimmed = combined.slice(0, TITLE_MAX);
  return trimmed.slice(0, trimmed.lastIndexOf(" ")) || trimmed;
}

function extractFeatures(description: string): string[] {
  if (!description) return [];
  const lines = description.split(/[\n•\-\*\|]/).map(l => l.trim()).filter(l => l.length > 15 && l.length < 200);
  const seen = new Set<string>();
  const features: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().slice(0, 30);
    if (!seen.has(key)) { seen.add(key); features.push(line); if (features.length >= 8) break; }
  }
  return features;
}

function extractSpecs(description: string, title: string): { key: string; value: string }[] {
  const specs: { key: string; value: string }[] = [];
  const text = `${title}\n${description}`;
  const patterns = [
    { key: "Brand", regex: /(?:brand|by)\s*[:\-]?\s*([A-Z][a-zA-Z]+)/i },
    { key: "Model", regex: /(?:model|item|part\s*#?)\s*[:\-]?\s*([A-Z0-9\-]+)/i },
    { key: "Color", regex: /(?:color|colour)\s*[:\-]?\s*([A-Za-z\/]+)/i },
    { key: "Material", regex: /(?:material|made of)\s*[:\-]?\s*([A-Za-z\s,]+?)(?:\.|$|\n)/i },
    { key: "Size", regex: /(?:size|dimensions?)\s*[:\-]?\s*([\d\.]+\s*x\s*[\d\.]+|[A-Z]{1,3}|[\d\.]+\s*(?:cm|mm|in|ft|oz|lb|kg|g))/i },
    { key: "Weight", regex: /(?:weight)\s*[:\-]?\s*([\d\.]+\s*(?:kg|g|oz|lb|lbs))/i },
    { key: "Compatibility", regex: /(?:compatible with|fits|for)\s*[:\-]?\s*([^.\n]{5,50})/i },
    { key: "Condition", regex: /(?:condition)\s*[:\-]?\s*(New|Used|Refurbished|Open Box)/i },
  ];
  for (const { key, regex } of patterns) {
    const match = text.match(regex);
    if (match?.[1]?.trim()) specs.push({ key, value: match[1].trim().slice(0, 60) });
  }
  if (!specs.find(s => s.key === "Condition")) specs.push({ key: "Condition", value: "New" });
  return specs.slice(0, 8);
}

function buildTemplateHtml(title: string, features: string[], specs: { key: string; value: string }[]): string {
  const featureItems = features.length > 0
    ? features.map(f => `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${f}</li>`).join("")
    : ["Brand new condition — ready to ship","Fast handling — dispatched within 1 business day","Securely packaged to prevent any damage in transit","Genuine product — exactly as described","30-day returns accepted — buy with full confidence"]
        .map(f => `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${f}</li>`).join("");

  const specRows = specs.map(s =>
    `<tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600;color:#495057;width:35%;border:1px solid #dee2e6;">${s.key}</td><td style="padding:8px 12px;border:1px solid #dee2e6;">${s.value}</td></tr>`
  ).join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#212529;line-height:1.6;">
  <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:28px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">${title}</h1>
    <p style="margin:0;opacity:0.85;font-size:14px;">Premium Quality · Fast Dispatch · 100% Satisfaction Guaranteed</p>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #dee2e6;border-top:none;">
    <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1e3a8a;">✅ Key Features</h2>
    <ul style="list-style:none;padding:0;margin:0;font-size:14px;">${featureItems}</ul>
  </div>
  ${specRows ? `<div style="padding:24px;background:#fff;border:1px solid #dee2e6;border-top:none;"><h2 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1e3a8a;">📋 Item Specifics</h2><table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${specRows}</tbody></table></div>` : ""}
  <div style="padding:24px;background:#f0f7ff;border:1px solid #dee2e6;border-top:none;">
    <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1e3a8a;">⭐ Why Buy From Us?</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">🏆</div><div style="font-weight:600;margin-bottom:4px;">Top Rated Seller</div><div style="color:#6c757d;">100% positive feedback score</div></div>
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">🚚</div><div style="font-weight:600;margin-bottom:4px;">Fast Dispatch</div><div style="color:#6c757d;">Shipped within 1 business day</div></div>
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">🔒</div><div style="font-weight:600;margin-bottom:4px;">Secure Packaging</div><div style="color:#6c757d;">Bubble-wrapped &amp; box packed</div></div>
      <div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #dbe4f0;"><div style="font-size:22px;margin-bottom:6px;">↩️</div><div style="font-weight:600;margin-bottom:4px;">Easy Returns</div><div style="color:#6c757d;">30-day hassle-free returns</div></div>
    </div>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
    <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#1e3a8a;">📦 Shipping &amp; Returns</h2>
    <ul style="list-style:none;padding:0;margin:0;font-size:14px;">
      <li style="padding:6px 0;">✅ Usually dispatched within <strong>1 business day</strong></li>
      <li style="padding:6px 0;">✅ Securely packaged to prevent any damage</li>
      <li style="padding:6px 0;">✅ Tracking number provided for all orders</li>
      <li style="padding:6px 0;">✅ <strong>30-day returns</strong> — item must be in original condition</li>
      <li style="padding:6px 0;">✅ Powered by <strong style="color:#2563eb;">AIBAY</strong> — eBay's smartest listing engine</li>
    </ul>
  </div>
</div>`;
}

// ─── Listing Generation ───────────────────────────────────────────────────────
export interface AIResponse {
  title: string;
  html_description: string;
}

export async function generateListingContent(productData: any, titleOverride?: string): Promise<AIResponse> {
  // ── Try OpenRouter first ──
  if (openai) {
    const overrideLine = titleOverride ? `\nIMPORTANT: Use this exact title (do not change it): "${titleOverride}"` : "";
    const prompt = `You are an expert eBay copywriter. Product data:
Title: ${productData.title}
Description: ${(productData.description || "").slice(0, 2000)}
${overrideLine}
Create an eBay listing. Output valid JSON only:
{
  "title": "...",  // TARGET 68 chars (max 80), front-load keywords, no stop words, no punctuation${titleOverride ? ` — MUST be exactly: ${titleOverride}` : ""}
  "html_description": "..."  // professional inline-styled HTML, mobile-responsive
}`;
    const content = await callAI(prompt);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.title && parsed.html_description) {
          if (titleOverride) parsed.title = titleOverride;
          return parsed as AIResponse;
        }
      } catch {}
    }
  }

  // ── Template fallback ──
  const title = titleOverride || optimizeTitle(productData.title || "Product");
  const desc = productData.description || "";
  const features = extractFeatures(desc);
  const specs = extractSpecs(desc, productData.title || "");
  return { title, html_description: buildTemplateHtml(title, features, specs) };
}

// ─── Keyword Suggestions ──────────────────────────────────────────────────────
export interface KeywordSuggestion {
  keyword: string;
  charCount: number;
  placement: "front" | "middle" | "end";
  relevanceScore: number;
  reason: string;
}

export interface KeywordSuggestionsResponse {
  keywords: KeywordSuggestion[];
  titleTemplate: string;
}

const KEYWORD_MODIFIERS = [
  { mod: "New", placement: "front", reason: "Buyers filter by condition — New is the highest-converting condition keyword", score: 92 },
  { mod: "Used", placement: "front", reason: "Used items sell faster when explicitly stated in the title", score: 70 },
  { mod: "Lot", placement: "end", reason: "Lot listings attract bulk buyers and show up in bundle searches", score: 75 },
  { mod: "Bundle", placement: "end", reason: "Bundle searches indicate high buyer intent and reduce competition", score: 72 },
  { mod: "Refurbished", placement: "front", reason: "Refurbished filter drives budget-conscious buyers with high purchase intent", score: 68 },
  { mod: "Free Shipping", placement: "end", reason: "Free shipping listed in title dramatically increases click-through rate", score: 88 },
  { mod: "Fast Shipping", placement: "end", reason: "Fast shipping appeals to last-minute buyers and boosts visibility", score: 82 },
  { mod: "Rare", placement: "front", reason: "Scarcity signals drive urgency and emotional buying decisions", score: 77 },
  { mod: "Vintage", placement: "front", reason: "Vintage prefix captures collector market with premium pricing potential", score: 74 },
  { mod: "Authentic", placement: "front", reason: "Authenticity signals reduce buyer hesitation on luxury items", score: 79 },
  { mod: "Original", placement: "front", reason: "Original keyword reassures buyers about product legitimacy", score: 76 },
  { mod: "OEM", placement: "front", reason: "OEM signals genuine manufacturer parts to B2B buyers", score: 71 },
  { mod: "with Box", placement: "end", reason: "With Box signals completeness and commands higher perceived value", score: 73 },
  { mod: "Sealed", placement: "front", reason: "Sealed items fetch higher prices — strong trust signal", score: 80 },
  { mod: "Wireless", placement: "front", reason: "Feature keywords front-loaded increase Cassini relevance score", score: 83 },
];

export async function generateKeywordSuggestions(seedKeyword: string): Promise<KeywordSuggestionsResponse> {
  // ── Try OpenRouter first ──
  if (openai) {
    const prompt = `You are an expert eBay SEO specialist. Keyword: "${seedKeyword}"

Generate 25 eBay keyword variations buyers search for. For each:
- relevanceScore: 1-100
- placement: front/middle/end (in 68-char target eBay title)
- reason: one sentence on conversion value

Also provide titleTemplate: best-practice eBay title targeting 68 chars (max 80).

Output valid JSON only:
{"keywords":[{"keyword":"...","charCount":0,"placement":"front","relevanceScore":0,"reason":"..."}],"titleTemplate":"..."}`;
    const content = await callAI(prompt);
    if (content) {
      try {
        const parsed = JSON.parse(content) as KeywordSuggestionsResponse;
        if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
          parsed.keywords = parsed.keywords.map(kw => ({ ...kw, charCount: kw.keyword.length }));
          return parsed;
        }
      } catch {}
    }
  }

  // ── Template fallback ──
  const seed = seedKeyword.trim();
  const primaryWord = seed.split(/\s+/)[0] || seed;
  const keywords: KeywordSuggestion[] = [];

  // Base
  keywords.push({ keyword: seed, charCount: seed.length, placement: "front", relevanceScore: 95, reason: "Exact match seed keyword — highest relevance for direct buyer searches" });
  keywords.push({ keyword: `${seed} New`, charCount: (`${seed} New`).length, placement: "front", relevanceScore: 91, reason: "New condition front-loaded — highest conversion keyword combination" });
  keywords.push({ keyword: `${seed} Lot`, charCount: (`${seed} Lot`).length, placement: "end", relevanceScore: 74, reason: "Lot suffix attracts bulk buyers and reduces single-item competition" });
  keywords.push({ keyword: `Vintage ${seed}`, charCount: (`Vintage ${seed}`).length, placement: "front", relevanceScore: 71, reason: "Vintage prefix captures collector market with premium pricing potential" });
  keywords.push({ keyword: `${seed} Bundle`, charCount: (`${seed} Bundle`).length, placement: "end", relevanceScore: 69, reason: "Bundle appeals to value seekers and increases average order value" });

  // Modifiers
  for (const m of KEYWORD_MODIFIERS) {
    const kw = m.placement === "front" ? `${m.mod} ${seed}` : `${seed} ${m.mod}`;
    keywords.push({
      keyword: kw.slice(0, 80),
      charCount: kw.length,
      placement: m.placement as "front" | "middle" | "end",
      relevanceScore: Math.max(50, m.score - Math.floor(Math.random() * 8)),
      reason: m.reason,
    });
  }

  // Long-tail
  const longTails = [
    { kw: `${seed} for Sale`, reason: "For Sale suffix targets motivated buyers at the bottom of the funnel", score: 63 },
    { kw: `Buy ${seed}`, reason: "Buy prefix captures transactional searches with high purchase intent", score: 60 },
    { kw: `${seed} Best Price`, reason: "Best Price targets price-sensitive buyers comparing multiple listings", score: 58 },
    { kw: `${primaryWord} Parts`, reason: "Parts keyword attracts repair-market buyers with specific needs", score: 55 },
    { kw: `${primaryWord} Accessories`, reason: "Accessories cross-sell keyword captures add-on purchase searches", score: 53 },
  ];

  for (const lt of longTails) {
    keywords.push({
      keyword: lt.kw.slice(0, 80),
      charCount: lt.kw.length,
      placement: "end",
      relevanceScore: lt.score,
      reason: lt.reason,
    });
  }

  const seen = new Set<string>();
  const unique = keywords.filter(k => {
    const key = k.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 25);

  const top = unique[0]?.keyword || seed;
  const second = unique[1]?.keyword.split(" ").slice(-1)[0] || "";
  const titleTemplate = `${top} ${second} New Free Shipping`.trim().slice(0, TITLE_TARGET);

  return { keywords: unique, titleTemplate };
}

// ─── Turbo Scanner Verdicts ───────────────────────────────────────────────────
export async function generateScanVerdicts(
  products: { title: string; price: number; watchCount: number }[]
): Promise<{ verdicts: { shouldSell: boolean; reason: string; score: number }[] }> {
  // ── Try OpenRouter first ──
  if (openai && products.length > 0) {
    const prompt = `eBay dropshipping analyst. Evaluate ${Math.min(products.length, 20)} products:
${products.slice(0, 20).map((p, i) => `${i + 1}. "${p.title}" — $${p.price.toFixed(2)}, ${p.watchCount} watchers`).join("\n")}
For each: shouldSell (bool), score (0-100), reason (1 sentence).
Output JSON: {"verdicts":[{"shouldSell":true,"score":85,"reason":"..."}]}`;
    const content = await callAI(prompt);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.verdicts)) return parsed;
      } catch {}
    }
  }

  // ── Rule-based fallback ──
  const verdicts = products.slice(0, 20).map(p => {
    const watchScore = Math.min(p.watchCount * 4, 40);
    const priceScore = p.price >= 15 && p.price <= 250 ? 35 : p.price > 250 ? 20 : 10;
    const titleScore = p.title.length >= 30 ? 15 : 8;
    const score = Math.min(watchScore + priceScore + titleScore, 100);
    const shouldSell = score >= 50;
    const reason =
      score >= 80 ? `High demand (${p.watchCount} watchers) with strong price point.`
      : score >= 60 ? `Good indicators — solid resell potential.`
      : score >= 40 ? `Moderate interest — consider niche variations.`
      : `Low demand signals — look for higher-margin alternatives.`;
    return { shouldSell, reason, score };
  });

  return { verdicts };
}

// ─── Title SEO Scorer ────────────────────────────────────────────────────────

export interface TitleDimensions {
  lengthUtilization: number;
  keywordPlacement: number;
  specificity: number;
  brandInclusion: number;
  conditionClarity: number;
  forbiddenWords: number;
}

export interface TitleScoreResult {
  overall: number;
  dimensions: TitleDimensions;
  suggestions: string[];
  alternatives: { title: string; score: number; changes: string[] }[];
}

const FORBIDDEN_WORDS = [
  "free shipping", "sale", "new arrival", "best", "wow", "amazing",
  "see description", "check", "click", "buy now", "visit store",
  "cheap", "lowest price", "hot", "must have", "limited",
];

const STRONG_KEYWORDS = [
  "new", "sealed", "oem", "genuine", "original", "authentic", "kit",
  "bundle", "lot", "set", "inch", "mm", "cm", "lb", "oz", "gb", "tb", "mhz",
  "wireless", "bluetooth", "usb", "hdmi", "4k", "1080p", "rechargeable",
];

function scoreTitle(title: string): TitleScoreResult {
  const len = title.length;
  const words = title.toLowerCase().split(/\s+/);
  const firstThree = words.slice(0, 3).join(" ");

  // Length utilization (ideal: 60-80)
  const lengthUtilization =
    len >= 70 ? 100
    : len >= 60 ? 90
    : len >= 50 ? 75
    : len >= 40 ? 55
    : len >= 25 ? 35
    : 15;

  // Keyword placement: strong keywords in first 3 words?
  const hasKeywordFront = STRONG_KEYWORDS.some(k => firstThree.includes(k));
  const keywordCount = STRONG_KEYWORDS.filter(k => title.toLowerCase().includes(k)).length;
  const keywordPlacement = Math.min(
    (hasKeywordFront ? 40 : 0) + Math.min(keywordCount * 15, 60),
    100
  );

  // Specificity: numbers, units, model numbers present
  const hasNumbers = /\d/.test(title);
  const hasUnits = /\b(mm|cm|inch|gb|tb|mb|lb|oz|ft|kg|mhz|ghz|watt|w\b)/i.test(title);
  const hasModel = /[A-Z]{1,5}[-]?[0-9]{2,}/i.test(title);
  const specificity = Math.min((hasNumbers ? 30 : 0) + (hasUnits ? 35 : 0) + (hasModel ? 35 : 0), 100);

  // Brand inclusion: title-case word in first 3?
  const brandInclusion = /^[A-Z][a-z]/.test(title) ? 80 : words[0]?.[0]?.toUpperCase() === words[0]?.[0] ? 60 : 30;

  // Condition clarity: "New", "Used", "Refurbished" present
  const conditionWords = ["new", "used", "refurbished", "open box", "for parts", "pre-owned"];
  const conditionClarity = conditionWords.some(c => title.toLowerCase().includes(c)) ? 100 : 20;

  // Forbidden words penalty
  const foundForbidden = FORBIDDEN_WORDS.filter(w => title.toLowerCase().includes(w));
  const forbiddenWords = Math.max(100 - foundForbidden.length * 35, 0);

  const overall = Math.round(
    (lengthUtilization * 0.25 + keywordPlacement * 0.25 + specificity * 0.2 +
     brandInclusion * 0.1 + conditionClarity * 0.1 + forbiddenWords * 0.1)
  );

  const suggestions: string[] = [];
  if (len < 55) suggestions.push(`Title is only ${len} chars — aim for 60-68 to maximize search visibility`);
  if (len >= 55 && len < 60) suggestions.push(`Title is ${len} chars — try to reach 60-68 characters for best Cassini ranking`);
  if (len > TITLE_MAX) suggestions.push(`Title exceeds ${TITLE_MAX} chars — eBay will truncate it in search results`);
  if (!hasKeywordFront) suggestions.push("Move your strongest keyword to the first 3 words for Cassini ranking");
  if (!hasNumbers && !hasUnits) suggestions.push("Add specific measurements or model numbers to increase CTR");
  if (conditionClarity < 50) suggestions.push('Include condition word (e.g. "New", "Used") for buyer confidence');
  if (foundForbidden.length > 0) suggestions.push(`Remove forbidden promotional words: ${foundForbidden.join(", ")}`);
  if (keywordCount < 2) suggestions.push("Add more descriptive keywords (color, material, size, compatibility)");

  const dims: TitleDimensions = { lengthUtilization, keywordPlacement, specificity, brandInclusion, conditionClarity, forbiddenWords };
  return { overall, dimensions: dims, suggestions, alternatives: [] };
}

export async function scoreTitleSEO(title: string): Promise<TitleScoreResult> {
  if (!openai) {
    const base = scoreTitle(title);
    // Generate template-based alternatives
    const words = title.split(" ");
    const brandWord = words[0];
    const rest = words.slice(1).join(" ");
    const alts = [
      {
        title: `New ${title.slice(0, TITLE_TARGET - 4)}`,
        score: scoreTitle(`New ${title.slice(0, TITLE_TARGET - 4)}`).overall,
        changes: ['Added "New" at the start for condition clarity'],
      },
      {
        title: `${brandWord} ${rest} - ${words.slice(-2).join(" ")} New`.slice(0, TITLE_TARGET),
        score: scoreTitle(`${brandWord} ${rest} - ${words.slice(-2).join(" ")} New`.slice(0, TITLE_TARGET)).overall,
        changes: ["Moved brand name forward, appended condition"],
      },
      {
        title: title.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, TITLE_TARGET),
        score: scoreTitle(title.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, TITLE_TARGET)).overall,
        changes: ["Removed special characters for cleaner parsing"],
      },
    ].filter(a => a.title !== title);
    return { ...base, alternatives: alts };
  }

  try {
    const prompt = `You are an eBay Cassini SEO expert. Analyze this eBay listing title and return JSON.

Title: "${title}"

Return this exact JSON structure (no markdown):
{
  "overall": <0-100>,
  "dimensions": {
    "lengthUtilization": <0-100>,
    "keywordPlacement": <0-100>,
    "specificity": <0-100>,
    "brandInclusion": <0-100>,
    "conditionClarity": <0-100>,
    "forbiddenWords": <0-100>
  },
  "suggestions": ["<tip1>", "<tip2>", "<tip3>"],
  "alternatives": [
    {"title": "<improved title targeting 68 chars, max 80>", "score": <0-100>, "changes": ["<what changed>"]},
    {"title": "<improved title targeting 68 chars, max 80>", "score": <0-100>, "changes": ["<what changed>"]},
    {"title": "<improved title targeting 68 chars, max 80>", "score": <0-100>, "changes": ["<what changed>"]}
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: MODELS[0],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    const jsonStr = text.startsWith("{") ? text : text.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const parsed = JSON.parse(jsonStr);
    return parsed as TitleScoreResult;
  } catch (err) {
    console.warn("AI title score failed, using template:", err);
    const base = scoreTitle(title);
    return { ...base, alternatives: [] };
  }
}

// ─── Item Specifics Extractor ─────────────────────────────────────────────────

export interface ItemSpecific {
  name: string;
  value: string;
  source: "scraped" | "ai";
}

export async function extractItemSpecifics(
  text: string,
  category: string,
  specs: Record<string, string> = {}
): Promise<ItemSpecific[]> {
  // Start with scraped specs
  const result: ItemSpecific[] = Object.entries(specs).map(([name, value]) => ({
    name,
    value,
    source: "scraped" as const,
  }));

  if (!openai) {
    // Template: extract common patterns from text
    const patterns: { regex: RegExp; name: string }[] = [
      { regex: /brand[:\s]+([A-Za-z][\w\s]{1,30})/i, name: "Brand" },
      { regex: /model[:\s]+([A-Za-z0-9\-\/]{2,30})/i, name: "Model" },
      { regex: /color[:\s]+([\w\s]{2,20})/i, name: "Color" },
      { regex: /material[:\s]+([\w\s]{2,30})/i, name: "Material" },
      { regex: /weight[:\s]+([\d.]+\s*(?:kg|lb|oz|g))/i, name: "Weight" },
      { regex: /size[:\s]+([\d.]+\s*(?:mm|cm|inch|")?)/i, name: "Size" },
      { regex: /compatible with[:\s]+([^\n.]{3,50})/i, name: "Compatible With" },
      { regex: /voltage[:\s]+([\d.]+\s*[Vv])/i, name: "Voltage" },
      { regex: /watt[:\s]+([\d.]+\s*[Ww])/i, name: "Wattage" },
    ];
    const existingNames = new Set(result.map(r => r.name.toLowerCase()));
    for (const { regex, name } of patterns) {
      if (existingNames.has(name.toLowerCase())) continue;
      const match = text.match(regex);
      if (match?.[1]) {
        result.push({ name, value: match[1].trim().slice(0, 65), source: "ai" });
        existingNames.add(name.toLowerCase());
      }
    }
    // Ensure condition is present
    if (!existingNames.has("condition")) {
      result.push({ name: "Condition", value: "New", source: "ai" });
    }
    return result.slice(0, 20);
  }

  try {
    const existingNames = result.map(r => r.name).join(", ");
    const prompt = `You are an eBay listing expert. Extract item specifics for the "${category}" category.

Product text: ${text.slice(0, 2000)}

Already extracted: ${existingNames || "none"}

Return a JSON array of additional item specifics (max 15, not already in the list above):
[{"name": "<eBay field name>", "value": "<value max 65 chars>"}]

Focus on: Brand, Model, Type, Color, Material, Size, MPN, Compatible With, Condition, Country/Region of Manufacture.
Return only the JSON array, no markdown.`;

    const completion = await openai.chat.completions.create({
      model: MODELS[0],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const text2 = completion.choices[0]?.message?.content?.trim() || "[]";
    const jsonStr = text2.startsWith("[") ? text2 : text2.match(/\[[\s\S]*\]/)?.[0] || "[]";
    const aiSpecs = JSON.parse(jsonStr) as { name: string; value: string }[];
    const existingSet = new Set(result.map(r => r.name.toLowerCase()));
    for (const s of aiSpecs) {
      if (s.name && s.value && !existingSet.has(s.name.toLowerCase())) {
        result.push({ name: s.name, value: s.value.slice(0, 65), source: "ai" });
        existingSet.add(s.name.toLowerCase());
      }
    }
  } catch (err) {
    console.warn("Item specifics AI failed:", err);
  }

  return result.slice(0, 20);
}

// ─── Category Suggester ───────────────────────────────────────────────────────

export interface CategorySuggestion {
  name: string;
  breadcrumb: string;
  categoryId: string;
  confidence: number;
  reason: string;
}

const CATEGORY_DATABASE: CategorySuggestion[] = [
  { name: "Consumer Electronics", breadcrumb: "Electronics > Consumer Electronics", categoryId: "293", confidence: 0, reason: "" },
  { name: "Cell Phones & Smartphones", breadcrumb: "Cell Phones & Accessories > Cell Phones & Smartphones", categoryId: "9355", confidence: 0, reason: "" },
  { name: "Laptops & Netbooks", breadcrumb: "Computers/Tablets & Networking > Laptops & Netbooks", categoryId: "177", confidence: 0, reason: "" },
  { name: "Tablets & eReaders", breadcrumb: "Computers/Tablets & Networking > Tablets & eReaders", categoryId: "171485", confidence: 0, reason: "" },
  { name: "Smart Watches", breadcrumb: "Jewelry & Watches > Watches > Smart Watches", categoryId: "178893", confidence: 0, reason: "" },
  { name: "Video Games", breadcrumb: "Video Games & Consoles > Video Games", categoryId: "139973", confidence: 0, reason: "" },
  { name: "Home & Garden", breadcrumb: "Home & Garden", categoryId: "11700", confidence: 0, reason: "" },
  { name: "Clothing, Shoes & Accessories", breadcrumb: "Clothing, Shoes & Accessories", categoryId: "11450", confidence: 0, reason: "" },
  { name: "Sporting Goods", breadcrumb: "Sporting Goods", categoryId: "888", confidence: 0, reason: "" },
  { name: "Toys & Hobbies", breadcrumb: "Toys & Hobbies", categoryId: "220", confidence: 0, reason: "" },
  { name: "Health & Beauty", breadcrumb: "Health & Beauty", categoryId: "26395", confidence: 0, reason: "" },
  { name: "Auto Parts & Accessories", breadcrumb: "eBay Motors > Parts & Accessories", categoryId: "6000", confidence: 0, reason: "" },
  { name: "Tools & Workshop Equipment", breadcrumb: "Home Improvement > Tools & Workshop Equipment", categoryId: "631", confidence: 0, reason: "" },
  { name: "Kitchen & Dining", breadcrumb: "Home & Garden > Kitchen, Dining & Bar", categoryId: "20625", confidence: 0, reason: "" },
  { name: "Office Products", breadcrumb: "Business & Industrial > Office", categoryId: "2196", confidence: 0, reason: "" },
  { name: "Baby Products", breadcrumb: "Baby > Baby Gear", categoryId: "2984", confidence: 0, reason: "" },
  { name: "Pet Supplies", breadcrumb: "Pet Supplies", categoryId: "1281", confidence: 0, reason: "" },
  { name: "Musical Instruments", breadcrumb: "Musical Instruments & Gear", categoryId: "619", confidence: 0, reason: "" },
  { name: "Camera & Photo", breadcrumb: "Cameras & Photo", categoryId: "625", confidence: 0, reason: "" },
  { name: "Computer Components", breadcrumb: "Computers/Tablets & Networking > Computer Components", categoryId: "175673", confidence: 0, reason: "" },
];

export async function suggestCategories(title: string, description: string): Promise<CategorySuggestion[]> {
  if (!openai) {
    // Template: keyword matching
    const text = (title + " " + description).toLowerCase();
    const keywordMap: Record<string, string[]> = {
      "9355": ["phone", "smartphone", "iphone", "android", "samsung", "pixel"],
      "177": ["laptop", "notebook", "macbook", "chromebook", "thinkpad"],
      "171485": ["tablet", "ipad", "kindle", "ereader"],
      "178893": ["smartwatch", "apple watch", "fitbit", "garmin", "watch"],
      "293": ["tv", "television", "speaker", "headphone", "earphone", "audio", "bluetooth"],
      "139973": ["game", "playstation", "xbox", "nintendo", "ps5", "ps4"],
      "625": ["camera", "lens", "dslr", "mirrorless", "gopro", "tripod"],
      "175673": ["gpu", "cpu", "ram", "ssd", "motherboard", "graphics card", "processor"],
      "631": ["drill", "saw", "wrench", "screwdriver", "tool", "hammer"],
      "20625": ["kitchen", "cookware", "pan", "pot", "knife", "blender", "coffee"],
      "1281": ["dog", "cat", "pet", "collar", "leash", "aquarium", "bird"],
      "11450": ["shirt", "pants", "dress", "shoes", "jacket", "sneakers", "clothing"],
      "888": ["bike", "bicycle", "fishing", "camping", "yoga", "gym", "weights"],
      "2984": ["baby", "stroller", "diaper", "infant", "toddler", "toy"],
      "26395": ["supplement", "vitamin", "skincare", "hair", "makeup", "beauty"],
    };

    const scores: { cat: CategorySuggestion; score: number }[] = CATEGORY_DATABASE.map(cat => {
      const catKeywords = keywordMap[cat.categoryId] || [];
      let score = catKeywords.filter(k => text.includes(k)).length * 30;
      if (score > 0) score = Math.min(score + 40 + Math.random() * 15, 99);
      else score = Math.random() * 25 + 10;
      return { cat: { ...cat, confidence: Math.round(score), reason: `Matched ${catKeywords.filter(k => text.includes(k)).join(", ") || "general category"}` }, score };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.cat);
  }

  try {
    const prompt = `You are an eBay category expert. Suggest the top 5 best eBay categories for this product.

Title: "${title}"
Description excerpt: "${description.slice(0, 800)}"

Return a JSON array of 5 categories:
[{
  "name": "<category name>",
  "breadcrumb": "<Top Level > Sub Level > Leaf>",
  "categoryId": "<eBay numeric category ID>",
  "confidence": <0-100>,
  "reason": "<one sentence why>"
}]

Return only the JSON array, no markdown.`;

    const completion = await openai.chat.completions.create({
      model: MODELS[0],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const text2 = completion.choices[0]?.message?.content?.trim() || "[]";
    const jsonStr = text2.startsWith("[") ? text2 : text2.match(/\[[\s\S]*\]/)?.[0] || "[]";
    return JSON.parse(jsonStr) as CategorySuggestion[];
  } catch (err) {
    console.warn("Category suggestion AI failed:", err);
    return CATEGORY_DATABASE.slice(0, 5).map(c => ({ ...c, confidence: 50, reason: "General match" }));
  }
}

// ─── Supplier Match Scorer ────────────────────────────────────────────────────

export interface SupplierMatchScore {
  score: number;
  reason: string;
}

export async function scoreSupplierMatch(
  targetQuery: string,
  result: { title: string; price: number; rating?: number; reviewCount?: number; platform: string }
): Promise<SupplierMatchScore> {
  if (openai) {
    try {
      const prompt = `You are a dropshipping expert evaluating supplier products for eBay resale.

Target search: "${targetQuery}"
Supplier product: "${result.title}" at $${result.price} on ${result.platform}
Rating: ${result.rating || "N/A"}, Reviews: ${result.reviewCount || 0}

Score this product as a supplier match (0-100) considering:
- Title relevance to search query (40%)
- Price attractiveness for eBay resale (25%)  
- Seller reputation/reviews (20%)
- Platform reliability (15%)

Output JSON: {"score": 75, "reason": "one sentence explanation"}`;
      const content = await callAI(prompt);
      if (content) {
        const parsed = JSON.parse(content);
        if (typeof parsed.score === "number") return parsed as SupplierMatchScore;
      }
    } catch {}
  }

  // Rule-based fallback
  const targetWords = targetQuery.toLowerCase().split(/\s+/);
  const titleWords = result.title.toLowerCase().split(/\s+/);
  const matchedWords = targetWords.filter(w => w.length > 2 && titleWords.some(t => t.includes(w)));
  const relevanceScore = Math.min((matchedWords.length / Math.max(targetWords.length, 1)) * 40, 40);

  const priceScore = result.price > 0 && result.price < 50 ? 25 : result.price < 100 ? 18 : 10;
  const ratingScore = result.rating ? Math.min((result.rating / 5) * 15, 15) : 8;
  const reviewScore = result.reviewCount ? Math.min(Math.log10(result.reviewCount + 1) * 5, 10) : 3;
  const platformScore = result.platform === "aliexpress" ? 10 : result.platform === "amazon" ? 8 : 7;

  const score = Math.round(relevanceScore + priceScore + ratingScore + reviewScore + platformScore);
  const reason =
    score >= 75 ? `Strong match — title closely aligns with query and pricing is competitive for eBay resale`
    : score >= 55 ? `Good match — product is relevant with reasonable pricing and supplier reputation`
    : score >= 35 ? `Moderate match — some keyword overlap but pricing or reviews could be stronger`
    : `Weak match — limited relevance to target product or unfavorable pricing`;

  return { score: Math.min(score, 100), reason };
}

// ─── Min Sale Price Suggester ─────────────────────────────────────────────────

export interface MinSalePriceAdvice {
  minSalePrice: number;
  suggestedSalePrice: number;
  reason: string;
}

export async function suggestMinSalePrice(
  cost: number,
  targetMarginPct: number,
  category: string
): Promise<MinSalePriceAdvice> {
  // eBay fee estimate: ~12.9% FVF + 2.87% + $0.30 payment + $0.35 insertion
  const ebayFeeRate = 0.1577; // combined effective rate
  const fixedFees = 0.65;

  // Solve: price - cost - (price * ebayFeeRate) - fixedFees >= price * (targetMarginPct/100)
  // price * (1 - ebayFeeRate - targetMarginPct/100) = cost + fixedFees
  const divisor = 1 - ebayFeeRate - (targetMarginPct / 100);
  const minSalePrice = divisor > 0 ? (cost + fixedFees) / divisor : cost * 2;
  const suggestedSalePrice = minSalePrice * 1.1; // 10% buffer above minimum

  if (openai) {
    try {
      const prompt = `You are an eBay pricing expert.

Item cost: $${cost.toFixed(2)}
Category: ${category}
Target margin: ${targetMarginPct}%
Calculated minimum sale price: $${minSalePrice.toFixed(2)}

Provide brief pricing advice. Output JSON: {"reason": "one sentence advice"}`;
      const content = await callAI(prompt);
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.reason) {
          return {
            minSalePrice: Math.round(minSalePrice * 100) / 100,
            suggestedSalePrice: Math.round(suggestedSalePrice * 100) / 100,
            reason: parsed.reason,
          };
        }
      }
    } catch {}
  }

  return {
    minSalePrice: Math.round(minSalePrice * 100) / 100,
    suggestedSalePrice: Math.round(suggestedSalePrice * 100) / 100,
    reason: `At $${minSalePrice.toFixed(2)} you break even after all eBay fees. Price at $${suggestedSalePrice.toFixed(2)} for your ${targetMarginPct}% target margin.`,
  };
}

// ─── Lifestyle Image Prompts ──────────────────────────────────────────────────

export async function generateLifestylePrompts(productTitle: string, description: string): Promise<string[]> {
  if (!openai) {
    const productWord = productTitle.split(" ").slice(0, 3).join(" ");
    return [
      `${productWord} on a clean white marble surface with natural window light, product photography`,
      `${productWord} in a lifestyle setting with a person using it, warm ambient lighting, editorial style`,
      `${productWord} flat lay with complementary accessories on a textured wooden background`,
    ];
  }

  try {
    const prompt = `Generate 3 Stable Diffusion lifestyle image prompts for this eBay product.
Product: ${productTitle}
Description: ${description.slice(0, 500)}

Each prompt should describe a different lifestyle photography scenario. Keep each under 150 chars.
Return a JSON array of 3 strings: ["<prompt1>", "<prompt2>", "<prompt3>"]
No markdown.`;

    const completion = await openai.chat.completions.create({
      model: MODELS[0],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const text2 = completion.choices[0]?.message?.content?.trim() || "[]";
    const jsonStr = text2.startsWith("[") ? text2 : text2.match(/\[[\s\S]*\]/)?.[0] || "[]";
    return JSON.parse(jsonStr) as string[];
  } catch (err) {
    console.warn("Lifestyle prompts AI failed:", err);
    const productWord = productTitle.split(" ").slice(0, 3).join(" ");
    return [
      `${productWord} on white marble surface with natural lighting, product photography, clean minimal`,
      `${productWord} lifestyle setting with ambient warm light, editorial photography, person using it`,
      `${productWord} flat lay composition, textured background, complementary items arranged around`,
    ];
  }
}
