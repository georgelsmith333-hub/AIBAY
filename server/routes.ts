import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { scrapeProduct } from "./services/scraper";
import {
  generateListingContent, calculateROAS, analyzeExistingListing, generateBulkListings,
} from "./services/aiRouter";
import { runArena, runFullAuto, scoreFullListing, MODEL_REGISTRY } from "./services/modelArena";
import { checkVero, checkVeroBatch } from "./services/veroChecker";
import { processImages } from "./services/imageProcessor";
import {
  getMarketAnalysis,
  getTrendingItems,
  turboScanCategory,
  getSellerProfile,
  getSellerListings,
  getCategoryStats,
  getKeywordCompetition,
  findCompletedItems,
  getEbayAppId,
  EBAY_CATEGORIES,
  MARKETPLACES,
  getRequiredSpecificsForCategory,
  getItemDetails,
  calculateEbayProfit,
  getEbaySoldSummary,
} from "./services/ebayApi";
import {
  generateKeywordSuggestions,
  generateScanVerdicts,
  scoreTitleSEO,
  extractItemSpecifics,
  suggestCategories,
  generateLifestylePrompts,
  scoreSupplierMatch,
  suggestMinSalePrice,
} from "./services/aiRouter";
import { isReplicateConfigured, upscaleImage, upscaleImageStrict, removeBackground, generateLifestyleImage, ReplicateApiError } from "./services/replicateService";
import { scrapeProductFromUrl, detectPlatform, validateSafeUrl, type ScrapedProduct } from "./services/platformScrapers";
import { searchSuppliers, buildSearchUrls } from "./services/supplierFinder";
import { z } from "zod";
import archiver from "archiver";
import axios from "axios";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Listing Generation ──────────────────────────────────────────────────────
  app.post(api.listings.generate.path, async (req, res) => {
    try {
      const { productUrl, titleOverride } = api.listings.generate.input.parse(req.body);
      const scrapedData = await scrapeProduct(productUrl);
      const aiContent = await generateListingContent(scrapedData, titleOverride || undefined);
      const processedImages = await processImages(scrapedData.images);

      const listing = await storage.createListing({
        productUrl,
        generatedTitle: aiContent.title,
        generatedHtml: aiContent.html_description,
        images: processedImages,
        rawData: scrapedData,
      });

      res.json(listing);
    } catch (error) {
      console.error("Generation failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  app.get(api.listings.list.path, async (req, res) => {
    const list = await storage.getListings();
    res.json(list);
  });

  app.get(api.listings.get.path, async (req, res) => {
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    res.json(listing);
  });

  app.get(api.listings.downloadImages.path, async (req, res) => {
    const listing = await storage.getListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment(`listing-${listing.id}-images.zip`);
    archive.pipe(res);

    for (let i = 0; i < listing.images.length; i++) {
      const imageUrl = listing.images[i];
      try {
        const response = await axios.get(imageUrl, { responseType: "stream" });
        const extension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
        archive.append(response.data, { name: `image-${i + 1}.${extension}` });
      } catch (_) {}
    }

    await archive.finalize();
  });

  // ─── Dashboard Stats ─────────────────────────────────────────────────────────
  app.get("/api/stats", async (req, res) => {
    try {
      const [totalListings, totalWatchlist, totalTrackedSellers, keywordSearchesToday] =
        await Promise.all([
          storage.getListingsCount(),
          storage.getWatchlistCount(),
          storage.getTrackedSellersCount(),
          storage.getKeywordSearchesToday(),
        ]);

      res.json({
        totalListings,
        totalWatchlist,
        totalTrackedSellers,
        keywordSearchesToday,
        ebayConfigured: !!getEbayAppId(),
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Health Check ────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── eBay Status ─────────────────────────────────────────────────────────────
  app.get("/api/ebay/status", (req, res) => {
    res.json({ configured: !!getEbayAppId() });
  });

  app.get("/api/ebay/categories", (req, res) => {
    res.json({ categories: EBAY_CATEGORIES, marketplaces: MARKETPLACES });
  });

  // ─── Market Research ─────────────────────────────────────────────────────────
  app.get("/api/ebay/search", async (req, res) => {
    try {
      const keyword = String(req.query.keyword || "");
      const marketplace = String(req.query.marketplace || "EBAY-US");
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
      const timeRange = req.query.timeRange ? String(req.query.timeRange) : "all";

      if (!keyword.trim()) return res.status(400).json({ message: "keyword is required" });

      const analysis = await getMarketAnalysis(keyword, { marketplace, categoryId, timeRange });

      // Save search history
      await storage.createKeywordSearch({ query: keyword, marketplace, results: analysis }).catch(() => {});

      res.json(analysis);
    } catch (error) {
      console.error("Market research error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Trending Items ──────────────────────────────────────────────────────────
  app.get("/api/ebay/trending", async (req, res) => {
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
    const marketplace = String(req.query.marketplace || "EBAY-US");
    const sortMode = String(req.query.sortMode || "watchCount");
    const timeRange = String(req.query.timeRange || "all");
    try {
      const items = await getTrendingItems(categoryId, marketplace, sortMode, timeRange);
      res.json({ items, source: "live" });
    } catch (error) {
      // Never crash — return structured demo data so frontend always renders
      console.warn("Trending live fetch failed, returning demo data:", error instanceof Error ? error.message : String(error));
      const { generateDemoSearchResult } = await import("./services/ebayApi");
      const demo = generateDemoSearchResult("trending electronics", false, 30, categoryId);
      const demoItems = demo.items.map((it, i) => ({
        ...it,
        trendDirection: (["up", "up", "neutral", "down"] as const)[i % 4],
        trendScore: Math.max(15, 95 - i * 2),
        isDemo: true,
      }));
      res.json({ items: demoItems, source: "demo", message: "Using sample data — live eBay API unavailable" });
    }
  });

  // ─── Completed (Sold) Items ──────────────────────────────────────────────────
  app.get("/api/ebay/completed", async (req, res) => {
    try {
      const keyword = String(req.query.keyword || "");
      const marketplace = String(req.query.marketplace || "EBAY-US");
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;

      if (!keyword.trim()) return res.status(400).json({ message: "keyword is required" });

      const result = await findCompletedItems(keyword, { marketplace, categoryId, minPrice, pageSize });
      res.json(result);
    } catch (error) {
      console.error("Completed items error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Turbo Scanner ───────────────────────────────────────────────────────────
  app.get("/api/ebay/turbo-scan", async (req, res) => {
    try {
      const categoryId = String(req.query.categoryId || "293");
      const marketplace = String(req.query.marketplace || "EBAY-US");
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
      const condition = req.query.condition ? String(req.query.condition) : undefined;

      const result = await turboScanCategory(categoryId, { marketplace, minPrice, maxPrice, condition });

      // Generate AI verdicts for top items
      const verdictInput = result.items.slice(0, 20).map(i => ({
        title: i.title,
        price: i.price,
        watchCount: i.watchCount,
      }));
      const verdicts = await generateScanVerdicts(verdictInput).catch(() => ({} as Record<string, string>));

      const itemsWithVerdicts = result.items.map((item, idx) => ({
        ...item,
        verdict: verdicts[idx] || null,
      }));

      res.json({ ...result, items: itemsWithVerdicts });
    } catch (error) {
      console.error("Turbo scan error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Seller Profile ──────────────────────────────────────────────────────────
  app.get("/api/ebay/seller/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const marketplace = String(req.query.marketplace || "EBAY-US");

      const profile = await getSellerProfile(username, marketplace);

      // Save/update in DB
      const existing = await storage.getTrackedSeller(username).catch(() => undefined);
      const sellerData = {
        username,
        feedbackScore: profile.feedbackScore,
        positiveFeedbackPercent: String(profile.positiveFeedbackPercent),
        totalListings: profile.totalListings,
        topCategories: profile.topCategories.map((c) => c.name),
        avgPrice: String(profile.avgPrice.toFixed(2)),
        snapshotData: profile,
        lastCheckedAt: new Date(),
      };
      if (!existing) {
        await storage.createTrackedSeller(sellerData).catch(() => {});
      } else {
        await storage.updateTrackedSeller(existing.id, sellerData).catch(() => {});
      }

      res.json(profile);
    } catch (error) {
      console.error("Seller profile error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Seller Listings (paginated) ────────────────────────────────────────────
  app.get("/api/ebay/seller/:username/listings", async (req, res) => {
    try {
      const { username } = req.params;
      const marketplace = String(req.query.marketplace || "EBAY-US");
      const page = req.query.page ? Number(req.query.page) : 1;
      const result = await getSellerListings(username, page, marketplace);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Category Stats ──────────────────────────────────────────────────────────
  app.get("/api/ebay/category/:categoryId/stats", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const marketplace = String(req.query.marketplace || "EBAY-US");
      const stats = await getCategoryStats(categoryId, marketplace);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Keyword Research ────────────────────────────────────────────────────────
  app.post("/api/keywords/research", async (req, res) => {
    try {
      const { keyword, marketplace = "EBAY-US" } = req.body;
      if (!keyword?.trim()) return res.status(400).json({ message: "keyword is required" });

      // Generate AI keyword variations
      const aiKeywords = await generateKeywordSuggestions(keyword);

      // Get competition data for each keyword (top 5 only to avoid rate limits)
      // aiKeywords.keywords is string[] — each kw is a plain string
      const competitionData = await Promise.allSettled(
        aiKeywords.keywords.slice(0, 5).map((kw: string) =>
          getKeywordCompetition(kw, marketplace)
        )
      );

      const enriched = aiKeywords.keywords.map((kw: string, idx: number) => ({
        keyword: kw,
        competition:
          competitionData[idx]?.status === "fulfilled"
            ? (competitionData[idx] as PromiseFulfilledResult<unknown>).value
            : { activeCount: 0, soldCount: 0, avgPrice: 0 },
      }));

      await storage.createKeywordSearch({ query: keyword, marketplace, results: enriched }).catch(() => {});

      res.json({ keywords: enriched, titleTemplate: aiKeywords.titleTemplate });
    } catch (error) {
      console.error("Keyword research error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Watchlist ────────────────────────────────────────────────────────────────
  app.get("/api/watchlist", async (req, res) => {
    const items = await storage.getWatchlistItems();
    res.json(items);
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const item = await storage.createWatchlistItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    await storage.deleteWatchlistItem(Number(req.params.id));
    res.json({ success: true });
  });

  // ─── Tracked Sellers ──────────────────────────────────────────────────────────
  app.get("/api/tracked-sellers", async (req, res) => {
    const sellers = await storage.getTrackedSellers();
    res.json(sellers);
  });

  app.post("/api/tracked-sellers", async (req, res) => {
    try {
      const { username, feedbackScore, positiveFeedbackPercent, totalListings, avgPrice, topCategories } = req.body;
      if (!username) return res.status(400).json({ message: "username is required" });
      const existing = await storage.getTrackedSeller(String(username)).catch(() => undefined);
      const sellerData = {
        username: String(username),
        feedbackScore: Number(feedbackScore) || 0,
        positiveFeedbackPercent: String(Number(positiveFeedbackPercent) || 0),
        totalListings: Number(totalListings) || 0,
        avgPrice: String(avgPrice || "0"),
        topCategories: Array.isArray(topCategories) ? topCategories.map((c: { name: string }) => c.name) : [],
      };
      if (!existing) {
        const created = await storage.createTrackedSeller(sellerData);
        return res.json(created);
      } else {
        const updated = await storage.updateTrackedSeller(existing.id, sellerData);
        return res.json(updated);
      }
    } catch (error) {
      console.error("Track seller error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.delete("/api/tracked-sellers/:id", async (req, res) => {
    await storage.deleteTrackedSeller(Number(req.params.id));
    res.json({ success: true });
  });

  // ─── Recent Keyword Searches ───────────────────────────────────────────────────
  app.get("/api/keywords/history", async (req, res) => {
    const searches = await storage.getKeywordSearches(10);
    res.json(searches);
  });

  // ─── AI Listing Engine 2.0 ───────────────────────────────────────────────────

  // Scrape + AI pipeline with enhanced data (item specifics, categories, title score)
  app.post("/api/optimize", async (req, res) => {
    try {
      const { productUrl, titleOverride } = z.object({
        productUrl: z.string().url(),
        titleOverride: z.string().max(80).optional(),
      }).parse(req.body);

      const scrapedData = await scrapeProductFromUrl(productUrl);
      const aiContent = await generateListingContent(scrapedData, titleOverride || undefined);
      const rawImages = await processImages(scrapedData.images);

      const productText = (scrapedData.description || "") + " " + Object.entries(scrapedData.specifications || {}).map(([k, v]) => `${k}: ${v}`).join(" ");

      const [titleScoreResult, categoriesResult, lifestylePrompts] = await Promise.all([
        scoreTitleSEO(aiContent.title),
        suggestCategories(aiContent.title, scrapedData.description || ""),
        generateLifestylePrompts(aiContent.title, scrapedData.description || ""),
      ]);

      const itemSpecificsFixed = await extractItemSpecifics(
        productText,
        categoriesResult?.[0]?.name || "General",
        scrapedData.specifications || {}
      ).catch(() => []);

      // Run Replicate image pipeline in parallel (graceful degradation when token absent)
      const { upscaleImagesBatch: upscaleBatch } = await import("./services/replicateService");
      const upscaleResults = await upscaleBatch(rawImages.slice(0, 30));
      const finalImageUrls = upscaleResults.map(r => r.upscaledUrl);
      const processedImageMeta = upscaleResults.map(r => ({
        original: r.url,
        processed: r.upscaledUrl,
        status: r.status,
      }));

      // Generate up to 3 lifestyle images (graceful degradation)
      const lifestyleImageUrls: string[] = [];
      if (isReplicateConfigured() && lifestylePrompts.length > 0) {
        const top3 = lifestylePrompts.slice(0, 3);
        const settled = await Promise.allSettled(top3.map(p => generateLifestyleImage(p)));
        settled.forEach(r => {
          if (r.status === "fulfilled") lifestyleImageUrls.push(r.value);
        });
      }

      const listing = await storage.createListing({
        productUrl,
        generatedTitle: aiContent.title,
        generatedHtml: aiContent.html_description,
        images: finalImageUrls,
        rawData: scrapedData,
        itemSpecifics: itemSpecificsFixed,
        suggestedCategories: categoriesResult,
        titleScore: titleScoreResult,
        processedImages: processedImageMeta,
        lifestyleImages: lifestyleImageUrls,
        sourceData: {
          platform: scrapedData.platform,
          price: scrapedData.price,
          brand: scrapedData.brand,
          categoryBreadcrumb: scrapedData.categoryBreadcrumb,
          lifestylePrompts,
        },
      });

      res.json(listing);
    } catch (error) {
      console.error("Optimize failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  // Manual input: generate listing from typed product info (no URL needed)
  app.post("/api/optimize/manual", async (req, res) => {
    try {
      const { productName, description, notes, category, imageUrls, titleOverride } = z.object({
        productName: z.string().min(2).max(200),
        description: z.string().max(5000).optional().default(""),
        notes: z.string().max(2000).optional().default(""),
        category: z.string().max(100).optional().default(""),
        imageUrls: z.array(z.string().url()).max(20).optional().default([]),
        titleOverride: z.string().max(80).optional(),
      }).parse(req.body);

      const fullDescription = [
        description,
        notes ? `Additional context: ${notes}` : "",
        category ? `Category: ${category}` : "",
      ].filter(Boolean).join("\n\n");

      const scrapedData = {
        title: productName,
        description: fullDescription,
        images: imageUrls,
        specifications: category ? ({ Category: category } as Record<string, string>) : ({} as Record<string, string>),
        platform: "manual" as const,
        sourceUrl: `manual://input/${Date.now()}`,
        brand: "",
        categoryBreadcrumb: category || undefined,
      };

      const aiContent = await generateListingContent(scrapedData, titleOverride || undefined);
      const rawImages = imageUrls.length > 0 ? await processImages(imageUrls) : [];

      const [titleScoreResult, categoriesResult, lifestylePrompts] = await Promise.all([
        scoreTitleSEO(aiContent.title),
        suggestCategories(aiContent.title, fullDescription),
        generateLifestylePrompts(aiContent.title, fullDescription),
      ]);

      const itemSpecificsFixed = await extractItemSpecifics(
        fullDescription,
        categoriesResult?.[0]?.name || category || "General",
        scrapedData.specifications
      ).catch(() => []);

      const { upscaleImagesBatch: upscaleBatch } = await import("./services/replicateService");
      const upscaleResults = await upscaleBatch(rawImages.slice(0, 10));
      const finalImageUrls = upscaleResults.map(r => r.upscaledUrl);

      const listing = await storage.createListing({
        productUrl: scrapedData.sourceUrl,
        generatedTitle: aiContent.title,
        generatedHtml: aiContent.html_description,
        images: finalImageUrls,
        rawData: scrapedData,
        itemSpecifics: itemSpecificsFixed,
        suggestedCategories: categoriesResult,
        titleScore: titleScoreResult,
        processedImages: [],
        lifestyleImages: [],
        sourceData: {
          platform: "manual",
          price: undefined,
          brand: undefined,
          categoryBreadcrumb: category || undefined,
          lifestylePrompts,
        },
      });

      res.json(listing);
    } catch (error) {
      console.error("Manual optimize failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  // Bulk optimize: start a job
  app.post("/api/optimize/bulk", async (req, res) => {
    try {
      const { urls } = z.object({ urls: z.array(z.string().url()).min(1).max(25) }).parse(req.body);
      const job = await storage.createBulkJob({
        status: "processing",
        totalUrls: urls.length,
        completedCount: 0,
        failedCount: 0,
        results: [],
      });

      // Process in background
      (async () => {
        const results: { url: string; listingId?: number; error?: string }[] = [];
        let completed = 0;
        let failed = 0;

        const { upscaleImagesBatch: bulkUpscaleBatch } = await import("./services/replicateService");

        for (const productUrl of urls) {
          try {
            validateSafeUrl(productUrl);
            const scrapedData = await scrapeProductFromUrl(productUrl);
            const aiContent = await generateListingContent(scrapedData, undefined);
            const rawImages = await processImages(scrapedData.images);
            const bulkText = (scrapedData.description || "") + " " + Object.entries(scrapedData.specifications || {}).map(([k, v]) => `${k}: ${v}`).join(" ");

            // Replicate pipeline (limit 4 images per listing in bulk for throughput)
            const upscaleResults = await bulkUpscaleBatch(rawImages.slice(0, 4));
            const finalImageUrls = upscaleResults.map(r => r.upscaledUrl);
            const processedImageMeta = upscaleResults.map(r => ({ original: r.url, processed: r.upscaledUrl, status: r.status }));

            const [titleScore, categories, lifestylePrompts] = await Promise.all([
              scoreTitleSEO(aiContent.title),
              suggestCategories(aiContent.title, scrapedData.description || ""),
              generateLifestylePrompts(aiContent.title, scrapedData.description || ""),
            ]);
            const itemSpecifics = await extractItemSpecifics(
              bulkText,
              categories?.[0]?.name || "General",
              scrapedData.specifications || {}
            );

            const lifestyleImageUrls: string[] = [];
            if (isReplicateConfigured() && lifestylePrompts.length > 0) {
              const settled = await Promise.allSettled(lifestylePrompts.slice(0, 2).map(p => generateLifestyleImage(p)));
              settled.forEach(r => { if (r.status === "fulfilled") lifestyleImageUrls.push(r.value); });
            }

            const listing = await storage.createListing({
              productUrl,
              generatedTitle: aiContent.title,
              generatedHtml: aiContent.html_description,
              images: finalImageUrls,
              rawData: scrapedData,
              itemSpecifics,
              suggestedCategories: categories,
              titleScore,
              processedImages: processedImageMeta,
              lifestyleImages: lifestyleImageUrls,
              sourceData: { platform: scrapedData.platform, price: scrapedData.price, brand: scrapedData.brand, categoryBreadcrumb: scrapedData.categoryBreadcrumb, lifestylePrompts },
              bulkGroupId: String(job.id),
            });
            results.push({ url: productUrl, listingId: listing.id });
            completed++;
          } catch (err) {
            results.push({ url: productUrl, error: err instanceof Error ? err.message : "Failed" });
            failed++;
          }
          await storage.updateBulkJob(job.id, {
            completedCount: completed,
            failedCount: failed,
            results,
          });
        }
        await storage.updateBulkJob(job.id, { status: "done", completedCount: completed, failedCount: failed, results });
      })();

      res.json({ jobId: job.id });
    } catch (error) {
      console.error("Bulk optimize failed:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Poll bulk job status
  app.get("/api/optimize/bulk/:jobId", async (req, res) => {
    const job = await storage.getBulkJob(Number(req.params.jobId));
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });

  // Score a title
  app.post("/api/title/score", async (req, res) => {
    try {
      const { title } = z.object({ title: z.string().min(3).max(200) }).parse(req.body);
      const score = await scoreTitleSEO(title);
      res.json(score);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Update listing item specifics
  app.patch("/api/listings/:id/specifics", async (req, res) => {
    try {
      const { specifics } = z.object({ specifics: z.array(z.object({ name: z.string(), value: z.string(), source: z.string() })) }).parse(req.body);
      const listing = await storage.updateListing(Number(req.params.id), { itemSpecifics: specifics });
      res.json(listing);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  function handleReplicateError(error: unknown, res: import("express").Response) {
    if (error instanceof ReplicateApiError) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
  }

  // Upscale image via Replicate
  app.post("/api/images/upscale", async (req, res) => {
    try {
      if (!isReplicateConfigured()) {
        return res.status(402).json({ message: "REPLICATE_API_TOKEN not configured" });
      }
      const { imageUrl } = z.object({ imageUrl: z.string().url() }).parse(req.body);
      const upscaledUrl = await upscaleImageStrict(imageUrl);
      res.json({ upscaledUrl });
    } catch (error) {
      handleReplicateError(error, res);
    }
  });

  // Remove background via Replicate
  app.post("/api/images/remove-bg", async (req, res) => {
    try {
      if (!isReplicateConfigured()) {
        return res.status(402).json({ message: "REPLICATE_API_TOKEN not configured" });
      }
      const { imageUrl } = z.object({ imageUrl: z.string().url() }).parse(req.body);
      const resultUrl = await removeBackground(imageUrl);
      res.json({ resultUrl });
    } catch (error) {
      handleReplicateError(error, res);
    }
  });

  // Generate lifestyle image via Replicate SDXL
  app.post("/api/images/lifestyle", async (req, res) => {
    try {
      if (!isReplicateConfigured()) {
        return res.status(402).json({ message: "REPLICATE_API_TOKEN not configured" });
      }
      const { prompt } = z.object({ prompt: z.string().min(5).max(500) }).parse(req.body);
      const imageUrl = await generateLifestyleImage(prompt);
      res.json({ imageUrl });
    } catch (error) {
      handleReplicateError(error, res);
    }
  });

  // ─── eBay Seller Hub CSV helper ─────────────────────────────────────────────

  function buildEbaySellerHubCSV(listingRows: { id: number; generatedTitle: string; generatedHtml: string; images: string[]; itemSpecifics: unknown; suggestedCategories: unknown; sourceData?: unknown }[]): string {
    const FIXED_HEADERS = [
      "Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
      "Category", "Title", "ConditionID", "Quantity", "StartPrice",
      "BuyItNowPrice", "Duration", "Description", "PicURL",
      "Country", "Currency", "DispatchTimeMax", "ShippingType",
      "UPC", "SKU",
    ];

    // Collect all unique item-specific names across rows
    const allSpecNames = new Set<string>();
    listingRows.forEach(l => {
      const specs = (l.itemSpecifics as { name: string; value: string }[] | null) || [];
      specs.forEach(s => allSpecNames.add(s.name));
    });
    const specNames = Array.from(allSpecNames);
    const headers = [...FIXED_HEADERS, ...specNames];

    function csvVal(v: string | number | null | undefined): string {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    }

    const rows = listingRows.map(listing => {
      const specifics = (listing.itemSpecifics as { name: string; value: string }[] | null) || [];
      const categories = (listing.suggestedCategories as { categoryId: string; name: string }[] | null) || [];
      const sd = listing.sourceData as { price?: number; currency?: string } | null;
      const specsMap = Object.fromEntries(specifics.map(s => [s.name, s.value]));
      const picUrls = (listing.images || []).slice(0, 12).join("|");
      const categoryId = categories[0]?.categoryId || "";
      const htmlTruncated = (listing.generatedHtml || "").slice(0, 10000);
      // Derive start price: use scraped price rounded to 2 decimal places, or blank if unavailable
      const startPrice = sd?.price && sd.price > 0 ? sd.price.toFixed(2) : "";

      const fixed = [
        csvVal("AddItem"),
        csvVal(categoryId),
        csvVal(listing.generatedTitle),
        csvVal("1000"),
        csvVal("1"),
        csvVal(startPrice),
        csvVal(""),
        csvVal("GTC"),
        csvVal(htmlTruncated),
        csvVal(picUrls),
        csvVal("US"),
        csvVal("USD"),
        csvVal("1"),
        csvVal("Flat"),
        csvVal(""),
        csvVal(`AIBAY-${listing.id}`),
      ];
      const specCols = specNames.map(n => csvVal(specsMap[n] ?? ""));
      return [...fixed, ...specCols].join(",");
    });

    return [headers.map(h => csvVal(h)).join(","), ...rows].join("\n");
  }

  // Export single listing to eBay Seller Hub CSV
  app.get("/api/listings/:id/export-csv", async (req, res) => {
    try {
      const listing = await storage.getListing(Number(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const csv = buildEbaySellerHubCSV([listing]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="listing-${listing.id}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Export all listings from a bulk job as eBay Seller Hub CSV
  app.get("/api/optimize/bulk/:jobId/export-csv", async (req, res) => {
    try {
      const job = await storage.getBulkJob(Number(req.params.jobId));
      if (!job) return res.status(404).json({ message: "Job not found" });

      const results = (job.results as { url: string; listingId?: number; error?: string }[] | null) || [];
      const listingIds = results.filter(r => r.listingId).map(r => r.listingId!);

      if (!listingIds.length) {
        return res.status(400).json({ message: "No completed listings in this job" });
      }

      const listings = await Promise.all(listingIds.map(id => storage.getListing(id)));
      const valid = listings.filter(Boolean) as NonNullable<(typeof listings)[number]>[];

      const csv = buildEbaySellerHubCSV(valid);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="bulk-job-${job.id}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Alias: shorter path for bulk CSV (matches the task spec GET /api/bulk/:jobId/export-csv)
  app.get("/api/bulk/:jobId/export-csv", async (req, res) => {
    try {
      const job = await storage.getBulkJob(Number(req.params.jobId));
      if (!job) return res.status(404).json({ message: "Job not found" });
      const results = (job.results as { url: string; listingId?: number; error?: string }[] | null) || [];
      const listingIds = results.filter(r => r.listingId).map(r => r.listingId!);
      if (!listingIds.length) return res.status(400).json({ message: "No completed listings in this job" });
      const listings = await Promise.all(listingIds.map(id => storage.getListing(id)));
      const valid = listings.filter(Boolean) as NonNullable<(typeof listings)[number]>[];
      const csv = buildEbaySellerHubCSV(valid);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="bulk-job-${job.id}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ZIP download of all processed images for a listing
  app.get("/api/listings/:id/images-zip", async (req, res) => {
    try {
      const listing = await storage.getListing(Number(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const processedMeta = (listing.processedImages as { original: string; processed: string; status: string }[] | null);
      const imageUrls: { url: string; label: string }[] = [];

      if (processedMeta && processedMeta.length > 0) {
        processedMeta.forEach((m, i) => {
          imageUrls.push({ url: m.processed || m.original, label: `image-${i + 1}-processed` });
          if (m.original !== m.processed) {
            imageUrls.push({ url: m.original, label: `image-${i + 1}-original` });
          }
        });
      } else {
        listing.images.forEach((url, i) => imageUrls.push({ url, label: `image-${i + 1}` }));
      }

      const lifestyleImages = listing.lifestyleImages || [];
      lifestyleImages.forEach((url, i) => imageUrls.push({ url, label: `lifestyle-${i + 1}` }));

      const archive = archiver("zip", { zlib: { level: 6 } });
      res.attachment(`listing-${listing.id}-images.zip`);
      archive.pipe(res);

      for (const { url, label } of imageUrls) {
        try {
          validateSafeUrl(url); // SSRF protection — skip internal/private URLs
          const response = await axios.get(url, { responseType: "stream", timeout: 15000 });
          const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 4);
          archive.append(response.data, { name: `${label}.${ext}` });
        } catch { /* skip undownloadable or blocked images */ }
      }

      await archive.finalize();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Update image metadata (hero, exclude, label) for a listing
  app.patch("/api/listings/:id/images", async (req, res) => {
    try {
      const { imageMetadata } = z.object({
        imageMetadata: z.array(z.object({
          url: z.string(),
          label: z.string().optional(),
          isHero: z.boolean().optional(),
          isExcluded: z.boolean().optional(),
          originalIndex: z.number().optional(),
        })),
      }).parse(req.body);
      const listing = await storage.updateListing(Number(req.params.id), { imageMetadata });
      res.json(listing);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Validate item specifics against eBay Taxonomy required fields
  app.post("/api/listings/:id/validate-specifics", async (req, res) => {
    try {
      const listing = await storage.getListing(Number(req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const categories = (listing.suggestedCategories as { categoryId: string; name: string }[] | null) || [];
      const specifics = (listing.itemSpecifics as { name: string; value: string }[] | null) || [];

      if (categories.length === 0) {
        return res.json({ required: [], recommended: [], missing: [], configured: false, reason: "No category suggestions available — generate the listing first." });
      }

      const topCategoryId = categories[0].categoryId;
      const result = await getRequiredSpecificsForCategory(topCategoryId, specifics);
      if (!result.configured) {
        return res.json({ ...result, reason: "eBay validation requires EBAY_APP_ID. Configure it in settings to unlock taxonomy validation." });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Validation failed" });
    }
  });

  // Update listing fields (generatedHtml, generatedTitle, etc.)
  app.patch("/api/listings/:id", async (req, res) => {
    try {
      const updates = z.object({
        generatedHtml: z.string().optional(),
        generatedTitle: z.string().max(80).optional(),
      }).parse(req.body);
      const listing = await storage.updateListing(Number(req.params.id), updates);
      res.json(listing);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Replicate status check
  app.get("/api/images/replicate-status", async (_req, res) => {
    res.json({ configured: isReplicateConfigured() });
  });

  // ─── eBay Item Details (Shopping API GetSingleItem) ─────────────────────
  app.get("/api/ebay/item/:itemId", async (req, res) => {
    try {
      const detail = await getItemDetails(req.params.itemId);
      if (!detail) return res.status(404).json({ message: "Item not found or EBAY_APP_ID not configured" });
      res.json(detail);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch item" });
    }
  });

  // ─── eBay Sold Summary (for supplier cross-reference) ─────────────────────
  app.get("/api/ebay/sold-summary", async (req, res) => {
    try {
      const keyword = String(req.query.q || "").trim();
      const marketplace = String(req.query.marketplace || "EBAY-US");
      if (!keyword) return res.status(400).json({ message: "Keyword required" });
      const summary = await getEbaySoldSummary(keyword, marketplace);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch sold summary" });
    }
  });

  // ─── Profit Calculator (GET — simple cross-reference) ─────────────────────
  app.get("/api/profit/calculate", async (req, res) => {
    try {
      const schema = z.object({
        costPrice: z.coerce.number().min(0),
        sellingPrice: z.coerce.number().min(0),
        shippingCost: z.coerce.number().min(0).default(0),
        marketplace: z.string().default("EBAY-US"),
        international: z.coerce.boolean().default(false),
      });
      const params = schema.parse(req.query);
      const result = calculateEbayProfit(
        params.costPrice,
        params.sellingPrice,
        params.shippingCost,
        params.marketplace,
        params.international
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid parameters" });
    }
  });

  // ─── Supplier Finder (legacy GET) ─────────────────────────────────────────
  app.get("/api/supplier/search", async (req, res) => {
    try {
      const keyword = String(req.query.q || "").trim();
      if (!keyword || keyword.length < 2) {
        return res.status(400).json({ message: "Search keyword required (min 2 chars)" });
      }
      if (keyword.length > 120) {
        return res.status(400).json({ message: "Keyword too long (max 120 chars)" });
      }
      const result = await searchSuppliers(keyword);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Supplier search failed" });
    }
  });

  app.get("/api/supplier/urls", async (req, res) => {
    try {
      const keyword = String(req.query.q || "").trim();
      if (!keyword) return res.status(400).json({ message: "Keyword required" });
      res.json({ urls: buildSearchUrls(keyword), keyword });
    } catch (error) {
      res.status(500).json({ message: "Failed to build search URLs" });
    }
  });

  // ─── Supplier Intelligence (POST with AI scoring + history) ───────────────
  app.post("/api/supplier/search", async (req, res) => {
    try {
      const { query } = z.object({ query: z.string().min(2).max(120) }).parse(req.body);
      const rawResult = await searchSuppliers(query);

      // Flatten all results and add AI match scores
      const allProducts = [
        ...rawResult.amazon.map(p => ({ ...p, platform: "amazon" as const })),
        ...rawResult.aliexpress.map(p => ({ ...p, platform: "aliexpress" as const })),
        ...rawResult.temu.map(p => ({ ...p, platform: "temu" as const })),
      ];

      const scored = await Promise.all(
        allProducts.map(async (product) => {
          const matchScore = await scoreSupplierMatch(query, product).catch(() => ({ score: 50, reason: "Score unavailable" }));
          return { ...product, matchScore };
        })
      );

      scored.sort((a, b) => b.matchScore.score - a.matchScore.score);
      if (scored.length > 0) scored[0] = { ...scored[0], isRecommended: true } as any;

      const result = {
        query,
        results: scored,
        searchUrls: rawResult.searchUrls,
        scrapedAt: rawResult.scrapedAt,
        totalCount: scored.length,
      };

      await storage.createSupplierSearch({
        query,
        results: result,
        resultCount: scored.length,
      }).catch(() => {});

      res.json(result);
    } catch (error) {
      console.error("Supplier search error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Supplier search failed" });
    }
  });

  app.get("/api/supplier/history", async (req, res) => {
    try {
      const history = await storage.getSupplierSearchHistory(15);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Profit Calculator ────────────────────────────────────────────────────
  app.post("/api/profit/calculate", async (req, res) => {
    try {
      const inputs = z.object({
        itemCost: z.number().min(0),
        salePrice: z.number().min(0),
        shippingCharged: z.number().min(0).default(0),
        actualShippingCost: z.number().min(0).default(0),
        paymentMethod: z.enum(["managed", "standard"]).default("managed"),
        storePlan: z.enum(["none", "basic", "premium", "anchor"]).default("none"),
        categoryKey: z.string().default("general"),
        promotedListingPct: z.number().min(0).max(20).default(0),
        quantity: z.number().int().min(1).default(1),
        targetMarginPct: z.number().min(0).max(100).default(30),
      }).parse(req.body);

      // eBay FVF by category (March 2025 schedule)
      const FVF_RATES: Record<string, number> = {
        general: 0.1235,
        electronics: 0.0985,
        computers: 0.0985,
        cameras: 0.0985,
        clothing: 0.1535,
        shoes: 0.1535,
        jewelry: 0.1535,
        automotive: 0.1035,
        books: 0.1485,
        music: 0.1485,
        dvd: 0.1485,
        toys: 0.1235,
        sports: 0.1235,
        home: 0.1235,
        garden: 0.1235,
        health: 0.1535,
        beauty: 0.1535,
        baby: 0.1535,
      };

      const fvfRate = FVF_RATES[inputs.categoryKey] ?? 0.1235;
      const fvfCap = 750;
      const totalRevenue = inputs.salePrice + inputs.shippingCharged;

      // eBay Final Value Fee (on sale price + shipping, capped at $750)
      const ebayFvf = Math.min(totalRevenue * fvfRate, fvfCap);

      // Store plan insertion fee (simplified — first 250 free for basic+)
      const insertionFee = inputs.storePlan === "none" ? 0.35 : 0;

      // Payment processing (Managed Payments: 2.87% + $0.30)
      const paymentFee = inputs.paymentMethod === "managed"
        ? totalRevenue * 0.0287 + 0.30
        : totalRevenue * 0.0287 + 0.30;

      // Promoted listings fee
      const promotedFee = inputs.salePrice * (inputs.promotedListingPct / 100);

      const totalFees = ebayFvf + insertionFee + paymentFee + promotedFee;
      const netProfit = inputs.salePrice + inputs.shippingCharged - inputs.itemCost - inputs.actualShippingCost - totalFees;
      const profitMarginPct = inputs.salePrice > 0 ? (netProfit / inputs.salePrice) * 100 : 0;
      const roi = inputs.itemCost > 0 ? (netProfit / inputs.itemCost) * 100 : 0;

      // Break-even sale price (net profit = 0)
      const beDivisor = 1 - fvfRate - 0.0287 - (inputs.promotedListingPct / 100);
      const breakEvenSalePrice = beDivisor > 0
        ? (inputs.itemCost + inputs.actualShippingCost + insertionFee + 0.30) / beDivisor
        : inputs.itemCost * 2;

      // Min sale price for target margin
      const marginAdvice = await suggestMinSalePrice(inputs.itemCost, inputs.targetMarginPct, inputs.categoryKey).catch(() => null);

      const breakdown = {
        ebayFvf,
        insertionFee,
        paymentFee,
        promotedFee,
        totalFees,
        netProfit,
        profitMarginPct,
        roi,
        breakEvenSalePrice,
        marginAdvice,
        // Batch totals
        batchNetProfit: netProfit * inputs.quantity,
        batchTotalRevenue: totalRevenue * inputs.quantity,
        batchTotalFees: totalFees * inputs.quantity,
      };

      res.json({ inputs, breakdown });
    } catch (error) {
      console.error("Profit calc error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Calculation error" });
    }
  });

  app.post("/api/profit/save", async (req, res) => {
    try {
      const { name, inputs, outputs } = z.object({
        name: z.string().min(1).max(100).default("Untitled Scenario"),
        inputs: z.any(),
        outputs: z.any(),
      }).parse(req.body);
      const scenario = await storage.createProfitScenario({ name, inputs, outputs });
      res.json(scenario);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.get("/api/profit/scenarios", async (req, res) => {
    const scenarios = await storage.getProfitScenarios();
    res.json(scenarios);
  });

  app.delete("/api/profit/scenarios/:id", async (req, res) => {
    await storage.deleteProfitScenario(Number(req.params.id));
    res.json({ success: true });
  });

  // ─── Templates ────────────────────────────────────────────────────────────
  app.get("/api/templates", async (req, res) => {
    const tmplList = await storage.getTemplates();
    res.json(tmplList);
  });

  app.get("/api/templates/default", async (req, res) => {
    const tmpl = await storage.getDefaultTemplate();
    res.json(tmpl || null);
  });

  app.get("/api/templates/:id", async (req, res) => {
    const tmpl = await storage.getTemplate(Number(req.params.id));
    if (!tmpl) return res.status(404).json({ message: "Template not found" });
    res.json(tmpl);
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const data = z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        blocks: z.any(),
        isDefault: z.boolean().optional(),
      }).parse(req.body);
      const tmpl = await storage.createTemplate({ ...data, versions: [] });
      res.json(tmpl);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getTemplate(id);
      if (!existing) return res.status(404).json({ message: "Template not found" });

      const data = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        blocks: z.any().optional(),
        isDefault: z.boolean().optional(),
      }).parse(req.body);

      // Save version snapshot (keep max 20)
      const currentVersions = (existing.versions as any[] | null) || [];
      const newVersion = {
        savedAt: new Date().toISOString(),
        name: existing.name,
        blocks: existing.blocks,
      };
      const updatedVersions = [newVersion, ...currentVersions].slice(0, 20);

      const tmpl = await storage.updateTemplate(id, { ...data, versions: updatedVersions });
      res.json(tmpl);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    await storage.deleteTemplate(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/templates/:id/set-default", async (req, res) => {
    try {
      const tmpl = await storage.setDefaultTemplate(Number(req.params.id));
      res.json(tmpl);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.post("/api/templates/:id/restore-version", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { versionIndex } = z.object({ versionIndex: z.number().int().min(0) }).parse(req.body);
      const existing = await storage.getTemplate(id);
      if (!existing) return res.status(404).json({ message: "Template not found" });
      const versions = (existing.versions as any[] | null) || [];
      const version = versions[versionIndex];
      if (!version) return res.status(404).json({ message: "Version not found" });
      const tmpl = await storage.updateTemplate(id, { blocks: version.blocks, name: version.name });
      res.json(tmpl);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── Watchlist Refresh ────────────────────────────────────────────────────
  app.post("/api/watchlist/:id/refresh", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const item = await storage.getWatchlistItem(id);
      if (!item) return res.status(404).json({ message: "Watchlist item not found" });

      const keyword = item.searchKeyword || item.productTitle;
      let currentAvgPrice: string | null = null;
      let sellThroughRate: string | null = null;

      try {
        const analysis = await getMarketAnalysis(keyword, { marketplace: item.marketplace || "EBAY-US" });
        if (analysis?.avgActivePrice) currentAvgPrice = String(analysis.avgActivePrice.toFixed(2));
        if (analysis?.sellThroughRate) sellThroughRate = String(analysis.sellThroughRate.toFixed(2));
      } catch {}

      const updated = await storage.updateWatchlistItem(id, {
        currentAvgPrice: currentAvgPrice ?? undefined,
        sellThroughRate: sellThroughRate ?? undefined,
        lastCheckedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Refresh all watchlist items
  app.post("/api/watchlist/refresh-all", async (req, res) => {
    try {
      const items = await storage.getWatchlistItems();
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const keyword = item.searchKeyword || item.productTitle;
          try {
            const analysis = await getMarketAnalysis(keyword, { marketplace: item.marketplace || "EBAY-US" });
            return storage.updateWatchlistItem(item.id, {
              currentAvgPrice: analysis?.avgActivePrice ? String(analysis.avgActivePrice.toFixed(2)) : undefined,
              sellThroughRate: analysis?.sellThroughRate ? String(analysis.sellThroughRate.toFixed(2)) : undefined,
              lastCheckedAt: new Date(),
            });
          } catch { return item; }
        })
      );
      const refreshed = results.filter(r => r.status === "fulfilled").length;
      res.json({ refreshed, total: items.length });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Update watchlist item
  app.patch("/api/watchlist/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = req.body;
      const updated = await storage.updateWatchlistItem(id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── AI Arena ─────────────────────────────────────────────────────────────────

  // Get all available models
  app.get("/api/arena/models", (req, res) => {
    res.json({ models: MODEL_REGISTRY });
  });

  // Score a listing comprehensively
  app.post("/api/arena/score", async (req, res) => {
    try {
      const { title, htmlDescription, itemSpecifics, imageCount, rawTitle } = req.body;
      if (!title && !htmlDescription) {
        return res.status(400).json({ message: "title or htmlDescription required" });
      }
      const score = scoreFullListing({ title: title || "", htmlDescription: htmlDescription || "", itemSpecifics, imageCount, rawTitle });
      res.json(score);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // Run arena comparison across multiple models
  app.post("/api/arena/compare", async (req, res) => {
    try {
      const { productUrl, productData, modelIds, itemSpecifics, imageCount } = req.body;

      if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
        return res.status(400).json({ message: "modelIds array is required" });
      }

      let resolvedProductData = productData;

      // If a URL is provided, scrape it first
      if (productUrl && !resolvedProductData) {
        const scraped = await scrapeProduct(productUrl);
        resolvedProductData = {
          title: scraped.title,
          description: scraped.description,
          images: scraped.images,
          specs: scraped.specifications,
        };
      }

      if (!resolvedProductData?.title) {
        return res.status(400).json({ message: "productData with title is required, or provide a productUrl to scrape" });
      }

      const results = await runArena({
        productData: resolvedProductData,
        modelIds,
        itemSpecifics,
        imageCount: imageCount ?? (resolvedProductData.images?.length || 0),
      });

      res.json({ results, productData: resolvedProductData });
    } catch (error) {
      console.error("Arena compare error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // One-click full automation: scrape → run all fast free models → return best
  // Save a chosen arena result as a full listing
  app.post("/api/arena/save", async (req, res) => {
    try {
      const { title, htmlDescription, images, productUrl, productData } = req.body;
      if (!title) return res.status(400).json({ message: "title is required" });
      const listing = await storage.createListing({
        productUrl: productUrl || "arena",
        generatedTitle: title,
        generatedHtml: htmlDescription || "",
        images: images || [],
        rawData: productData || {},
      });
      res.json(listing);
    } catch (error) {
      console.error("Arena save error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  app.post("/api/arena/auto", async (req, res) => {
    try {
      const { productUrl, productData } = req.body;

      let resolvedProductData = productData;

      if (productUrl && !resolvedProductData) {
        const scraped = await scrapeProduct(productUrl);
        resolvedProductData = {
          title: scraped.title,
          description: scraped.description,
          images: scraped.images,
          specs: scraped.specifications,
        };
      }

      if (!resolvedProductData?.title) {
        return res.status(400).json({ message: "productData or productUrl required" });
      }

      const winner = await runFullAuto(resolvedProductData);
      if (!winner) {
        return res.status(500).json({ message: "All AI models failed — please try again" });
      }

      // Save as a listing
      const listing = await storage.createListing({
        productUrl: productUrl || "manual",
        generatedTitle: winner.title,
        generatedHtml: winner.htmlDescription,
        images: resolvedProductData.images || [],
        rawData: resolvedProductData,
      });

      res.json({ winner, listing, productData: resolvedProductData });
    } catch (error) {
      console.error("Arena auto error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error" });
    }
  });

  // ─── VERO Brand Checker ────────────────────────────────────────────────────

  app.post("/api/vero/check", (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "text required" });
      }
      const result = checkVero(text);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "VERO check failed" });
    }
  });

  app.post("/api/vero/batch", (req, res) => {
    try {
      const { titles } = req.body;
      if (!Array.isArray(titles)) {
        return res.status(400).json({ message: "titles array required" });
      }
      const results = checkVeroBatch(titles.slice(0, 50));
      res.json({ results });
    } catch (error) {
      res.status(500).json({ message: "VERO batch check failed" });
    }
  });

  // ─── ROAS Calculator ──────────────────────────────────────────────────────

  app.post("/api/tools/roas", async (req, res) => {
    try {
      const { adSpend, revenue, cogs, ebayFeePercent, shippingCost } = req.body;
      if (typeof revenue !== "number" || typeof cogs !== "number") {
        return res.status(400).json({ message: "revenue and cogs are required numbers" });
      }
      const result = await calculateROAS({ adSpend: adSpend || 0, revenue, cogs, ebayFeePercent, shippingCost });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "ROAS calculation failed" });
    }
  });

  // ─── Bulk Listing Generator ────────────────────────────────────────────────

  app.post("/api/listings/bulk", async (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "products array required" });
      }
      const results = await generateBulkListings(products.slice(0, 20));
      res.json({ results, count: results.length });
    } catch (error) {
      console.error("Bulk generate error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Bulk generation failed" });
    }
  });

  // ─── Listing Analyzer ─────────────────────────────────────────────────────

  app.post("/api/listings/analyze-url", async (req, res) => {
    try {
      const { url, title, description } = req.body;
      if (!url && !title) {
        return res.status(400).json({ message: "url or title required" });
      }
      // If we have a real URL, try to scrape it for analysis
      let analysisTarget = url || title;
      let scrapedData: ScrapedProduct | null = null;
      if (url) {
        try {
          scrapedData = await scrapeProduct(url);
        } catch {
          // URL scrape failed, analyze from URL string
        }
      }
      const titleToAnalyze = scrapedData?.title || title || url;
      const veroResult = checkVero(titleToAnalyze);
      const aiAnalysis = await analyzeExistingListing(analysisTarget);

      // Score the scraped listing if we have content
      let optimizationScore = null;
      if (scrapedData) {
        optimizationScore = scoreFullListing({
          title: scrapedData.title || "",
          htmlDescription: scrapedData.description || "",
          imageCount: scrapedData.images?.length || 0,
        });
      }
      res.json({ ...aiAnalysis, veroRisk: veroResult, optimizationScore, scrapedData });
    } catch (error) {
      console.error("Listing analyze error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Analysis failed" });
    }
  });

  // ─── AI Models Info ───────────────────────────────────────────────────────

  app.get("/api/ai/models", (_req, res) => {
    res.json({ models: MODEL_REGISTRY, provider: "Pollinations.AI", free: true, requiresKey: false });
  });

  // ─── Health Check (required by Render for deployment health) ─────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now(), version: "2.0.0" });
  });

  return httpServer;
}
