import axios from "axios";
import * as cheerio from "cheerio";

const EBAY_API_BASE = "https://svcs.ebay.com/services/search/FindingService/v1";

// ─── Marketplace → Domain Map ──────────────────────────────────────────────────
const MARKETPLACE_DOMAINS: Record<string, string> = {
  "EBAY-US": "www.ebay.com",
  "EBAY-GB": "www.ebay.co.uk",
  "EBAY-AU": "www.ebay.com.au",
  "EBAY-DE": "www.ebay.de",
  "EBAY-CA": "www.ebay.ca",
  "EBAY-FR": "www.ebay.fr",
};

const RSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; RSS/2.0)",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
};

// ─── eBay RSS Feed Scraper (bypasses bot detection) ──────────────────────────
async function scrapeEbaySearch(
  keywords: string,
  options: {
    marketplace?: string;
    sold?: boolean;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    pageSize?: number;
  } = {}
): Promise<{ items: any[]; totalEntries: number }> {
  const domain = MARKETPLACE_DOMAINS[options.marketplace || "EBAY-US"] || "www.ebay.com";
  const pageSize = Math.min(options.pageSize || 50, 100);

  // Try RSS feed first — significantly less blocked than HTML scraping
  try {
    const qs = new URLSearchParams({
      _nkw: keywords,
      _rss: "1",
      _ipg: String(pageSize),
    });
    if (options.categoryId) qs.set("_sacat", options.categoryId);
    if (options.minPrice !== undefined) qs.set("_udlo", String(options.minPrice));
    if (options.maxPrice !== undefined) qs.set("_udhi", String(options.maxPrice));
    if (options.sold) { qs.set("LH_Sold", "1"); qs.set("LH_Complete", "1"); }

    const rssUrl = `https://${domain}/sch/i.html?${qs.toString()}`;
    const res = await axios.get(rssUrl, {
      timeout: 15000,
      headers: RSS_HEADERS,
      validateStatus: (s) => s < 500,
    });

    if (res.status === 200 && typeof res.data === "string" && res.data.includes("<rss")) {
      return parseEbayRss(res.data, options.sold ?? false, options.categoryId);
    }
  } catch (_rssErr) {
    // fall through to HTML attempt
  }

  // Fallback: HTML scrape with browser-like headers
  const qs2 = new URLSearchParams({
    _nkw: keywords,
    _sop: options.sold ? "13" : "12",
    _ipg: String(pageSize),
  });
  if (options.sold) { qs2.set("LH_Sold", "1"); qs2.set("LH_Complete", "1"); }
  if (options.categoryId) qs2.set("_sacat", options.categoryId);
  if (options.minPrice !== undefined) qs2.set("_udlo", String(options.minPrice));
  if (options.maxPrice !== undefined) qs2.set("_udhi", String(options.maxPrice));

  const htmlUrl = `https://${domain}/sch/i.html?${qs2.toString()}`;
  const res2 = await axios.get(htmlUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    },
    validateStatus: (s) => s < 600,
  });

  if (res2.status !== 200) {
    throw new Error(`eBay returned ${res2.status} — likely bot detection. Try again later.`);
  }

  const $ = cheerio.load(res2.data as string);
  const items: any[] = [];

  $("li.s-item").each((_, el) => {
    const title = $(el).find(".s-item__title").first().text().trim();
    if (!title || title.toLowerCase().includes("shop on ebay")) return;
    const rawPrice = $(el).find(".s-item__price").first().text().trim();
    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;
    const link = $(el).find("a.s-item__link").attr("href") || "";
    const itemId = link.match(/\/itm\/(\d+)/)?.[1] || `s-${items.length}`;
    const galleryUrl = ($(el).find(".s-item__image-img").attr("src") || $(el).find(".s-item__image-img").attr("data-src") || "").replace(/s-l\d+\./, "s-l500.");
    const condition = $(el).find(".SECONDARY_INFO, .s-item__condition").first().text().trim();
    const seller = $(el).find(".s-item__seller-info-text").text().trim();
    const freeShip = $(el).find(".s-item__logisticsCost, .s-item__freeXDays").first().text().toLowerCase().includes("free");
    items.push({ itemId, title, price, currency: "USD", galleryUrl, viewItemUrl: link, condition: condition || "New", conditionId: "1000", categoryId: options.categoryId || "", categoryName: "", sellerUsername: seller, sellerFeedback: 0, sellerPositivePercent: 0, watchCount: 0, listingType: "FixedPrice", startTime: "", endTime: "", location: "", shippingType: freeShip ? "Free" : "Calculated", isSold: options.sold ?? false });
  });

  const totalText = $(".srp-controls__count-heading, .listingscnt").first().text().replace(/,/g, "");
  const totalMatch = totalText.match(/[\d]+/);
  return { items, totalEntries: totalMatch ? parseInt(totalMatch[0]) : items.length };
}

// ─── Parse eBay RSS XML ────────────────────────────────────────────────────────
function parseEbayRss(xml: string, isSold: boolean, categoryId?: string): { items: any[]; totalEntries: number } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: any[] = [];

  $("item").each((idx, el) => {
    const title = $(el).find("title").first().text().trim();
    if (!title || title.toLowerCase().includes("shop on ebay") || title.toLowerCase().includes("results for")) return;

    const link = $(el).find("link").first().text().trim() || $(el).find("guid").text().trim();
    const itemId = link.match(/\/itm\/(\d+)/)?.[1] || `rss-${idx}`;

    const desc = $(el).find("description").first().text();
    const priceMatch = desc.match(/\$[\d,]+\.?\d*/);
    const rawPrice = priceMatch ? priceMatch[0] : "";
    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;

    const imgMatch = desc.match(/src="([^"]+)"/);
    const galleryUrl = imgMatch ? imgMatch[1].replace(/s-l\d+\./, "s-l500.") : "";

    items.push({
      itemId,
      title,
      price,
      currency: "USD",
      galleryUrl,
      viewItemUrl: link,
      condition: isSold ? "Used" : "New",
      conditionId: isSold ? "3000" : "1000",
      categoryId: categoryId || "",
      categoryName: "",
      sellerUsername: "",
      sellerFeedback: 0,
      sellerPositivePercent: 0,
      watchCount: 0,
      listingType: "FixedPrice",
      startTime: $(el).find("pubDate").text() || "",
      endTime: "",
      location: "",
      shippingType: "Calculated",
      isSold,
    });
  });

  return { items, totalEntries: items.length };
}

// ─── Demo Data Generator (used when eBay is unreachable) ─────────────────────
function generateDemoItems(keyword: string, count: number, isSold: boolean, categoryId?: string): any[] {
  const seed = keyword.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min: number, max: number, offset = 0) => {
    const x = Math.sin(seed + offset) * 10000;
    return min + ((x - Math.floor(x)) * (max - min));
  };

  const basePrice = Math.round(rng(15, 850, 1) * 100) / 100;
  const conditions = ["New", "Like New", "Very Good", "Good", "Acceptable"];
  const sellers = ["tech_deals_usa", "bargain_finds_co", "premium_seller88", "daily_deals_hub", "top_rated_store"];

  return Array.from({ length: count }, (_, i) => {
    const priceVariance = rng(0.75, 1.3, i + 10);
    const price = Math.round(basePrice * priceVariance * 100) / 100;
    const soldPrice = Math.round(price * rng(0.82, 0.97, i + 20) * 100) / 100;
    const condIdx = Math.floor(rng(0, conditions.length, i + 30));
    const sellerIdx = Math.floor(rng(0, sellers.length, i + 40));
    const watchCount = Math.floor(rng(0, 85, i + 50));
    return {
      itemId: `demo-${seed}-${i}`,
      title: `${keyword} - ${conditions[condIdx]} ${i % 3 === 0 ? "| Fast Shipping" : i % 3 === 1 ? "| Best Value" : "| Top Rated"}`,
      price: isSold ? soldPrice : price,
      currency: "USD",
      galleryUrl: `https://placehold.co/200x200/1a1a2e/ffffff?text=${encodeURIComponent(keyword.slice(0, 8))}`,
      viewItemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`,
      condition: conditions[condIdx],
      conditionId: condIdx === 0 ? "1000" : condIdx === 1 ? "1500" : "3000",
      categoryId: categoryId || "293",
      categoryName: "Electronics",
      sellerUsername: sellers[sellerIdx],
      sellerFeedback: Math.floor(rng(100, 15000, i + 60)),
      sellerPositivePercent: Math.round(rng(96, 100, i + 70) * 10) / 10,
      watchCount,
      listingType: "FixedPrice",
      startTime: new Date(Date.now() - rng(1, 30, i + 80) * 86400000).toISOString(),
      endTime: isSold ? new Date(Date.now() - rng(0, 7, i + 90) * 86400000).toISOString() : "",
      location: ["United States", "California, US", "New York, US", "Texas, US"][Math.floor(rng(0, 4, i + 95))],
      shippingType: i % 2 === 0 ? "Free" : "Calculated",
      isSold,
    };
  });
}

export function generateDemoSearchResult(keyword: string, isSold: boolean, pageSize = 20, categoryId?: string): EbaySearchResult {
  const items = generateDemoItems(keyword, pageSize, isSold, categoryId);
  const seed = keyword.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const totalEntries = Math.floor(200 + (seed % 800));
  return { items, totalEntries, totalPages: Math.ceil(totalEntries / pageSize), isDemo: true } as any;
}

// ─── Marketplace IDs ──────────────────────────────────────────────────────────
export const MARKETPLACES: Record<string, string> = {
  "EBAY-US": "United States",
  "EBAY-GB": "United Kingdom",
  "EBAY-AU": "Australia",
  "EBAY-DE": "Germany",
  "EBAY-CA": "Canada",
  "EBAY-FR": "France",
};

export type MarketplaceId = keyof typeof MARKETPLACES;

// ─── Static eBay Top-Level Categories ────────────────────────────────────────
export const EBAY_CATEGORIES = [
  { id: "293", name: "Consumer Electronics", emoji: "📱" },
  { id: "15032", name: "Cell Phones & Accessories", emoji: "📞" },
  { id: "58058", name: "Computers/Tablets & Networking", emoji: "💻" },
  { id: "625", name: "Cameras & Photo", emoji: "📷" },
  { id: "11450", name: "Clothing, Shoes & Accessories", emoji: "👗" },
  { id: "11700", name: "Home & Garden", emoji: "🏡" },
  { id: "281", name: "Jewelry & Watches", emoji: "💎" },
  { id: "382", name: "Sporting Goods", emoji: "⚽" },
  { id: "26395", name: "Health & Beauty", emoji: "💄" },
  { id: "1", name: "Collectibles", emoji: "🎭" },
  { id: "267", name: "Books", emoji: "📚" },
  { id: "220", name: "Toys & Hobbies", emoji: "🎮" },
  { id: "2984", name: "Baby", emoji: "🍼" },
  { id: "1281", name: "Pet Supplies", emoji: "🐾" },
  { id: "1249", name: "Video Games & Consoles", emoji: "🎯" },
  { id: "11233", name: "Music", emoji: "🎵" },
  { id: "11232", name: "DVDs & Movies", emoji: "🎬" },
  { id: "619", name: "Musical Instruments", emoji: "🎸" },
  { id: "12576", name: "Business & Industrial", emoji: "🏭" },
  { id: "45100", name: "Entertainment Memorabilia", emoji: "🏆" },
];

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any, ttlMs: number): void {
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── App ID Helper ────────────────────────────────────────────────────────────
export function getEbayAppId(): string | null {
  return process.env.EBAY_APP_ID || null;
}

export function requireEbayAppId(): string {
  const id = process.env.EBAY_APP_ID;
  if (!id) {
    throw new Error(
      "EBAY_APP_ID is not configured. Get a free key at https://developer.ebay.com — it's free and takes 2 minutes to set up."
    );
  }
  return id;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EbayItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  galleryUrl: string;
  viewItemUrl: string;
  condition: string;
  conditionId: string;
  categoryId: string;
  categoryName: string;
  sellerUsername: string;
  sellerFeedback: number;
  sellerPositivePercent: number;
  watchCount: number;
  listingType: string;
  startTime: string;
  endTime: string;
  location: string;
  shippingType: string;
  isSold?: boolean;
}

export interface EbaySearchResult {
  items: EbayItem[];
  totalEntries: number;
  totalPages: number;
}

export interface MarketAnalysis {
  keyword: string;
  marketplace: string;
  activeListings: number;
  soldListings: number;
  sellThroughRate: number;
  avgActivePrice: number;
  avgSoldPrice: number;
  minPrice: number;
  maxPrice: number;
  demandScore: number;
  competitionScore: number;
  opportunityScore: number;
  uniqueSellers: number;
  topListings: EbayItem[];
  soldListingsData: EbayItem[];
  priceHistogram: { range: string; count: number }[];
}

export interface SellerProfile {
  username: string;
  feedbackScore: number;
  positiveFeedbackPercent: number;
  totalListings: number;
  avgPrice: number;
  topCategories: { name: string; count: number }[];
  listings: EbayItem[];
  estimatedMonthlyRevenue: number;
}

// ─── Item Parser ──────────────────────────────────────────────────────────────
function parseItem(item: any): EbayItem {
  const price = parseFloat(
    item.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] ||
    item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.["__value__"] || "0"
  );
  const watchCount = parseInt(item.listingInfo?.[0]?.watchCount?.[0] || "0");

  return {
    itemId: item.itemId?.[0] || "",
    title: item.title?.[0] || "",
    price,
    currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "USD",
    galleryUrl: item.galleryURL?.[0] || "",
    viewItemUrl: item.viewItemURL?.[0] || "",
    condition: item.condition?.[0]?.conditionDisplayName?.[0] || "Not Specified",
    conditionId: item.condition?.[0]?.conditionId?.[0] || "0",
    categoryId: item.primaryCategory?.[0]?.categoryId?.[0] || "",
    categoryName: item.primaryCategory?.[0]?.categoryName?.[0] || "",
    sellerUsername: item.sellerInfo?.[0]?.sellerUserName?.[0] || "",
    sellerFeedback: parseInt(item.sellerInfo?.[0]?.feedbackScore?.[0] || "0"),
    sellerPositivePercent: parseFloat(item.sellerInfo?.[0]?.positiveFeedbackPercent?.[0] || "0"),
    watchCount,
    listingType: item.listingInfo?.[0]?.listingType?.[0] || "",
    startTime: item.listingInfo?.[0]?.startTime?.[0] || "",
    endTime: item.listingInfo?.[0]?.endTime?.[0] || "",
    location: item.location?.[0] || "",
    shippingType: item.shippingInfo?.[0]?.shippingType?.[0] || "",
    isSold: false,
  };
}

function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// ─── Find Active Listings ─────────────────────────────────────────────────────
export async function findItemsByKeywords(
  keywords: string,
  options: {
    marketplace?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    sortOrder?: string;
    pageSize?: number;
    pageNumber?: number;
  } = {}
): Promise<EbaySearchResult> {
  const appId = getEbayAppId();

  // ── Public scraping fallback when no API key configured ──
  if (!appId) {
    const cacheKey = `scrape:active:${options.marketplace}:${keywords}:${JSON.stringify(options)}`;
    const cached = getCached<EbaySearchResult>(cacheKey);
    if (cached) return cached;
    try {
      const scraped = await scrapeEbaySearch(keywords, { ...options, sold: false });
      const result: EbaySearchResult = { items: scraped.items as EbayItem[], totalEntries: scraped.totalEntries, totalPages: Math.ceil(scraped.totalEntries / (options.pageSize || 50)) };
      setCache(cacheKey, result, 5 * 60 * 1000);
      return result;
    } catch {
      return generateDemoSearchResult(keywords, false, options.pageSize || 20, options.categoryId);
    }
  }
  const marketplace = options.marketplace || "EBAY-US";
  const cacheKey = `active:${marketplace}:${keywords}:${JSON.stringify(options)}`;

  const cached = getCached<EbaySearchResult>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {
    "OPERATION-NAME": "findItemsByKeywords",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "Global-ID": marketplace,
    "keywords": keywords,
    "paginationInput.pageSize": String(options.pageSize || 20),
    "paginationInput.pageNumber": String(options.pageNumber || 1),
    "sortOrder": options.sortOrder || "BestMatch",
    "outputSelector(0)": "SellerInfo",
    "outputSelector(1)": "StoreInfo",
  };

  if (options.categoryId) params["categoryId"] = options.categoryId;

  let fi = 0;
  if (options.minPrice !== undefined) {
    params[`itemFilter(${fi}).name`] = "MinPrice";
    params[`itemFilter(${fi}).value`] = String(options.minPrice);
    params[`itemFilter(${fi}).paramName`] = "Currency";
    params[`itemFilter(${fi}).paramValue`] = "USD";
    fi++;
  }
  if (options.maxPrice !== undefined) {
    params[`itemFilter(${fi}).name`] = "MaxPrice";
    params[`itemFilter(${fi}).value`] = String(options.maxPrice);
    params[`itemFilter(${fi}).paramName`] = "Currency";
    params[`itemFilter(${fi}).paramValue`] = "USD";
    fi++;
  }
  if (options.condition) {
    params[`itemFilter(${fi}).name`] = "Condition";
    params[`itemFilter(${fi}).value`] = options.condition;
  }

  const url = `${EBAY_API_BASE}?${buildQueryString(params)}`;
  try {
    const response = await axios.get(url, { timeout: 15000 });
    const data = response.data;

    const resp = data["findItemsByKeywordsResponse"]?.[0];
    if (!resp) throw new Error("Invalid eBay API response structure");

    const ack = resp.ack?.[0];
    if (ack !== "Success" && ack !== "Warning") {
      const errMsg = resp.errorMessage?.[0]?.error?.[0]?.message?.[0] || "Unknown eBay API error";
      throw new Error(`eBay API error: ${errMsg}`);
    }

    const items: EbayItem[] = (resp.searchResult?.[0]?.item || []).map(parseItem);
    const totalEntries = parseInt(resp.paginationOutput?.[0]?.totalEntries?.[0] || "0");
    const totalPages = parseInt(resp.paginationOutput?.[0]?.totalPages?.[0] || "1");

    const result = { items, totalEntries, totalPages };
    setCache(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (apiErr: any) {
    console.warn(`[eBay] findItemsByKeywords API failed (${apiErr?.response?.status || apiErr?.message}), falling back to scraper`);
    try {
      const scraped = await scrapeEbaySearch(keywords, { marketplace, sold: false, categoryId: options.categoryId, minPrice: options.minPrice, maxPrice: options.maxPrice, pageSize: options.pageSize });
      const result: EbaySearchResult = { items: scraped.items as EbayItem[], totalEntries: scraped.totalEntries, totalPages: Math.ceil(scraped.totalEntries / (options.pageSize || 20)) };
      setCache(cacheKey, result, 5 * 60 * 1000);
      return result;
    } catch (scrapeErr: any) {
      console.warn(`[eBay] Scraper also failed (${scrapeErr?.message}), using demo data`);
      return generateDemoSearchResult(keywords, false, options.pageSize || 20, options.categoryId);
    }
  }
}

// ─── Time Range Utility ───────────────────────────────────────────────────────
function timeRangeToDate(timeRange?: string): string | null {
  if (!timeRange || timeRange === "all") return null;
  const days: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const d = days[timeRange];
  if (!d) return null;
  const dt = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
  return dt.toISOString();
}

// ─── Find Completed (Sold) Items ──────────────────────────────────────────────
export async function findCompletedItems(
  keywords: string,
  options: {
    marketplace?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    pageSize?: number;
    timeRange?: string;
  } = {}
): Promise<EbaySearchResult> {
  const appId = getEbayAppId();
  const marketplace = options.marketplace || "EBAY-US";
  const cacheKey = `completed:${marketplace}:${keywords}:${JSON.stringify(options)}`;

  // ── Public scraping fallback when no API key configured ──
  if (!appId) {
    const scrapeKey = `scrape:sold:${marketplace}:${keywords}:${JSON.stringify(options)}`;
    const cached = getCached<EbaySearchResult>(scrapeKey);
    if (cached) return cached;
    try {
      const scraped = await scrapeEbaySearch(keywords, { marketplace, sold: true, categoryId: options.categoryId, minPrice: options.minPrice, maxPrice: options.maxPrice, pageSize: options.pageSize });
      const result: EbaySearchResult = { items: scraped.items as EbayItem[], totalEntries: scraped.totalEntries, totalPages: Math.ceil(scraped.totalEntries / (options.pageSize || 50)) };
      setCache(scrapeKey, result, 5 * 60 * 1000);
      return result;
    } catch {
      return generateDemoSearchResult(keywords, true, options.pageSize || 50, options.categoryId);
    }
  }

  const cached = getCached<EbaySearchResult>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {
    "OPERATION-NAME": "findCompletedItems",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "Global-ID": marketplace,
    "keywords": keywords,
    "paginationInput.pageSize": String(options.pageSize || 50),
    "paginationInput.pageNumber": "1",
    "sortOrder": "EndTimeSoonest",
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "outputSelector(0)": "SellerInfo",
  };

  let fi = 1;
  if (options.categoryId) params["categoryId"] = options.categoryId;
  if (options.minPrice !== undefined) {
    params[`itemFilter(${fi}).name`] = "MinPrice";
    params[`itemFilter(${fi}).value`] = String(options.minPrice);
    fi++;
  }
  const endTimeFrom = timeRangeToDate(options.timeRange);
  if (endTimeFrom) {
    params[`itemFilter(${fi}).name`] = "EndTimeFrom";
    params[`itemFilter(${fi}).value`] = endTimeFrom;
    fi++;
  }

  // old single-filter block replaced above

  const url = `${EBAY_API_BASE}?${buildQueryString(params)}`;
  try {
    const response = await axios.get(url, { timeout: 15000 });
    const data = response.data;

    const resp = data["findCompletedItemsResponse"]?.[0];
    if (!resp) throw new Error("Invalid eBay API response");

    const items: EbayItem[] = (resp.searchResult?.[0]?.item || []).map((i: any) => ({
      ...parseItem(i),
      isSold: true,
    }));
    const totalEntries = parseInt(resp.paginationOutput?.[0]?.totalEntries?.[0] || "0");
    const totalPages = parseInt(resp.paginationOutput?.[0]?.totalPages?.[0] || "1");

    const result = { items, totalEntries, totalPages };
    setCache(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (apiErr: any) {
    console.warn(`[eBay] findCompletedItems API failed (${apiErr?.response?.status || apiErr?.message}), falling back to scraper`);
    try {
      const scraped = await scrapeEbaySearch(keywords, { marketplace, sold: true, categoryId: options.categoryId, minPrice: options.minPrice, maxPrice: options.maxPrice, pageSize: options.pageSize });
      const result: EbaySearchResult = { items: scraped.items as EbayItem[], totalEntries: scraped.totalEntries, totalPages: Math.ceil(scraped.totalEntries / (options.pageSize || 50)) };
      setCache(cacheKey, result, 5 * 60 * 1000);
      return result;
    } catch (scrapeErr: any) {
      console.warn(`[eBay] Scraper also failed (${scrapeErr?.message}), using demo data`);
      return generateDemoSearchResult(keywords, true, options.pageSize || 50, options.categoryId);
    }
  }
}

// ─── Full Market Analysis ─────────────────────────────────────────────────────
export async function getMarketAnalysis(
  keyword: string,
  options: { marketplace?: string; categoryId?: string; timeRange?: string } = {}
): Promise<MarketAnalysis> {
  const marketplace = options.marketplace || "EBAY-US";
  const cacheKey = `analysis:${marketplace}:${keyword}:${options.categoryId || ""}:${options.timeRange || "all"}`;

  const cached = getCached<MarketAnalysis>(cacheKey);
  if (cached) return cached;

  const [activeResult, soldResult] = await Promise.all([
    findItemsByKeywords(keyword, { marketplace, categoryId: options.categoryId, pageSize: 50 }),
    findCompletedItems(keyword, { marketplace, categoryId: options.categoryId, pageSize: 50, timeRange: options.timeRange }),
  ]);

  const activeItems = activeResult.items;
  const soldItems = soldResult.items;

  const activePrices = activeItems.map((i) => i.price).filter((p) => p > 0);
  const soldPrices = soldItems.map((i) => i.price).filter((p) => p > 0);

  const avgActivePrice = activePrices.length
    ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
    : 0;
  const avgSoldPrice = soldPrices.length
    ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length
    : 0;
  const allPrices = [...activePrices, ...soldPrices];
  const minPrice = allPrices.length ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : 0;

  const uniqueSellers = new Set(
    activeItems.map((i) => i.sellerUsername).filter(Boolean)
  ).size;

  const totalActive = activeResult.totalEntries || activeItems.length;
  const totalSold = soldResult.totalEntries || soldItems.length;

  const sellThroughRate =
    totalActive > 0 ? Math.min(100, Math.round((totalSold / (totalActive + totalSold)) * 100)) : 0;
  const demandScore = Math.min(100, Math.round(sellThroughRate * 1.2));
  const competitionScore = Math.min(100, uniqueSellers);
  const opportunityScore = Math.min(
    100,
    competitionScore === 0 ? 0 : Math.round((demandScore / (competitionScore / 10 + 1)) * 2)
  );

  const isDemo = !!(activeResult as any).isDemo || !!(soldResult as any).isDemo;

  const analysis: MarketAnalysis = {
    keyword,
    marketplace,
    activeListings: totalActive,
    soldListings: totalSold,
    sellThroughRate,
    avgActivePrice,
    avgSoldPrice,
    minPrice,
    maxPrice,
    demandScore,
    competitionScore,
    opportunityScore,
    uniqueSellers,
    topListings: activeItems.slice(0, 20),
    soldListingsData: soldItems.slice(0, 20),
    priceHistogram: buildPriceHistogram(allPrices),
    ...(isDemo ? { isDemo: true } : {}),
  };

  setCache(cacheKey, analysis, 5 * 60 * 1000);
  return analysis;
}

// ─── Price Histogram ──────────────────────────────────────────────────────────
function buildPriceHistogram(prices: number[]): { range: string; count: number }[] {
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return [{ range: `$${min.toFixed(0)}`, count: prices.length }];
  const bucketSize = (max - min) / 6;
  return Array.from({ length: 6 }, (_, i) => {
    const lo = min + i * bucketSize;
    const hi = min + (i + 1) * bucketSize;
    const count = prices.filter((p) => p >= lo && (i === 5 ? p <= hi : p < hi)).length;
    return { range: `$${lo.toFixed(0)}-$${hi.toFixed(0)}`, count };
  });
}

// ─── Trending Items ───────────────────────────────────────────────────────────
export interface TrendingItem extends EbayItem {
  trendDirection: "up" | "neutral" | "down";
  trendScore: number;
}

export async function getTrendingItems(
  categoryId?: string,
  marketplace: string = "EBAY-US",
  sortMode: string = "watchCount",
  timeRange: string = "all"
): Promise<TrendingItem[]> {
  const cacheKey = `trending:${marketplace}:${categoryId || "all"}:${sortMode}:${timeRange}`;
  const cached = getCached<TrendingItem[]>(cacheKey);
  if (cached) return cached;

  const appId = getEbayAppId();
  if (!appId) {
    const query = categoryId ? "" : "popular";
    const { items } = await scrapeEbaySearch(query, { marketplace, categoryId, sold: sortMode === "mostSold", pageSize: 40 });
    const trending = (items as EbayItem[]).map((it, i) => ({ ...it, trendDirection: (["up", "neutral", "down"] as const)[i % 3], trendScore: Math.max(10, 90 - i * 2) }));
    setCache(cacheKey, trending, 5 * 60 * 1000);
    return trending;
  }

  // Use completed items for "mostSold" sort, otherwise use active listings
  const isCompletedMode = sortMode === "mostSold";

  const params: Record<string, string> = {
    "OPERATION-NAME": isCompletedMode ? "findCompletedItems" : "findItemsAdvanced",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "Global-ID": marketplace,
    "paginationInput.pageSize": "50",
    "paginationInput.pageNumber": "1",
    "sortOrder": isCompletedMode ? "EndTimeSoonest" : "BestMatch",
    "outputSelector(0)": "SellerInfo",
  };

  let fi = 0;
  if (isCompletedMode) {
    params[`itemFilter(${fi}).name`] = "SoldItemsOnly";
    params[`itemFilter(${fi}).value`] = "true";
    fi++;
    const endTimeFrom = timeRangeToDate(timeRange);
    if (endTimeFrom) {
      params[`itemFilter(${fi}).name`] = "EndTimeFrom";
      params[`itemFilter(${fi}).value`] = endTimeFrom;
      fi++;
    }
  }

  if (categoryId) params["categoryId"] = categoryId;

  const url = `${EBAY_API_BASE}?${buildQueryString(params)}`;
  const response = await axios.get(url, { timeout: 15000 });
  const data = response.data;
  const respKey = isCompletedMode ? "findCompletedItemsResponse" : "findItemsAdvancedResponse";
  const resp = data[respKey]?.[0];

  const rawItems: EbayItem[] = (resp?.searchResult?.[0]?.item || []).map((i: any) => ({
    ...parseItem(i),
    isSold: isCompletedMode,
  }));

  // Add trend metrics
  const maxWatch = Math.max(...rawItems.map(i => i.watchCount), 1);
  const items: TrendingItem[] = rawItems.map(i => {
    const score = Math.round((i.watchCount / maxWatch) * 100);
    const trendDirection: "up" | "neutral" | "down" = score >= 60 ? "up" : score >= 25 ? "neutral" : "down";
    return { ...i, trendDirection, trendScore: score };
  });

  // Sort by requested mode
  if (sortMode === "watchCount") items.sort((a, b) => b.watchCount - a.watchCount);
  else if (sortMode === "priceIncrease") items.sort((a, b) => b.price - a.price);
  else if (sortMode === "mostSold") items.sort((a, b) => b.trendScore - a.trendScore);
  else if (sortMode === "priceLow") items.sort((a, b) => a.price - b.price);

  setCache(cacheKey, items, 60 * 1000); // 60-second TTL for trending freshness
  return items;
}

// ─── Turbo Scanner (uses completed/sold items for real sales-volume intelligence) ──
export async function turboScanCategory(
  categoryId: string,
  options: {
    marketplace?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
  } = {}
): Promise<{ items: EbayItem[]; totalEntries: number }> {
  const marketplace = options.marketplace || "EBAY-US";
  const appId = getEbayAppId();
  const cacheKey = `turbo:${marketplace}:${categoryId}:${JSON.stringify(options)}`;

  if (!appId) {
    const turboScrapeKey = `scrape:turbo:${marketplace}:${categoryId}:${JSON.stringify(options)}`;
    const cached = getCached<{ items: EbayItem[]; totalEntries: number }>(turboScrapeKey);
    if (cached) return cached;
    const { items, totalEntries } = await scrapeEbaySearch("*", { marketplace, sold: true, categoryId, minPrice: options.minPrice, maxPrice: options.maxPrice, pageSize: 50 });
    const result = { items: items as EbayItem[], totalEntries };
    setCache(turboScrapeKey, result, 5 * 60 * 1000);
    return result;
  }

  const cached = getCached<{ items: EbayItem[]; totalEntries: number }>(cacheKey);
  if (cached) return cached;

  function buildPage(page: number): Record<string, string> {
    const params: Record<string, string> = {
      "OPERATION-NAME": "findCompletedItems",
      "SECURITY-APPNAME": appId as string,
      "RESPONSE-DATA-FORMAT": "JSON",
      "Global-ID": marketplace,
      "categoryId": categoryId,
      "paginationInput.pageSize": "100",
      "paginationInput.pageNumber": String(page),
      "sortOrder": "EndTimeSoonest",
      "outputSelector(0)": "SellerInfo",
      "itemFilter(0).name": "SoldItemsOnly",
      "itemFilter(0).value": "true",
    };
    let fi = 1;
    if (options.minPrice !== undefined) {
      params[`itemFilter(${fi}).name`] = "MinPrice";
      params[`itemFilter(${fi}).value`] = String(options.minPrice);
      fi++;
    }
    if (options.maxPrice !== undefined) {
      params[`itemFilter(${fi}).name`] = "MaxPrice";
      params[`itemFilter(${fi}).value`] = String(options.maxPrice);
      fi++;
    }
    if (options.condition) {
      params[`itemFilter(${fi}).name`] = "Condition";
      params[`itemFilter(${fi}).value`] = options.condition;
    }
    return params;
  }

  // Fetch 2 pages in parallel = up to 200 completed/sold items
  const [r1, r2] = await Promise.allSettled([
    axios.get(`${EBAY_API_BASE}?${buildQueryString(buildPage(1))}`, { timeout: 20000 }),
    axios.get(`${EBAY_API_BASE}?${buildQueryString(buildPage(2))}`, { timeout: 20000 }),
  ]);

  let items: EbayItem[] = [];
  let totalEntries = 0;

  for (const r of [r1, r2]) {
    if (r.status === "fulfilled") {
      const resp = r.value.data["findCompletedItemsResponse"]?.[0];
      const pageItems: EbayItem[] = (resp?.searchResult?.[0]?.item || []).map((i: any) => ({
        ...parseItem(i),
        isSold: true,
      }));
      items.push(...pageItems);
      if (totalEntries === 0) {
        totalEntries = parseInt(resp?.paginationOutput?.[0]?.totalEntries?.[0] || "0");
      }
    }
  }

  // Sort by watchCount descending (most-watched sold items first)
  items.sort((a, b) => b.watchCount - a.watchCount);

  const result = { items, totalEntries };
  setCache(cacheKey, result, 5 * 60 * 1000);
  return result;
}

// ─── Seller Profile ───────────────────────────────────────────────────────────
export async function getSellerProfile(
  username: string,
  marketplace: string = "EBAY-US"
): Promise<SellerProfile> {
  const cacheKey = `seller:${marketplace}:${username}`;
  const cached = getCached<SellerProfile>(cacheKey);
  if (cached) return cached;

  const appId = getEbayAppId();
  if (!appId) throw new Error("Seller profile lookup requires an eBay App ID. Please add EBAY_APP_ID to your environment secrets.");

  // Try store first, fall back to seller filter
  let items: EbayItem[] = [];
  let totalEntries = 0;

  try {
    const storeParams: Record<string, string> = {
      "OPERATION-NAME": "findItemsIneBayStores",
      "SECURITY-APPNAME": appId,
      "RESPONSE-DATA-FORMAT": "JSON",
      "Global-ID": marketplace,
      "storeName": username,
      "paginationInput.pageSize": "50",
      "paginationInput.pageNumber": "1",
      "outputSelector(0)": "SellerInfo",
    };

    const storeUrl = `${EBAY_API_BASE}?${buildQueryString(storeParams)}`;
    const storeResponse = await axios.get(storeUrl, { timeout: 15000 });
    const storeResp = storeResponse.data["findItemsIneBayStoresResponse"]?.[0];
    items = (storeResp?.searchResult?.[0]?.item || []).map(parseItem);
    totalEntries = parseInt(storeResp?.paginationOutput?.[0]?.totalEntries?.[0] || "0");
  } catch (_) {}

  if (items.length === 0) {
    // Fallback: search by seller filter
    const advParams: Record<string, string> = {
      "OPERATION-NAME": "findItemsAdvanced",
      "SECURITY-APPNAME": appId,
      "RESPONSE-DATA-FORMAT": "JSON",
      "Global-ID": marketplace,
      "paginationInput.pageSize": "50",
      "itemFilter(0).name": "Seller",
      "itemFilter(0).value": username,
      "outputSelector(0)": "SellerInfo",
    };
    const advUrl = `${EBAY_API_BASE}?${buildQueryString(advParams)}`;
    try {
      const advResponse = await axios.get(advUrl, { timeout: 15000 });
      const advResp = advResponse.data["findItemsAdvancedResponse"]?.[0];
      items = (advResp?.searchResult?.[0]?.item || []).map(parseItem);
      totalEntries = parseInt(advResp?.paginationOutput?.[0]?.totalEntries?.[0] || "0");
    } catch (_) {}
  }

  const prices = items.map((i) => i.price).filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // Find the first item that belongs to the searched seller for feedback info
  const firstSeller = items.find((i) => i.sellerUsername?.toLowerCase() === username.toLowerCase()) ?? items[0];

  const categoryCounts: Record<string, number> = {};
  items.forEach((i) => {
    if (i.categoryName) {
      categoryCounts[i.categoryName] = (categoryCounts[i.categoryName] || 0) + 1;
    }
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const estimatedMonthlyRevenue = avgPrice * Math.min(totalEntries * 0.3, 50);

  const profile: SellerProfile = {
    username,
    feedbackScore: firstSeller?.sellerFeedback || 0,
    positiveFeedbackPercent: firstSeller?.sellerPositivePercent || 0,
    totalListings: totalEntries || items.length,
    avgPrice,
    topCategories,
    listings: items,
    estimatedMonthlyRevenue,
  };

  setCache(cacheKey, profile, 10 * 60 * 1000);
  return profile;
}

// ─── Seller Listings (paginated) ─────────────────────────────────────────────
export async function getSellerListings(
  username: string,
  page: number = 1,
  marketplace: string = "EBAY-US"
): Promise<{ items: EbayItem[]; totalEntries: number; totalPages: number }> {
  const appId = getEbayAppId();
  if (!appId) throw new Error("Seller listings lookup requires an eBay App ID. Please add EBAY_APP_ID to your environment secrets.");
  const cacheKey = `sellerlists:${marketplace}:${username}:${page}`;
  const cached = getCached<{ items: EbayItem[]; totalEntries: number; totalPages: number }>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {
    "OPERATION-NAME": "findItemsAdvanced",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "Global-ID": marketplace,
    "paginationInput.pageSize": "20",
    "paginationInput.pageNumber": String(page),
    "sortOrder": "BestMatch",
    "itemFilter(0).name": "Seller",
    "itemFilter(0).value": username,
    "outputSelector(0)": "SellerInfo",
  };

  const url = `${EBAY_API_BASE}?${buildQueryString(params)}`;
  const response = await axios.get(url, { timeout: 15000 });
  const resp = response.data["findItemsAdvancedResponse"]?.[0];
  const items: EbayItem[] = (resp?.searchResult?.[0]?.item || []).map(parseItem);
  const totalEntries = parseInt(resp?.paginationOutput?.[0]?.totalEntries?.[0] || "0");
  const totalPages = parseInt(resp?.paginationOutput?.[0]?.totalPages?.[0] || "1");

  const result = { items, totalEntries, totalPages };
  setCache(cacheKey, result, 5 * 60 * 1000);
  return result;
}

// ─── Category Stats ───────────────────────────────────────────────────────────
export async function getCategoryStats(
  categoryId: string,
  marketplace: string = "EBAY-US"
): Promise<{ totalActive: number; avgPrice: number; sellThroughRate: number; soldLast30d: number; topItems: EbayItem[] }> {
  const cacheKey = `catstat:${marketplace}:${categoryId}`;
  const cached = getCached<{ totalActive: number; avgPrice: number; sellThroughRate: number; soldLast30d: number; topItems: EbayItem[] }>(cacheKey);
  if (cached) return cached;

  const [activeResult, soldResult] = await Promise.all([
    findItemsByKeywords("*", { marketplace, categoryId, pageSize: 20, sortOrder: "BestMatch" })
      .catch(() => ({ items: [] as EbayItem[], totalEntries: 0, totalPages: 0 })),
    findCompletedItems("*", { marketplace, categoryId, pageSize: 20, timeRange: "30d" })
      .catch(() => ({ items: [] as EbayItem[], totalEntries: 0, totalPages: 0 })),
  ]);

  const prices = activeResult.items.map((i) => i.price).filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const totalActive = activeResult.totalEntries;
  const soldLast30d = soldResult.totalEntries;
  const sellThroughRate = totalActive > 0
    ? Math.min(100, Math.round((soldLast30d / (totalActive + soldLast30d)) * 100))
    : 0;

  const stats = { totalActive, avgPrice, sellThroughRate, soldLast30d, topItems: activeResult.items.slice(0, 5) };
  setCache(cacheKey, stats, 10 * 60 * 1000);
  return stats;
}

// ─── Keyword Suggestions ──────────────────────────────────────────────────────
export async function getKeywordCompetition(
  keyword: string,
  marketplace: string = "EBAY-US"
): Promise<{ activeCount: number; soldCount: number; avgPrice: number }> {
  const cacheKey = `kwcomp:${marketplace}:${keyword}`;
  const cached = getCached<{ activeCount: number; soldCount: number; avgPrice: number }>(cacheKey);
  if (cached) return cached;

  const [active, sold] = await Promise.all([
    findItemsByKeywords(keyword, { marketplace, pageSize: 5 }).catch(() => ({
      items: [],
      totalEntries: 0,
      totalPages: 0,
    })),
    findCompletedItems(keyword, { marketplace, pageSize: 5 }).catch(() => ({
      items: [],
      totalEntries: 0,
      totalPages: 0,
    })),
  ]);

  const prices = active.items.map((i) => i.price).filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const result = {
    activeCount: active.totalEntries,
    soldCount: sold.totalEntries,
    avgPrice,
  };
  setCache(cacheKey, result, 10 * 60 * 1000);
  return result;
}

// ─── Shopping API: GetSingleItem ─────────────────────────────────────────────
export interface EbayItemDetail {
  itemId: string;
  title: string;
  subtitle?: string;
  primaryCategory: { id: string; name: string };
  secondaryCategory?: { id: string; name: string };
  galleryUrls: string[];
  viewItemUrl: string;
  price: number;
  currency: string;
  listingStatus: string;
  condition: string;
  conditionId: string;
  description: string;
  location: string;
  country: string;
  seller: { username: string; feedbackScore: number; positiveFeedbackPercent: number };
  specifics: { name: string; value: string }[];
  shipToLocations: string;
  site: string;
  listingType: string;
  quantitySold: number;
}

export async function getItemDetails(itemId: string): Promise<EbayItemDetail | null> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) return null;

  const cacheKey = `item:${itemId}`;
  const cached = getCached<EbayItemDetail>(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      callname: "GetSingleItem",
      responseencoding: "JSON",
      appid: appId,
      siteid: "0",
      version: "967",
      ItemID: itemId,
      IncludeSelector: "Details,ItemSpecifics,Description,ShippingCosts,Variations",
    });
    const res = await axios.get(`https://open.api.ebay.com/shopping?${params.toString()}`, {
      timeout: 12000,
      headers: { "User-Agent": "AIBAY/1.0" },
    });
    const d = res.data?.Item;
    if (!d) return null;

    const specifics: { name: string; value: string }[] = [];
    const nameValueList = d.ItemSpecifics?.NameValueList;
    if (Array.isArray(nameValueList)) {
      for (const nv of nameValueList) {
        const name = nv.Name as string;
        const values = Array.isArray(nv.Value) ? nv.Value : [nv.Value];
        specifics.push({ name, value: values.filter(Boolean).join(", ") });
      }
    }

    const galleryUrls: string[] = [];
    if (d.PictureURL) {
      const pics = Array.isArray(d.PictureURL) ? d.PictureURL : [d.PictureURL];
      galleryUrls.push(...pics.filter(Boolean).slice(0, 12));
    }

    const detail: EbayItemDetail = {
      itemId: String(d.ItemID || itemId),
      title: d.Title || "",
      subtitle: d.Subtitle,
      primaryCategory: {
        id: String(d.PrimaryCategoryID || ""),
        name: d.PrimaryCategoryName || "",
      },
      secondaryCategory: d.SecondaryCategoryID
        ? { id: String(d.SecondaryCategoryID), name: d.SecondaryCategoryName || "" }
        : undefined,
      galleryUrls,
      viewItemUrl: d.ViewItemURLForNaturalSearch || `https://www.ebay.com/itm/${itemId}`,
      price: parseFloat(d.ConvertedCurrentPrice?.Value || d.CurrentPrice?.Value || "0"),
      currency: d.ConvertedCurrentPrice?.CurrencyID || "USD",
      listingStatus: d.ListingStatus || "",
      condition: d.ConditionDisplayName || "Not Specified",
      conditionId: String(d.ConditionID || "0"),
      description: (d.Description || "").slice(0, 5000),
      location: d.Location || "",
      country: d.Country || "",
      seller: {
        username: d.Seller?.UserID || "",
        feedbackScore: parseInt(d.Seller?.FeedbackScore || "0"),
        positiveFeedbackPercent: parseFloat(d.Seller?.PositiveFeedbackPercent || "0"),
      },
      specifics,
      shipToLocations: d.ShipToLocations || "",
      site: d.Site || "",
      listingType: d.ListingType || "",
      quantitySold: parseInt(d.QuantitySold || "0"),
    };

    setCache(cacheKey, detail, 10 * 60 * 1000);
    return detail;
  } catch {
    return null;
  }
}

// ─── eBay Profit Calculator ────────────────────────────────────────────────────
export interface ProfitBreakdown {
  costPrice: number;
  sellingPrice: number;
  shippingCost: number;
  marketplace: string;
  // eBay fees
  finalValueFee: number;
  finalValueFeeRate: number;
  internationalFee: number;
  listingFee: number;
  paymentProcessingFee: number;
  totalFees: number;
  // Profit
  grossProfit: number;
  netProfit: number;
  roi: number;
  marginPct: number;
  recommendation: "excellent" | "good" | "marginal" | "loss";
  recommendationText: string;
  breakEvenPrice: number;
  suggestedListingPrice: number;
}

// eBay Final Value Fee rates by marketplace (approximate, as of 2024)
const FVF_RATES: Record<string, { standard: number; aboveMin: number; threshold: number }> = {
  "EBAY-US": { standard: 0.1325, aboveMin: 0.0235, threshold: 7500 },
  "EBAY-GB": { standard: 0.1200, aboveMin: 0.0235, threshold: 5000 },
  "EBAY-AU": { standard: 0.1350, aboveMin: 0.0235, threshold: 10000 },
  "EBAY-DE": { standard: 0.1050, aboveMin: 0.0235, threshold: 7500 },
  "EBAY-CA": { standard: 0.1325, aboveMin: 0.0235, threshold: 7500 },
  "EBAY-FR": { standard: 0.1050, aboveMin: 0.0235, threshold: 7500 },
};

export function calculateEbayProfit(
  costPrice: number,
  sellingPrice: number,
  shippingCost: number = 0,
  marketplace: string = "EBAY-US",
  isInternational: boolean = false
): ProfitBreakdown {
  const fvfConfig = FVF_RATES[marketplace] || FVF_RATES["EBAY-US"];

  // Final Value Fee
  const fvf = sellingPrice <= fvfConfig.threshold
    ? sellingPrice * fvfConfig.standard
    : fvfConfig.threshold * fvfConfig.standard + (sellingPrice - fvfConfig.threshold) * fvfConfig.aboveMin;
  const finalValueFeeRate = fvfConfig.standard;

  // International transaction fee (2.35% on top for cross-border)
  const internationalFee = isInternational ? sellingPrice * 0.0235 : 0;

  // eBay no insertion fee for first 250 listings/month (simplified)
  const listingFee = 0;

  // Payment processing (included in FVF since managed payments)
  const paymentProcessingFee = 0;

  const totalFees = fvf + internationalFee + listingFee + paymentProcessingFee;
  const grossProfit = sellingPrice - costPrice - shippingCost;
  const netProfit = grossProfit - totalFees;
  const roi = costPrice > 0 ? (netProfit / (costPrice + shippingCost)) * 100 : 0;
  const marginPct = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

  // Break-even: costPrice + shipping + fees at this price
  const breakEvenPrice = (costPrice + shippingCost) / (1 - fvfConfig.standard);

  // Suggested price for 30% margin
  const suggestedListingPrice = (costPrice + shippingCost) / (1 - fvfConfig.standard - 0.20);

  let recommendation: ProfitBreakdown["recommendation"];
  let recommendationText: string;
  if (marginPct >= 30) {
    recommendation = "excellent";
    recommendationText = `🔥 Excellent opportunity — ${marginPct.toFixed(1)}% net margin. List immediately.`;
  } else if (marginPct >= 20) {
    recommendation = "good";
    recommendationText = `✅ Good margin of ${marginPct.toFixed(1)}%. Profitable at scale.`;
  } else if (marginPct >= 5) {
    recommendation = "marginal";
    recommendationText = `⚠️ Thin margin (${marginPct.toFixed(1)}%). Consider sourcing cheaper or raising price.`;
  } else {
    recommendation = "loss";
    recommendationText = `❌ Not profitable at this price. Break-even is $${breakEvenPrice.toFixed(2)}.`;
  }

  return {
    costPrice,
    sellingPrice,
    shippingCost,
    marketplace,
    finalValueFee: fvf,
    finalValueFeeRate,
    internationalFee,
    listingFee,
    paymentProcessingFee,
    totalFees,
    grossProfit,
    netProfit,
    roi,
    marginPct,
    recommendation,
    recommendationText,
    breakEvenPrice,
    suggestedListingPrice,
  };
}

// ─── eBay Sold Price Lookup (for supplier cross-reference) ───────────────────
export interface EbaySoldSummary {
  keyword: string;
  marketplace: string;
  avgSoldPrice: number;
  minSoldPrice: number;
  maxSoldPrice: number;
  totalSold: number;
  topSoldItems: { title: string; price: number; itemId: string; url: string; endDate: string }[];
  configured: boolean;
}

export async function getEbaySoldSummary(
  keyword: string,
  marketplace: string = "EBAY-US"
): Promise<EbaySoldSummary> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    return {
      keyword,
      marketplace,
      avgSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      totalSold: 0,
      topSoldItems: [],
      configured: false,
    };
  }

  const cacheKey = `soldsummary:${marketplace}:${keyword}`;
  const cached = getCached<EbaySoldSummary>(cacheKey);
  if (cached) return cached;

  try {
    const result = await findCompletedItems(keyword, { marketplace, pageSize: 50, timeRange: "30d" });
    const prices = result.items.map((i) => i.price).filter((p) => p > 0);
    const avgSoldPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    const summary: EbaySoldSummary = {
      keyword,
      marketplace,
      avgSoldPrice,
      minSoldPrice: prices.length ? Math.min(...prices) : 0,
      maxSoldPrice: prices.length ? Math.max(...prices) : 0,
      totalSold: result.totalEntries,
      topSoldItems: result.items.slice(0, 5).map((i) => ({
        title: i.title,
        price: i.price,
        itemId: i.itemId,
        url: i.viewItemUrl,
        endDate: i.endTime,
      })),
      configured: true,
    };

    setCache(cacheKey, summary, 10 * 60 * 1000);
    return summary;
  } catch {
    return {
      keyword,
      marketplace,
      avgSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      totalSold: 0,
      topSoldItems: [],
      configured: true,
    };
  }
}

// ─── Taxonomy Validation ───────────────────────────────────────────────────────
export interface SpecificValidationResult {
  required: string[];
  recommended: string[];
  missing: string[];
  configured: boolean;
}

export async function getRequiredSpecificsForCategory(
  categoryId: string,
  existingSpecifics: { name: string; value: string }[]
): Promise<SpecificValidationResult> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    return { required: [], recommended: [], missing: [], configured: false };
  }

  const cacheKey = `taxonomy:${categoryId}`;
  const cached = getCached<{ required: string[]; recommended: string[] }>(cacheKey);
  let required: string[] = [];
  let recommended: string[] = [];

  if (cached) {
    required = cached.required;
    recommended = cached.recommended;
  } else {
    try {
      const params = new URLSearchParams({
        "callname": "GetCategorySpecifics",
        "responseencoding": "JSON",
        "appid": appId,
        "siteid": "0",
        "version": "967",
        "CategoryID": categoryId,
        "MaxNames": "30",
      });
      const res = await axios.get(`https://open.api.ebay.com/shopping?${params.toString()}`, {
        timeout: 10000,
        headers: { "User-Agent": "AIBAY/1.0" },
      });
      const recs = res.data?.Recommendations?.NameRecommendation;
      if (Array.isArray(recs)) {
        for (const rec of recs) {
          const name = rec.Name as string;
          const usage = (rec.ValidationRules?.MinValues ?? 0);
          if (usage > 0) required.push(name);
          else recommended.push(name);
        }
      }
      setCache(cacheKey, { required, recommended }, 60 * 60 * 1000);
    } catch {
      // Taxonomy API unavailable — return what we have
    }
  }

  const existingNames = new Set(existingSpecifics.map(s => s.name.toLowerCase()));
  const missing = required.filter(r => !existingNames.has(r.toLowerCase()));

  return { required, recommended, missing, configured: true };
}
