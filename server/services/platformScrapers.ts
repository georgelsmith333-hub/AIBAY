import axios from "axios";
import * as cheerio from "cheerio";

// ─── SSRF Protection ──────────────────────────────────────────────────────────

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fe80:/i,
  /metadata\.google\.internal$/i,
  /\.internal$/i,
];

export function validateSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Blocked scheme: ${parsed.protocol}. Only http/https allowed.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked hostname: ${hostname} (SSRF protection)`);
    }
  }
  if (parsed.port && Number(parsed.port) < 1024 && !["80", "443"].includes(parsed.port)) {
    throw new Error(`Blocked privileged port: ${parsed.port}`);
  }
}

export interface ScrapedProduct {
  title: string;
  description: string;
  images: string[];
  specifications: Record<string, string>;
  price?: number;
  variations?: { name: string; options: string[] }[];
  brand?: string;
  categoryBreadcrumb?: string;
  platform: string;
  sourceUrl: string;
}

type Platform = "aliexpress" | "amazon" | "temu" | "cjdropshipping" | "generic";

export function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes("aliexpress.com") || lower.includes("aliexpress.us")) return "aliexpress";
  if (lower.includes("amazon.com") || lower.includes("amazon.co.uk") || lower.includes("amazon.de") || lower.includes("amazon.ca")) return "amazon";
  if (lower.includes("temu.com")) return "temu";
  if (lower.includes("cjdropshipping.com") || lower.includes("cjdrop.com")) return "cjdropshipping";
  return "generic";
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
];

const MOBILE_UAS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomMobileUA() {
  return MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
}

const STANDARD_HEADERS = {
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function parseSetCookie(setCookie: string[] | undefined, jar: Map<string, string>) {
  if (!setCookie) return;
  for (const c of setCookie) {
    const first = c.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) {
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1).trim();
      if (k) jar.set(k, v);
    }
  }
}

function jarToHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchHtml(url: string, opts: { mobile?: boolean; referer?: string; cookie?: string } = {}): Promise<string> {
  const ua = opts.mobile ? randomMobileUA() : randomUA();
  const baseHeaders: Record<string, string> = {
    ...STANDARD_HEADERS,
    "User-Agent": ua,
  };
  if (opts.mobile) baseHeaders["Sec-Ch-Ua-Mobile"] = "?1";

  // Manual redirect handling with cookie jar (breaks AliExpress sync_cookie_write loops)
  const jar = new Map<string, string>();
  if (opts.cookie) {
    for (const part of opts.cookie.split(";")) {
      const [k, ...rest] = part.split("=");
      if (k && rest.length) jar.set(k.trim(), rest.join("=").trim());
    }
  }

  let currentUrl = url;
  let referer = opts.referer || "";
  const visitedSyncWrite = new Set<string>();
  const MAX_HOPS = 12;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const headers: Record<string, string> = { ...baseHeaders };
    if (referer) headers["Referer"] = referer;
    const cookieStr = jarToHeader(jar);
    if (cookieStr) headers["Cookie"] = cookieStr;

    const res = await axios.get(currentUrl, {
      headers,
      timeout: 25000,
      maxRedirects: 0,
      responseType: "text",
      decompress: true,
      validateStatus: (s) => (s >= 200 && s < 400) || s === 404,
    });

    // Capture cookies
    parseSetCookie(res.headers["set-cookie"] as string[] | undefined, jar);

    // 2xx → done
    if (res.status >= 200 && res.status < 300) {
      return res.data as string;
    }

    // 3xx → follow
    const loc = res.headers.location || res.headers.Location;
    if (!loc) {
      throw new Error(`Redirect with no Location (status ${res.status}) at ${currentUrl}`);
    }
    let next: string;
    try {
      next = new URL(loc, currentUrl).toString();
    } catch {
      throw new Error(`Invalid redirect Location: ${loc}`);
    }

    // Detect cookie-sync loop
    if (next.includes("sync_cookie_write")) {
      const key = next.split("?")[0];
      if (visitedSyncWrite.has(key)) {
        // We've already done this sync once, jar should now have the right cookies — skip
        // Extract xman_goto target and jump there directly
        try {
          const u = new URL(next);
          const goto = u.searchParams.get("xman_goto");
          if (goto) {
            currentUrl = goto;
            referer = next;
            continue;
          }
        } catch {}
      }
      visitedSyncWrite.add(key);
    }

    referer = currentUrl;
    currentUrl = next;
  }
  throw new Error(`Too many redirects (>${MAX_HOPS}) from ${url}`);
}

function normalizeAliExpressUrl(rawUrl: string): { itemId: string | null; canonical: string; mobile: string } {
  let itemId: string | null = null;
  const m = rawUrl.match(/\/item\/(\d{8,})/);
  if (m) itemId = m[1];
  const canonical = itemId ? `https://www.aliexpress.com/item/${itemId}.html` : rawUrl;
  const mobile = itemId ? `https://m.aliexpress.com/item/${itemId}.html` : rawUrl;
  return { itemId, canonical, mobile };
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function absoluteUrl(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function cleanText(s: string | undefined | null): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function extractImagesFromCheerio($: cheerio.CheerioAPI, base: string): string[] {
  const urls: string[] = [];
  const og = $('meta[property="og:image"]').attr("content");
  if (og) urls.push(absoluteUrl(og, base));
  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") || $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("data-original") || "";
    if (!src) return;
    if (src.startsWith("data:")) return;
    const abs = absoluteUrl(src, base);
    if (!abs.startsWith("http")) return;
    if (/icon|logo|sprite|placeholder|blank|loading/i.test(abs)) return;
    const w = parseInt($el.attr("width") || "0", 10);
    const h = parseInt($el.attr("height") || "0", 10);
    if ((w && w < 80) || (h && h < 80)) return;
    urls.push(abs);
  });
  return uniq(urls).slice(0, 30);
}

// ─── HTTP Scrapers (no browser needed) ────────────────────────────────────────

async function httpScrapeAliExpress(url: string): Promise<ScrapedProduct> {
  // Normalize URL — aliexpress.us causes redirect loops, prefer canonical .com
  const { canonical, mobile } = normalizeAliExpressUrl(url);
  const cookie = `aep_usuc_f=site=glo&c_tp=USD&region=US&b_locale=en_US; intl_locale=en_US; xman_us_f=x_l=0; xman_t=Q1Q3${Date.now()}; aep_common_f=Mp+nm/MtsW8AMwLCSn8aOcJaBl7gD6FVMzORlW4q+VCfvfuGfDWPJg==`;

  const candidates: Array<{ u: string; m?: boolean }> = [
    { u: canonical },
    { u: mobile, m: true },
    { u: canonical, m: true },
    { u: url },
  ];

  let html = "";
  let lastErr: any;
  for (const c of candidates) {
    try {
      html = await fetchHtml(c.u, {
        mobile: !!c.m,
        referer: "https://www.google.com/",
        cookie,
      });
      if (html && html.length > 5000) break;
      html = "";
    } catch (e) {
      lastErr = e;
      html = "";
    }
  }
  if (!html) throw lastErr || new Error("AliExpress fetch failed");

  const $ = cheerio.load(html);

  // Try multiple title selectors
  let title =
    cleanText($("h1[data-pl='product-title']").first().text()) ||
    cleanText($(".title--wrap--UUHae_g .title--title--").first().text()) ||
    cleanText($(".product-title-text").first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text());

  // Try to parse runParams JSON embedded in scripts
  let priceFromJson = 0;
  let descFromJson = "";
  let imagesFromJson: string[] = [];
  const specsFromJson: Record<string, string> = {};
  $("script").each((_, el) => {
    const txt = $(el).html() || "";
    if (!txt) return;
    if (txt.includes("window.runParams") || txt.includes("_d_c_") || txt.includes("titleModule")) {
      // Title
      const tMatch = txt.match(/"subject"\s*:\s*"([^"]{10,})"/);
      if (tMatch && !title) title = tMatch[1];
      // Price
      const pMatch =
        txt.match(/"discountedPrice"\s*:\s*"?([0-9.]+)"?/) ||
        txt.match(/"minActivityAmount"[^}]*"value"\s*:\s*([0-9.]+)/) ||
        txt.match(/"formatedActivityPrice"\s*:\s*"[^0-9]*([0-9.]+)/) ||
        txt.match(/"value"\s*:\s*([0-9.]+)\s*,\s*"currency"/);
      if (pMatch) priceFromJson = parseFloat(pMatch[1]) || 0;
      // Images
      const imgMatches = txt.matchAll(/"imagePath"\s*:\s*"([^"]+)"/g);
      for (const m of imgMatches) {
        const u = m[1].replace(/\\u002F/g, "/");
        if (u.startsWith("http")) imagesFromJson.push(u);
      }
      const imgList = txt.match(/"imageList"\s*:\s*\[([^\]]+)\]/);
      if (imgList) {
        const m2 = imgList[1].matchAll(/"(https?:[^"]+)"/g);
        for (const m of m2) imagesFromJson.push(m[1]);
      }
      // Specs
      const props = txt.matchAll(/"attrName"\s*:\s*"([^"]+)"\s*,\s*"attrValue"\s*:\s*"([^"]+)"/g);
      for (const m of props) specsFromJson[m[1]] = m[2];
    }
  });

  // Description fallback - get product details / description container
  const description =
    cleanText($("#product-description").text()) ||
    cleanText($('[class*="description"]').first().text()).slice(0, 3000) ||
    descFromJson ||
    cleanText($('meta[name="description"]').attr("content")) ||
    "";

  // Specs from HTML
  const specs: Record<string, string> = { ...specsFromJson };
  $('[class*="specification"] tr, [class*="property-item"]').each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td, [class*='name'], [class*='value']");
    if (cells.length >= 2) {
      const k = cleanText($(cells[0]).text());
      const v = cleanText($(cells[1]).text());
      if (k && v && k.length < 100) specs[k] = v.slice(0, 300);
    }
  });

  // Images
  let images = uniq([...imagesFromJson, ...extractImagesFromCheerio($, url)]).slice(0, 30);

  // Price fallback
  let price = priceFromJson;
  if (!price) {
    const priceText = cleanText(
      $(".price--current--").first().text() ||
        $('[class*="price"][class*="current"]').first().text() ||
        $('[itemprop="price"]').attr("content") ||
        "",
    );
    price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;
  }

  if (!title) throw new Error("AliExpress: could not extract product details (page may be blocked or empty)");

  return {
    title,
    description: description.slice(0, 5000),
    images,
    specifications: specs,
    price,
    platform: "aliexpress",
    sourceUrl: url,
  };
}

async function httpScrapeAmazon(url: string): Promise<ScrapedProduct> {
  let html = "";
  let lastErr: any;
  for (const attempt of [1, 2]) {
    try {
      html = await fetchHtml(url, {
        mobile: attempt === 2,
        referer: "https://www.google.com/",
      });
      if (html && html.length > 5000) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!html) throw lastErr || new Error("Amazon fetch failed");

  const $ = cheerio.load(html);

  const title =
    cleanText($("#productTitle").text()) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("h1").first().text());

  // Price
  const priceText =
    cleanText($(".a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen").first().text()) ||
    cleanText($(".a-price .a-offscreen").first().text()) ||
    cleanText($("#priceblock_ourprice").text()) ||
    cleanText($('[data-a-color="price"] .a-offscreen').first().text());
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

  // Features (description)
  const features: string[] = [];
  $("#feature-bullets li span.a-list-item").each((_, el) => {
    const t = cleanText($(el).text());
    if (t && t.length > 10) features.push(t);
  });
  const description = features.join("\n") || cleanText($("#productDescription").text());

  // Specs
  const specs: Record<string, string> = {};
  $("#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr").each((_, row) => {
    const $row = $(row);
    const k = cleanText($row.find("th").first().text()).replace(/[^a-zA-Z0-9 ]/g, "");
    const v = cleanText($row.find("td").first().text());
    if (k && v) specs[k] = v.slice(0, 300);
  });
  $("#detailBullets_feature_div li").each((_, li) => {
    const txt = cleanText($(li).text());
    const parts = txt.split(":");
    if (parts.length >= 2) {
      const k = cleanText(parts[0]).replace(/[^a-zA-Z0-9 ]/g, "");
      const v = cleanText(parts.slice(1).join(":"));
      if (k && v) specs[k] = v.slice(0, 300);
    }
  });

  const brand =
    cleanText($("#bylineInfo").text()).replace(/Brand:|Visit the|Store/gi, "").trim() ||
    specs["Brand"] ||
    "";

  // Images - Amazon embeds them in scripts too
  const images: string[] = [];
  const landing = $("#landingImage").attr("src") || $("#landingImage").attr("data-old-hires");
  if (landing) images.push(landing);
  $("#altImages img").each((_, img) => {
    const src = ($(img).attr("src") || "").replace(/\._[A-Z0-9_,]+_\./, ".");
    if (src && !src.includes("icon") && !src.includes("play")) images.push(src);
  });
  // Hi-res from inline JSON
  const hiResMatches = html.matchAll(/"hiRes":"(https:\/\/[^"]+)"/g);
  for (const m of hiResMatches) images.push(m[1]);
  const largeMatches = html.matchAll(/"large":"(https:\/\/[^"]+)"/g);
  for (const m of largeMatches) images.push(m[1]);

  const breadcrumb = cleanText($("#wayfinding-breadcrumbs_container").text());

  if (!title) throw new Error("Amazon: could not extract product details");

  return {
    title,
    description: description.slice(0, 5000),
    images: uniq(images).slice(0, 30),
    specifications: specs,
    price,
    brand,
    categoryBreadcrumb: breadcrumb,
    platform: "amazon",
    sourceUrl: url,
  };
}

async function httpScrapeTemu(url: string): Promise<ScrapedProduct> {
  let html = "";
  for (const attempt of [1, 2]) {
    try {
      html = await fetchHtml(url, { mobile: attempt === 2, referer: "https://www.temu.com/" });
      if (html && html.length > 3000) break;
    } catch {}
  }
  if (!html) throw new Error("Temu fetch failed");

  const $ = cheerio.load(html);

  const title =
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").text());

  let price = 0;
  const ldJson = $('script[type="application/ld+json"]').toArray();
  for (const s of ldJson) {
    try {
      const j = JSON.parse($(s).html() || "{}");
      const offers = j.offers || j.product?.offers;
      if (offers?.price) {
        price = parseFloat(String(offers.price));
        break;
      }
    } catch {}
  }
  if (!price) {
    const priceMatch = html.match(/"priceStr"\s*:\s*"[^0-9]*([0-9.]+)/);
    if (priceMatch) price = parseFloat(priceMatch[1]) || 0;
  }

  const description =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('[class*="description"]').first().text()).slice(0, 3000);

  const images: string[] = [];
  const ogImg = $('meta[property="og:image"]').attr("content");
  if (ogImg) images.push(ogImg);
  const imgMatches = html.matchAll(/"hd_url"\s*:\s*"(https?:\/\/[^"]+)"/g);
  for (const m of imgMatches) images.push(m[1]);
  const galleryMatches = html.matchAll(/"url"\s*:\s*"(https?:\/\/img\.kwcdn\.com[^"]+)"/g);
  for (const m of galleryMatches) images.push(m[1]);

  if (!title) throw new Error("Temu: could not extract product details");

  return {
    title,
    description,
    images: uniq(images).slice(0, 30),
    specifications: {},
    price,
    platform: "temu",
    sourceUrl: url,
  };
}

async function httpScrapeCJ(url: string): Promise<ScrapedProduct> {
  const html = await fetchHtml(url, { referer: "https://www.cjdropshipping.com/" });
  const $ = cheerio.load(html);

  const title =
    cleanText($("#j-product-name").text()) ||
    cleanText($(".pd-title").text()) ||
    cleanText($("h1.product-name").text()) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("title").text());

  const priceText = cleanText($(".pd-price .price").text()) || cleanText($('[class*="product-price"]').first().text());
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

  const description =
    cleanText($(".pd-desc").text()) ||
    cleanText($('[class*="product-description"]').first().text()) ||
    cleanText($(".detail-info").text()) ||
    cleanText($('meta[name="description"]').attr("content"));

  const specs: Record<string, string> = {};
  $(".product-params tr, .attrs-item").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("th, td, .attrs-key, .attrs-val");
    if (cells.length >= 2) {
      const k = cleanText($(cells[0]).text());
      const v = cleanText($(cells[1]).text());
      if (k && v) specs[k] = v.slice(0, 300);
    }
  });

  const images: string[] = [];
  $(".gallery__list img, .swiper-slide img, [class*='product-img'] img").each((_, img) => {
    const src = $(img).attr("src") || $(img).attr("data-src") || "";
    if (src && src.startsWith("http")) images.push(src);
  });
  if (!images.length) {
    const og = $('meta[property="og:image"]').attr("content");
    if (og) images.push(og);
  }

  if (!title) throw new Error("CJ: could not extract product details");

  return {
    title,
    description: description.slice(0, 5000),
    images: uniq(images).slice(0, 30),
    specifications: specs,
    price,
    platform: "cjdropshipping",
    sourceUrl: url,
  };
}

async function httpScrapeGeneric(url: string): Promise<ScrapedProduct> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const title =
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").text());

  // ld+json product data
  let priceFromLd = 0;
  let imageFromLd: string[] = [];
  let brandFromLd = "";
  let descFromLd = "";
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const raw = $(s).html() || "";
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        if (!it) continue;
        if (it["@type"] === "Product" || (Array.isArray(it["@type"]) && it["@type"].includes("Product"))) {
          if (it.offers?.price) priceFromLd = parseFloat(String(it.offers.price));
          if (Array.isArray(it.offers) && it.offers[0]?.price) priceFromLd = parseFloat(String(it.offers[0].price));
          if (it.image) {
            const imgs = Array.isArray(it.image) ? it.image : [it.image];
            imageFromLd.push(...imgs.filter((x: any) => typeof x === "string"));
          }
          if (it.brand?.name) brandFromLd = it.brand.name;
          else if (typeof it.brand === "string") brandFromLd = it.brand;
          if (it.description) descFromLd = it.description;
        }
      }
    } catch {}
  });

  const priceText =
    cleanText($('[itemprop="price"]').attr("content")) ||
    cleanText($('[itemprop="price"]').text()) ||
    cleanText($('[class*="price"]:not([class*="old"]):not([class*="original"])').first().text());
  const price = priceFromLd || parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

  const description =
    descFromLd ||
    cleanText($('[itemprop="description"]').text()) ||
    cleanText($('[class*="product-description"]').first().text()) ||
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($("main").first().text()).slice(0, 3000);

  const specs: Record<string, string> = {};
  $('table tr, [class*="spec"] li, [class*="attribute"] li').each((_, row) => {
    const $row = $(row);
    const cells = $row.find("th, td");
    if (cells.length >= 2) {
      const k = cleanText($(cells[0]).text());
      const v = cleanText($(cells[1]).text());
      if (k && v && k.length < 50) specs[k] = v.slice(0, 200);
    }
  });

  const images = uniq([...imageFromLd, ...extractImagesFromCheerio($, url)]).slice(0, 30);

  if (!title) throw new Error("Generic: could not extract product details");

  return {
    title,
    description: description.slice(0, 5000),
    images,
    specifications: specs,
    price,
    brand: brandFromLd || undefined,
    platform: "generic",
    sourceUrl: url,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function scrapeProductFromUrl(url: string): Promise<ScrapedProduct> {
  validateSafeUrl(url);
  const platform = detectPlatform(url);

  const scrapers: Array<() => Promise<ScrapedProduct>> = [];
  switch (platform) {
    case "aliexpress":
      scrapers.push(() => httpScrapeAliExpress(url));
      break;
    case "amazon":
      scrapers.push(() => httpScrapeAmazon(url));
      break;
    case "temu":
      scrapers.push(() => httpScrapeTemu(url));
      break;
    case "cjdropshipping":
      scrapers.push(() => httpScrapeCJ(url));
      break;
    default:
      scrapers.push(() => httpScrapeGeneric(url));
  }
  // Always add generic fallback
  scrapers.push(() => httpScrapeGeneric(url));

  let lastErr: any;
  for (const scraper of scrapers) {
    try {
      const result = await scraper();
      if (result.title && (result.images.length > 0 || result.description)) {
        return result;
      }
      lastErr = new Error("Scraper returned empty result");
    } catch (e: any) {
      lastErr = e;
      console.warn(`[platformScrapers] ${platform} scraper failed:`, e?.message || e);
    }
  }

  throw new Error(
    `Could not extract product details from ${platform === "generic" ? "URL" : platform}. ` +
      `The page may be blocked, require JavaScript, or use heavy anti-bot protection. ` +
      `Try the "Notes / Manual" mode instead — paste the product name and description directly. ` +
      `(${lastErr?.message || "no details"})`,
  );
}
