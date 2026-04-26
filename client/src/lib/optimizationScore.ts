// ─── Client-side eBay Listing Optimization Scorer ────────────────────────────
// Mirrors the server-side scoreFullListing logic for instant client computation.

export interface ScoreDimension {
  name: string;
  score: number;
  max: number;
  detail: string;
  weight: number;
}

export interface ListingOptimizationScore {
  overall: number;
  grade: "A+" | "A" | "B+" | "B" | "C" | "D";
  rankingConfidence: "Very Likely" | "Likely" | "Moderate" | "Needs Work";
  rankingConfidenceColor: "green" | "blue" | "yellow" | "red";
  dimensions: ScoreDimension[];
  suggestions: string[];
  delta?: number;
}

const CASSINI_KEYWORDS = [
  "new","sealed","oem","genuine","original","authentic","kit","bundle","lot","set",
  "inch","mm","cm","lb","oz","gb","tb","mhz","wireless","bluetooth","usb","hdmi",
  "4k","1080p","rechargeable","waterproof","pro","max","plus","mini","xl","pack",
];

const FORBIDDEN_WORDS = [
  "free shipping","sale","new arrival","best","wow","amazing","see description",
  "check","click","buy now","visit store","cheap","lowest price","hot","must have",
  "limited","bargain","deal","offer",
];

function scoreTitle(title: string) {
  const len = title.length;
  const lower = title.toLowerCase();
  const words = lower.split(/\s+/);
  const firstThree = words.slice(0, 3).join(" ");

  const lenScore = len >= 70 ? 25 : len >= 60 ? 22 : len >= 50 ? 17 : len >= 40 ? 12 : len >= 25 ? 7 : 3;
  const hasKeywordFront = CASSINI_KEYWORDS.some(k => firstThree.includes(k));
  const keywordCount = CASSINI_KEYWORDS.filter(k => lower.includes(k)).length;
  const kwScore = Math.min((hasKeywordFront ? 15 : 0) + Math.min(keywordCount * 5, 20), 25);
  const hasNumbers = /\d/.test(title);
  const hasUnits = /\b(mm|cm|inch|gb|tb|mb|lb|oz|ft|kg|mhz|ghz|w\b)/i.test(title);
  const specScore = Math.min((hasNumbers ? 10 : 0) + (hasUnits ? 15 : 0), 20);
  const foundForbidden = FORBIDDEN_WORDS.filter(w => lower.includes(w));
  const forbiddenScore = Math.max(15 - foundForbidden.length * 8, 0);
  const conditionWords = ["new","used","refurbished","open box","pre-owned","for parts"];
  const hasCondition = conditionWords.some(c => lower.includes(c));
  const condScore = hasCondition ? 15 : 3;
  const total = Math.min(lenScore + kwScore + specScore + forbiddenScore + condScore, 100);

  const suggestions: string[] = [];
  if (len < 55) suggestions.push(`Title only ${len} chars — aim for 60–68 for best Cassini ranking`);
  if (len > 80) suggestions.push("Title exceeds 80 chars — eBay will truncate in search results");
  if (!hasKeywordFront) suggestions.push("Move primary keyword to first 3 words for better ranking");
  if (!hasNumbers && !hasUnits) suggestions.push("Add model numbers or measurements to improve CTR");
  if (!hasCondition) suggestions.push('Include a condition word like "New" for buyer trust');
  if (foundForbidden.length > 0) suggestions.push(`Remove promotional words: ${foundForbidden.join(", ")}`);

  return { score: total, suggestions, detail: `${len} chars · ${keywordCount} eBay keywords${foundForbidden.length ? ` · ${foundForbidden.length} forbidden` : ""}` };
}

function scoreDescription(html: string) {
  const suggestions: string[] = [];
  let score = 0;
  const hasH2 = /<h[12]/i.test(html);
  const hasBullets = /<ul|<li/i.test(html);
  const hasTable = /<table/i.test(html);
  const hasInlineStyle = /style=/i.test(html);
  const hasMobileWidth = /max-width/i.test(html);
  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (hasH2) score += 15; else suggestions.push("Add H2 headings for structure");
  if (hasBullets) score += 25; else suggestions.push("Add a bullet feature list (buyers scan, not read)");
  if (hasTable) score += 25; else suggestions.push("Add an item specifics table to build buyer trust");
  if (hasInlineStyle) score += 15; else suggestions.push("Use inline CSS — eBay strips external stylesheets");
  if (hasMobileWidth) score += 10; else suggestions.push("Set max-width for mobile buyer compatibility");
  if (wordCount >= 100) score += 10; else suggestions.push("Description too short — add more detail");
  return {
    score: Math.min(score, 100),
    detail: `~${wordCount} words · ${[hasH2 && "headings", hasBullets && "bullets", hasTable && "specs table"].filter(Boolean).join(", ") || "plain text"}`,
    suggestions,
  };
}

function scoreImages(count: number) {
  const score = count >= 12 ? 100 : count >= 8 ? 85 : count >= 5 ? 70 : count >= 3 ? 50 : count >= 1 ? 30 : 0;
  const suggestions: string[] = [];
  if (count < 3) suggestions.push("Add at least 3 images for buyer confidence");
  else if (count < 8) suggestions.push(`Add ${8 - count} more images — more images = more clicks`);
  return {
    score,
    detail: `${count} image${count !== 1 ? "s" : ""} · ${count >= 8 ? "Excellent" : count >= 5 ? "Good" : count >= 3 ? "Fair" : "Poor"}`,
    suggestions,
  };
}

function scoreSpecifics(specifics: { name?: string; key?: string; value: string }[]) {
  const count = specifics?.length || 0;
  const keys = specifics.map(s => (s.name || s.key || "").toLowerCase());
  const hasCondition = keys.some(k => k === "condition");
  const hasBrand = keys.some(k => k === "brand");
  const hasMPN = keys.some(k => k.includes("model") || k.includes("mpn"));
  const suggestions: string[] = [];
  let score = Math.min(count * 12, 60);
  if (hasCondition) score += 15; else suggestions.push('Add "Condition" to item specifics');
  if (hasBrand) score += 15; else suggestions.push('Add "Brand" to item specifics');
  if (hasMPN) score += 10; else suggestions.push("Add Model Number or MPN for search visibility");
  if (count < 4) suggestions.push("Add more item specifics — eBay recommends at least 5");
  return {
    score: Math.min(score, 100),
    detail: `${count} field${count !== 1 ? "s" : ""} · ${[hasCondition && "Condition", hasBrand && "Brand", hasMPN && "MPN"].filter(Boolean).join(", ") || "incomplete"}`,
    suggestions,
  };
}

export function computeListingScore(params: {
  title: string;
  htmlDescription?: string;
  itemSpecifics?: { name?: string; key?: string; value: string }[];
  imageCount?: number;
  rawTitle?: string;
}): ListingOptimizationScore {
  const titleResult = scoreTitle(params.title || "");
  const descResult = scoreDescription(params.htmlDescription || "");
  const imagesResult = scoreImages(params.imageCount ?? 0);
  const specificsResult = scoreSpecifics(params.itemSpecifics || []);

  const overall = Math.round(
    titleResult.score * 0.35 +
    descResult.score * 0.30 +
    specificsResult.score * 0.20 +
    imagesResult.score * 0.15
  );

  const grade: ListingOptimizationScore["grade"] =
    overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 70 ? "B+" :
    overall >= 60 ? "B" : overall >= 45 ? "C" : "D";

  const rankingConfidence: ListingOptimizationScore["rankingConfidence"] =
    overall >= 80 ? "Very Likely" : overall >= 65 ? "Likely" :
    overall >= 45 ? "Moderate" : "Needs Work";

  const rankingConfidenceColor: ListingOptimizationScore["rankingConfidenceColor"] =
    overall >= 80 ? "green" : overall >= 65 ? "blue" :
    overall >= 45 ? "yellow" : "red";

  const dimensions: ScoreDimension[] = [
    { name: "Title Optimization", score: titleResult.score, max: 100, detail: titleResult.detail, weight: 35 },
    { name: "Description Quality", score: descResult.score, max: 100, detail: descResult.detail, weight: 30 },
    { name: "Item Specifics", score: specificsResult.score, max: 100, detail: specificsResult.detail, weight: 20 },
    { name: "Image Coverage", score: imagesResult.score, max: 100, detail: imagesResult.detail, weight: 15 },
  ];

  const allSuggestions = [
    ...titleResult.suggestions,
    ...descResult.suggestions,
    ...specificsResult.suggestions,
    ...imagesResult.suggestions,
  ].slice(0, 6);

  let delta: number | undefined;
  if (params.rawTitle && params.rawTitle !== params.title) {
    const rawScore = scoreTitle(params.rawTitle).score;
    delta = titleResult.score - rawScore;
  }

  return { overall, grade, rankingConfidence, rankingConfidenceColor, dimensions, suggestions: allSuggestions, delta };
}
