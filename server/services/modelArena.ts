// ─── AIBAY Model Arena ───────────────────────────────────────────────────────
// LMArena-style: runs multiple AI models in parallel and scores their outputs.
// Free-tier models (suffix :free) use OpenRouter's no-credit free tier.

import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://aibay.app";
const SITE_NAME = "AIBAY — eBay Intelligence Platform";

// ─── Model Registry ───────────────────────────────────────────────────────────
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  free: boolean;
  contextK: number;
  strengths: string[];
  speed: "fast" | "medium" | "slow";
  recommended?: boolean;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    free: true,
    contextK: 1000,
    strengths: ["eBay titles", "structured output", "fast"],
    speed: "fast",
    recommended: true,
  },
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B",
    provider: "Google",
    free: true,
    contextK: 8,
    strengths: ["detailed descriptions", "SEO copy"],
    speed: "medium",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    free: true,
    contextK: 128,
    strengths: ["natural language", "long descriptions"],
    speed: "medium",
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    free: true,
    contextK: 64,
    strengths: ["logical reasoning", "keyword analysis"],
    speed: "slow",
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B",
    provider: "Mistral AI",
    free: true,
    contextK: 32,
    strengths: ["concise titles", "fast output"],
    speed: "fast",
  },
  {
    id: "qwen/qwen-2.5-72b-instruct:free",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    free: true,
    contextK: 128,
    strengths: ["e-commerce copy", "Asian market"],
    speed: "medium",
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-405b:free",
    name: "Hermes 3 405B",
    provider: "Nous Research",
    free: true,
    contextK: 128,
    strengths: ["creative copy", "structured data"],
    speed: "slow",
  },
  {
    id: "google/gemini-2.0-pro-exp-02-05:free",
    name: "Gemini 2.0 Pro",
    provider: "Google",
    free: true,
    contextK: 2000,
    strengths: ["best quality", "professional listings"],
    speed: "slow",
    recommended: true,
  },
  // Premium models (require credits)
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    free: false,
    contextK: 200,
    strengths: ["highest quality", "persuasive copy", "eBay SEO"],
    speed: "medium",
    recommended: true,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    free: false,
    contextK: 128,
    strengths: ["reliable output", "structured JSON", "titles"],
    speed: "fast",
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash (Pro)",
    provider: "Google",
    free: false,
    contextK: 1000,
    strengths: ["speed + quality", "multimodal"],
    speed: "fast",
  },
];

// ─── Optimization Scorer ──────────────────────────────────────────────────────

export interface OptimizationDimension {
  name: string;
  score: number;
  max: number;
  detail: string;
}

export interface OptimizationScore {
  overall: number;
  grade: "A+" | "A" | "B+" | "B" | "C" | "D";
  rankingConfidence: "Very Likely" | "Likely" | "Moderate" | "Needs Work";
  rankingConfidenceColor: "green" | "blue" | "yellow" | "red";
  dimensions: OptimizationDimension[];
  suggestions: string[];
  delta?: number; // improvement over raw (if before/after provided)
}

const FORBIDDEN_WORDS = [
  "free shipping", "sale", "new arrival", "best", "wow", "amazing", "see description",
  "check", "click", "buy now", "visit store", "cheap", "lowest price", "hot",
  "must have", "limited", "bargain", "deal", "offer",
];

const CASSINI_KEYWORDS = [
  "new", "sealed", "oem", "genuine", "original", "authentic", "kit", "bundle",
  "lot", "set", "inch", "mm", "cm", "lb", "oz", "gb", "tb", "mhz",
  "wireless", "bluetooth", "usb", "hdmi", "4k", "1080p", "rechargeable",
  "waterproof", "pro", "max", "plus", "mini", "xl", "pack",
];

function scoreTitleDimension(title: string): OptimizationDimension & { suggestions: string[] } {
  const len = title.length;
  const lower = title.toLowerCase();
  const words = lower.split(/\s+/);
  const firstThree = words.slice(0, 3).join(" ");

  // Length: 60-80 ideal
  let lenScore = len >= 70 ? 25 : len >= 60 ? 22 : len >= 50 ? 17 : len >= 40 ? 12 : len >= 25 ? 7 : 3;

  // Keyword front-loaded
  const hasKeywordFront = CASSINI_KEYWORDS.some(k => firstThree.includes(k));
  const keywordCount = CASSINI_KEYWORDS.filter(k => lower.includes(k)).length;
  let kwScore = (hasKeywordFront ? 15 : 0) + Math.min(keywordCount * 5, 20);
  kwScore = Math.min(kwScore, 25);

  // Numbers / specificity
  const hasNumbers = /\d/.test(title);
  const hasUnits = /\b(mm|cm|inch|gb|tb|mb|lb|oz|ft|kg|mhz|ghz|w\b)/i.test(title);
  const specScore = Math.min((hasNumbers ? 10 : 0) + (hasUnits ? 15 : 0), 20);

  // Forbidden words
  const foundForbidden = FORBIDDEN_WORDS.filter(w => lower.includes(w));
  const forbiddenScore = Math.max(15 - foundForbidden.length * 8, 0);

  // Condition word
  const conditionWords = ["new", "used", "refurbished", "open box", "pre-owned", "for parts"];
  const hasCondition = conditionWords.some(c => lower.includes(c));
  const condScore = hasCondition ? 15 : 3;

  const totalScore = Math.min(lenScore + kwScore + specScore + forbiddenScore + condScore, 100);

  const suggestions: string[] = [];
  if (len < 55) suggestions.push(`Title only ${len} chars — aim for 60–68`);
  if (len > 80) suggestions.push("Title exceeds 80 chars — eBay will truncate it");
  if (!hasKeywordFront) suggestions.push("Move primary keyword to first 3 words for Cassini ranking");
  if (!hasNumbers && !hasUnits) suggestions.push("Add measurements/model numbers to increase CTR");
  if (!hasCondition) suggestions.push('Include condition word like "New" for buyer confidence');
  if (foundForbidden.length > 0) suggestions.push(`Remove forbidden words: ${foundForbidden.join(", ")}`);

  return {
    name: "Title Optimization",
    score: totalScore,
    max: 100,
    detail: `${len} chars · ${keywordCount} Cassini keywords${foundForbidden.length ? ` · ${foundForbidden.length} forbidden word(s)` : ""}`,
    suggestions,
  };
}

function scoreDescriptionDimension(html: string): OptimizationDimension & { suggestions: string[] } {
  const lower = html.toLowerCase();
  const suggestions: string[] = [];
  let score = 0;

  // Has professional structure
  const hasH1orH2 = /<h[12]/i.test(html);
  const hasUl = /<ul|<li/i.test(html);
  const hasTable = /<table/i.test(html);
  const hasInlineStyle = /style=/i.test(html);
  const hasGradient = /gradient/i.test(html);
  const hasGrid = /display:\s*grid/i.test(html);

  if (hasH1orH2) score += 15; else suggestions.push("Add H1/H2 headings to description for structure");
  if (hasUl) score += 20; else suggestions.push("Add bullet point feature list for scannability");
  if (hasTable) score += 20; else suggestions.push("Add item specifics table for buyer trust");
  if (hasInlineStyle) score += 15; else suggestions.push("Use inline CSS for eBay compatibility");
  if (hasGradient) score += 10;
  if (hasGrid) score += 10;

  // Mobile-responsive max-width
  const hasMobileResponsive = /max-width/i.test(html);
  if (hasMobileResponsive) score += 10; else suggestions.push("Add max-width for mobile responsiveness");

  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (wordCount >= 100) score += 10; else if (wordCount < 50) suggestions.push("Description too short — add more product details");

  return {
    name: "Description Quality",
    score: Math.min(score, 100),
    max: 100,
    detail: `~${wordCount} words · ${[hasH1orH2 && "headings", hasUl && "bullets", hasTable && "specs table", hasMobileResponsive && "mobile-ready"].filter(Boolean).join(", ") || "basic"}`,
    suggestions,
  };
}

function scoreItemSpecifics(specifics: { key: string; value: string }[]): OptimizationDimension & { suggestions: string[] } {
  const count = specifics?.length || 0;
  const hasCondition = specifics?.some(s => s.key.toLowerCase() === "condition");
  const hasBrand = specifics?.some(s => s.key.toLowerCase() === "brand");
  const hasMPN = specifics?.some(s => s.key.toLowerCase().includes("model") || s.key.toLowerCase().includes("mpn"));
  const suggestions: string[] = [];

  let score = Math.min(count * 12, 60);
  if (hasCondition) score += 15; else suggestions.push('Add "Condition" to item specifics');
  if (hasBrand) score += 15; else suggestions.push('Add "Brand" to item specifics');
  if (hasMPN) score += 10; else suggestions.push("Add Model Number/MPN for search visibility");
  if (count < 4) suggestions.push("Add more item specifics — eBay recommends at least 5");

  return {
    name: "Item Specifics",
    score: Math.min(score, 100),
    max: 100,
    detail: `${count} field${count !== 1 ? "s" : ""} · ${[hasCondition && "Condition", hasBrand && "Brand", hasMPN && "MPN"].filter(Boolean).join(", ") || "needs more"}`,
    suggestions,
  };
}

function scoreImages(imageCount: number): OptimizationDimension & { suggestions: string[] } {
  const suggestions: string[] = [];
  let score = 0;

  if (imageCount >= 12) score = 100;
  else if (imageCount >= 8) score = 85;
  else if (imageCount >= 5) score = 70;
  else if (imageCount >= 3) score = 50;
  else if (imageCount >= 1) score = 30;
  else { score = 0; suggestions.push("Add at least 1 product image"); }

  if (imageCount < 8) suggestions.push(`Add ${8 - imageCount} more images — eBay allows up to 24, more = more clicks`);
  if (imageCount < 3) suggestions.push("Minimum 3 images recommended for buyer confidence");

  return {
    name: "Image Coverage",
    score,
    max: 100,
    detail: `${imageCount} image${imageCount !== 1 ? "s" : ""} · ${imageCount >= 8 ? "Excellent" : imageCount >= 5 ? "Good" : imageCount >= 3 ? "Fair" : "Poor"}`,
    suggestions,
  };
}

export function scoreFullListing(params: {
  title: string;
  htmlDescription: string;
  itemSpecifics?: { key: string; value: string }[];
  imageCount?: number;
  rawTitle?: string;
}): OptimizationScore {
  const titleDim = scoreTitleDimension(params.title);
  const descDim = scoreDescriptionDimension(params.htmlDescription);
  const specsDim = scoreItemSpecifics(params.itemSpecifics || []);
  const imagesDim = scoreImages(params.imageCount ?? 0);

  const dimensions: OptimizationDimension[] = [titleDim, descDim, specsDim, imagesDim];

  // Weighted overall
  const overall = Math.round(
    titleDim.score * 0.35 +
    descDim.score * 0.30 +
    specsDim.score * 0.20 +
    imagesDim.score * 0.15
  );

  const grade: OptimizationScore["grade"] =
    overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 70 ? "B+" :
    overall >= 60 ? "B" : overall >= 45 ? "C" : "D";

  const rankingConfidence: OptimizationScore["rankingConfidence"] =
    overall >= 80 ? "Very Likely" : overall >= 65 ? "Likely" :
    overall >= 45 ? "Moderate" : "Needs Work";

  const rankingConfidenceColor: OptimizationScore["rankingConfidenceColor"] =
    overall >= 80 ? "green" : overall >= 65 ? "blue" :
    overall >= 45 ? "yellow" : "red";

  const allSuggestions = [
    ...titleDim.suggestions,
    ...descDim.suggestions,
    ...specsDim.suggestions,
    ...imagesDim.suggestions,
  ].slice(0, 6);

  // Delta vs raw title
  let delta: number | undefined;
  if (params.rawTitle && params.rawTitle !== params.title) {
    const rawScore = scoreTitleDimension(params.rawTitle).score;
    delta = titleDim.score - rawScore;
  }

  return { overall, grade, rankingConfidence, rankingConfidenceColor, dimensions, suggestions: allSuggestions, delta };
}

// ─── Arena Runner ─────────────────────────────────────────────────────────────

export interface ArenaEntry {
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

function buildArenaPrompt(productData: {
  title: string;
  description?: string;
  images?: string[];
  specs?: Record<string, string>;
}): string {
  return `You are an elite eBay listing copywriter with 10+ years experience optimizing for eBay's Cassini search algorithm.

PRODUCT DATA:
Title: ${productData.title}
Description: ${(productData.description || "").slice(0, 1500)}
${productData.specs ? `Specs: ${JSON.stringify(productData.specs).slice(0, 500)}` : ""}

YOUR TASK: Create a premium eBay listing optimized for maximum search visibility and conversion.

REQUIREMENTS:
1. TITLE: Exactly 60–68 characters (NEVER exceed 80). Front-load primary keyword. Include condition word (New/Used). No punctuation except hyphens. No promotional words (no "Best", "Amazing", "Free Shipping"). Include brand, model number, key specs.
2. HTML DESCRIPTION: Professional inline-styled HTML. Must include: gradient header with product title, bullet feature list (min 6 bullets), item specifics table (min 5 rows), "Why Buy From Us" grid (4 trust badges), shipping/returns section. Mobile-responsive with max-width:700px. Use #1e3a8a / #2563eb brand colors.

OUTPUT: Valid JSON only — no markdown, no code blocks:
{
  "title": "...",
  "html_description": "..."
}`;
}

async function callSingleModel(
  client: OpenAI,
  modelId: string,
  productData: { title: string; description?: string; images?: string[]; specs?: Record<string, string> }
): Promise<{ title: string; html_description: string }> {
  const prompt = buildArenaPrompt(productData);

  const completion = await client.chat.completions.create({
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 3000,
  });

  const content = completion.choices[0].message.content || "";
  const parsed = JSON.parse(content);

  if (!parsed.title || !parsed.html_description) {
    throw new Error("Model returned incomplete output");
  }

  return { title: parsed.title, html_description: parsed.html_description };
}

export async function runArena(params: {
  productData: { title: string; description?: string; images?: string[]; specs?: Record<string, string> };
  modelIds: string[];
  itemSpecifics?: { key: string; value: string }[];
  imageCount?: number;
}): Promise<ArenaEntry[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for Arena mode");
  }

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": SITE_URL,
      "X-Title": SITE_NAME,
    },
  });

  const modelsToRun = params.modelIds
    .map(id => MODEL_REGISTRY.find(m => m.id === id))
    .filter(Boolean) as ModelInfo[];

  // Run all models in parallel
  const results = await Promise.allSettled(
    modelsToRun.map(async (model): Promise<ArenaEntry> => {
      const start = Date.now();
      try {
        const output = await callSingleModel(client, model.id, params.productData);
        const latencyMs = Date.now() - start;

        const optimizationScore = scoreFullListing({
          title: output.title,
          htmlDescription: output.html_description,
          itemSpecifics: params.itemSpecifics,
          imageCount: params.imageCount,
          rawTitle: params.productData.title,
        });

        return {
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          free: model.free,
          title: output.title,
          htmlDescription: output.html_description,
          optimizationScore,
          latencyMs,
          status: "success",
        };
      } catch (err) {
        return {
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          free: model.free,
          title: "",
          htmlDescription: "",
          optimizationScore: scoreFullListing({ title: "", htmlDescription: "" }),
          latencyMs: Date.now() - start,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );

  const entries: ArenaEntry[] = results.map(r => {
    if (r.status === "fulfilled") return r.value;
    return {
      modelId: "unknown",
      modelName: "Unknown",
      provider: "Unknown",
      free: true,
      title: "",
      htmlDescription: "",
      optimizationScore: scoreFullListing({ title: "", htmlDescription: "" }),
      latencyMs: 0,
      status: "error" as const,
      errorMessage: r.reason?.message || "Failed",
    };
  });

  // Sort by optimization score (descending)
  const successEntries = entries.filter(e => e.status === "success");
  successEntries.sort((a, b) => b.optimizationScore.overall - a.optimizationScore.overall);

  // Mark the winner as recommended
  if (successEntries.length > 0) {
    successEntries[0].recommended = true;
  }

  const failedEntries = entries.filter(e => e.status === "error");
  return [...successEntries, ...failedEntries];
}

// ─── Auto-Pick Best ───────────────────────────────────────────────────────────
// Runs all free models and returns only the best result

export async function runFullAuto(productData: {
  title: string;
  description?: string;
  images?: string[];
  specs?: Record<string, string>;
}): Promise<ArenaEntry | null> {
  const freeModelIds = MODEL_REGISTRY.filter(m => m.free && m.speed !== "slow").map(m => m.id);

  const results = await runArena({
    productData,
    modelIds: freeModelIds.slice(0, 5), // Use top 5 fast free models
  });

  const winner = results.find(r => r.status === "success");
  return winner || null;
}
