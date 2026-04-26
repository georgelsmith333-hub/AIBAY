// ─── AIBAY Supplier Finder ───────────────────────────────────────────────────
// Searches Amazon, AliExpress, and Temu with multiple bypass strategies.

import axios from "axios";

export interface SupplierProduct {
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  rating?: number;
  reviewCount?: number;
  platform: "amazon" | "aliexpress" | "temu";
  shipping?: string;
  seller?: string;
  moq?: number;
}

export interface SupplierSearchResult {
  keyword: string;
  amazon: SupplierProduct[];
  aliexpress: SupplierProduct[];
  temu: SupplierProduct[];
  searchUrls: { amazon: string; aliexpress: string; temu: string };
  scrapedAt: number;
}

// In-memory cache: keyword -> result, expires after 30 min
const CACHE = new Map<string, { result: SupplierSearchResult; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCached(key: string): SupplierSearchResult | null {
  const entry = CACHE.get(key);
  if (!entry || Date.now() > entry.expiresAt) { CACHE.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: SupplierSearchResult) {
  if (CACHE.size > 100) { const f = CACHE.keys().next().value; if (f) CACHE.delete(f); }
  CACHE.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
}

// ─── Build search URLs ────────────────────────────────────────────────────────
export function buildSearchUrls(keyword: string) {
  const q = encodeURIComponent(keyword);
  return {
    amazon: `https://www.amazon.com/s?k=${q}&ref=nb_sb_noss`,
    aliexpress: `https://www.aliexpress.com/wholesale?SearchText=${q}&SortType=total_trandy_desc`,
    temu: `https://www.temu.com/search_result.html?search_key=${q}`,
  };
}

// ─── Rotating user agents ─────────────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function browserHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "DNT": "1",
    ...(referer ? { "Referer": referer } : {}),
  };
}

// ─── AliExpress: Multi-strategy bypass ───────────────────────────────────────
async function searchAliExpress(keyword: string): Promise<SupplierProduct[]> {
  // Strategy 1: AliExpress mobile API (lighter anti-bot)
  try {
    const mobileUrl = `https://m.aliexpress.com/search.htm?SearchText=${encodeURIComponent(keyword)}&catId=0&initiative_id=SB_${Date.now()}`;
    const res = await axios.get(mobileUrl, {
      timeout: 14000,
      headers: {
        ...browserHeaders("https://m.aliexpress.com"),
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const products = parseAliExpressHtml(res.data as string);
    if (products.length > 0) return products;
  } catch {}

  // Strategy 2: AliExpress AJAX search API
  try {
    const ajaxUrl = `https://www.aliexpress.com/ajax/search.htm?SearchText=${encodeURIComponent(keyword)}&page=1&pageSize=10&sortType=total_trandy_desc`;
    const res = await axios.get(ajaxUrl, {
      timeout: 12000,
      headers: {
        ...browserHeaders("https://www.aliexpress.com"),
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (res.data?.items || res.data?.result?.resultSummaryModel?.items) {
      const items = res.data.items || res.data.result?.resultSummaryModel?.items || [];
      return items.slice(0, 10).map((item: any) => ({
        title: item.title || item.name || "",
        price: parseFloat(item.minPrice || item.price || "0"),
        currency: "USD",
        imageUrl: item.imageUrl || item.img || "",
        productUrl: item.detailUrl
          ? (item.detailUrl.startsWith("http") ? item.detailUrl : `https:${item.detailUrl}`)
          : `https://www.aliexpress.com/item/${item.productId}.html`,
        rating: parseFloat(item.starRating || "0"),
        reviewCount: parseInt(item.orders || "0"),
        platform: "aliexpress" as const,
        shipping: "Free Shipping",
      })).filter((p: any) => p.price > 0);
    }
  } catch {}

  // Strategy 3: Desktop HTML scrape with full browser simulation
  try {
    const res = await axios.get(
      `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(keyword)}&SortType=total_trandy_desc`,
      {
        timeout: 15000,
        headers: {
          ...browserHeaders("https://www.google.com"),
          "Cookie": "aep_usuc_f=site=glo&c_tp=USD&region=GB&b_locale=en_US",
        },
        maxRedirects: 5,
      }
    );
    const products = parseAliExpressHtml(res.data as string);
    if (products.length > 0) return products;
  } catch {}

  // Strategy 4: Opensearch endpoint
  try {
    const res = await axios.get(
      `https://www.aliexpress.com/glosearch/api/product?keywords=${encodeURIComponent(keyword)}&categoryId=&page=1&pageSize=12&sortType=total_trandy_desc&currency=USD&local=en_US`,
      {
        timeout: 10000,
        headers: {
          ...browserHeaders("https://www.aliexpress.com"),
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );
    const items = res.data?.data?.products || res.data?.items || [];
    if (items.length > 0) {
      return items.slice(0, 10).map((item: any) => ({
        title: item.title || item.productTitle || "",
        price: parseFloat(item.salePrice?.value || item.minPrice || item.price || "0"),
        currency: "USD",
        imageUrl: item.imageUrl || (item.imageUrl?.startsWith("//") ? `https:${item.imageUrl}` : "") || "",
        productUrl: item.productDetailUrl
          ? (item.productDetailUrl.startsWith("http") ? item.productDetailUrl : `https:${item.productDetailUrl}`)
          : `https://www.aliexpress.com/item/${item.productId}.html`,
        rating: parseFloat(item.starRating || item.rating || "0"),
        reviewCount: parseInt(item.tradeDesc?.match(/\d+/)?.[0] || item.orders || "0"),
        platform: "aliexpress" as const,
        shipping: item.shipping?.freeShipping ? "Free Shipping" : undefined,
      })).filter((p: any) => p.price > 0 && p.title);
    }
  } catch {}

  return [];
}

function parseAliExpressHtml(html: string): SupplierProduct[] {
  const products: SupplierProduct[] = [];

  // Try JSON data embedded in page scripts
  const patterns = [
    /window\.__SEARCH_RESULT_DATA__\s*=\s*(\{[\s\S]+?\});?\s*(?:<\/script>|window\.)/,
    /window\.runParams\s*=\s*(\{[\s\S]+?\});\s*<\/script>/,
    /"mods"\s*:\s*\{"itemList"\s*:\s*(\{[\s\S]+?\})\s*,\s*"banner"/,
    /data-lazy-src="([^"]+)"[^>]+>\s*<\/div>[\s\S]{0,500}?"title":"([^"]+)"[\s\S]{0,200}?"salePrice":(\d+\.\d+)/g,
  ];

  for (const pattern of patterns.slice(0, 3)) {
    try {
      const m = html.match(pattern as RegExp);
      if (!m) continue;
      const data = JSON.parse(m[1]);
      const items =
        data?.mods?.itemList?.content ||
        data?.itemList?.content ||
        data?.data?.products ||
        data?.result?.resultSummaryModel?.items ||
        [];
      for (const item of items.slice(0, 10)) {
        const price = parseFloat(
          item.prices?.salePrice?.minPrice ||
          item.prices?.originalPrice?.minPrice ||
          item.salePrice?.value ||
          item.minPrice || "0"
        );
        if (!price) continue;
        const imgRaw = item.image?.imgUrl || item.imageUrl || "";
        products.push({
          title: item.title?.displayTitle || item.title || item.productTitle || "",
          price,
          currency: "USD",
          imageUrl: imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw,
          productUrl: item.detailUrl
            ? (item.detailUrl.startsWith("http") ? item.detailUrl : `https:${item.detailUrl}`)
            : `https://www.aliexpress.com/item/${item.productId}.html`,
          rating: parseFloat(item.evaluation?.starRating || item.starRating || "0"),
          reviewCount: parseInt(item.evaluation?.totalValidNum || item.tradeCount || "0"),
          platform: "aliexpress",
          shipping: item.shipping?.isLocalReturn ? "Free Returns" : "Free Shipping",
          seller: item.store?.storeName || item.seller?.storeName || "",
        });
      }
      if (products.length > 0) return products;
    } catch {}
  }

  // Regex fallback
  const re = /"productId":"(\d+)","(?:title|productTitle)":"([^"]+)"[\s\S]{0,300}?"(?:minPrice|salePrice)":(\d+\.\d+)/g;
  let m;
  while ((m = re.exec(html)) !== null && products.length < 8) {
    products.push({
      title: m[2],
      price: parseFloat(m[3]),
      currency: "USD",
      imageUrl: "",
      productUrl: `https://www.aliexpress.com/item/${m[1]}.html`,
      platform: "aliexpress",
    });
  }
  return products;
}

// ─── Amazon: Enhanced scrape ──────────────────────────────────────────────────
async function searchAmazon(keyword: string): Promise<SupplierProduct[]> {
  try {
    const res = await axios.get(
      `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&ref=nb_sb_noss&s=price-asc-rank`,
      {
        timeout: 15000,
        headers: {
          ...browserHeaders("https://www.google.com"),
          "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        },
        maxRedirects: 5,
      }
    );
    const html = res.data as string;
    const products: SupplierProduct[] = [];

    // Parse individual product blocks
    const blockRegex = /<div[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]{10})"[\s\S]*?(?=<div[^>]*data-component-type="s-search-result"|<div[^>]*class="[^"]*s-pagination|$)/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(html)) !== null && products.length < 10) {
      const block = blockMatch[0];
      const asin = blockMatch[1];
      const titleM =
        block.match(/class="a-size-base-plus a-color-base a-text-normal">([^<]+)</) ||
        block.match(/class="a-size-medium a-color-base a-text-normal">([^<]+)</) ||
        block.match(/class="a-size-base-plus[^"]*">([^<]{5,200})<\/span>/);
      const priceWholeM = block.match(/class="a-price-whole">([^<]+)</);
      const priceFracM = block.match(/class="a-price-fraction">([^<]+)</);
      const ratingM = block.match(/(\d+\.\d)\s*out of 5/);
      const reviewsM = block.match(/\((\d[\d,]+)\)/);
      const imgM = block.match(/<img[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
      const freeDelivery = block.includes("FREE delivery") || block.includes("FREE Delivery");
      const titleText = titleM ? titleM[1].trim() : "";
      if (!titleText || titleText.length < 3) continue;
      const priceStr = priceWholeM ? priceWholeM[1].replace(/[,$]/g, "") + "." + (priceFracM ? priceFracM[1] : "00") : "";
      const price = parseFloat(priceStr);
      if (!price || price <= 0) continue;
      products.push({
        title: titleText,
        price,
        currency: "USD",
        imageUrl: imgM?.[1] || "",
        productUrl: `https://www.amazon.com/dp/${asin}`,
        rating: ratingM ? parseFloat(ratingM[1]) : undefined,
        reviewCount: reviewsM ? parseInt(reviewsM[1].replace(/,/g, "")) : undefined,
        platform: "amazon",
        shipping: freeDelivery ? "FREE delivery" : undefined,
      });
    }

    // Fallback: JSON-LD extraction
    if (products.length === 0) {
      const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]+?)<\/script>/g;
      let jm;
      while ((jm = jsonLdRegex.exec(html)) !== null && products.length < 5) {
        try {
          const d = JSON.parse(jm[1]);
          if (d["@type"] === "Product" && d.name) {
            const price = parseFloat(d.offers?.price || d.offers?.lowPrice || "0");
            if (price > 0) {
              products.push({
                title: d.name,
                price,
                currency: d.offers?.priceCurrency || "USD",
                imageUrl: Array.isArray(d.image) ? d.image[0] : (d.image || ""),
                productUrl: d.url || "",
                rating: parseFloat(d.aggregateRating?.ratingValue || "0"),
                reviewCount: parseInt(d.aggregateRating?.reviewCount || "0"),
                platform: "amazon",
              });
            }
          }
        } catch {}
      }
    }

    return products;
  } catch {
    return [];
  }
}

// ─── Temu: Multi-strategy scrape ──────────────────────────────────────────────
async function searchTemu(keyword: string): Promise<SupplierProduct[]> {
  // Strategy 1: Internal API POST
  try {
    const res = await axios.post(
      "https://www.temu.com/api/bg/primrose/pc/search/result/v1/get",
      {
        keyword,
        search_method: "user_input",
        page: 1,
        page_size: 12,
        sort_type: 0,
        filter_items: [],
      },
      {
        timeout: 12000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": randomUA(),
          "Accept": "application/json",
          "Referer": "https://www.temu.com",
          "Origin": "https://www.temu.com",
          "anti-content": "0aqABsRlKbPsK5JMuZFhPY0EYFsTz",
        },
      }
    );
    const items = res.data?.result?.search_result?.list || res.data?.data?.list || [];
    if (items.length > 0) {
      return items.slice(0, 10).map((item: any) => ({
        title: item.goods_name || item.name || "",
        price: (item.price || item.sales_price || 0) / 100,
        currency: "USD",
        imageUrl: item.goods_img_url || item.image_url || item.thumbnail || "",
        productUrl: `https://www.temu.com/goods.html?_bg_fs=1&goods_id=${item.goods_id || item.id}`,
        rating: item.goods_evaluate_rate ? parseFloat(item.goods_evaluate_rate) / 20 : undefined,
        reviewCount: item.goods_comment_num || undefined,
        platform: "temu" as const,
        shipping: "Free Shipping",
      })).filter((p: any) => p.price > 0 && p.title);
    }
  } catch {}

  // Strategy 2: HTML scrape of Temu search page
  try {
    const res = await axios.get(
      `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(keyword)}&search_method=user`,
      {
        timeout: 12000,
        headers: {
          ...browserHeaders("https://www.temu.com"),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        maxRedirects: 5,
      }
    );
    const html = res.data as string;
    const products: SupplierProduct[] = [];
    const scripts = html.match(/<script[^>]*>\s*window\.__NEXT_DATA__\s*=\s*([\s\S]+?)\s*<\/script>/);
    if (scripts) {
      const data = JSON.parse(scripts[1]);
      const searchResult = data?.props?.pageProps?.ssrSearchResult?.searchResult;
      const itemList = searchResult?.itemList || [];
      for (const item of itemList.slice(0, 10)) {
        const price = (item.priceInfo?.salePrice || 0) / 100;
        if (!price) continue;
        products.push({
          title: item.title || item.goodsName || "",
          price,
          currency: "USD",
          imageUrl: item.thumbUrl || item.imgUrl || "",
          productUrl: `https://www.temu.com/goods.html?goods_id=${item.goodsId}`,
          platform: "temu",
          shipping: "Free Shipping",
        });
      }
      if (products.length > 0) return products;
    }
    return products;
  } catch {}

  return [];
}

// ─── Main search function ─────────────────────────────────────────────────────
export async function searchSuppliers(keyword: string): Promise<SupplierSearchResult> {
  const cacheKey = keyword.toLowerCase().trim();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const searchUrls = buildSearchUrls(keyword);

  // Search all platforms in parallel with individual timeouts
  const [amazon, aliexpress, temu] = await Promise.all([
    searchAmazon(keyword).catch(() => [] as SupplierProduct[]),
    searchAliExpress(keyword).catch(() => [] as SupplierProduct[]),
    searchTemu(keyword).catch(() => [] as SupplierProduct[]),
  ]);

  const result: SupplierSearchResult = {
    keyword,
    amazon,
    aliexpress,
    temu,
    searchUrls,
    scrapedAt: Date.now(),
  };

  setCache(cacheKey, result);
  return result;
}
