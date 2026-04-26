import { pgTable, text, serial, timestamp, jsonb, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Listings ───────────────────────────────────────────────────────────────
export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  productUrl: text("product_url").notNull(),
  generatedTitle: text("generated_title").notNull(),
  generatedHtml: text("generated_html").notNull(),
  images: text("images").array().notNull(),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  // AI Listing Engine 2.0 fields
  itemSpecifics: jsonb("item_specifics"),
  suggestedCategories: jsonb("suggested_categories"),
  titleScore: jsonb("title_score"),
  processedImages: jsonb("processed_images"),
  lifestyleImages: text("lifestyle_images").array(),
  imageMetadata: jsonb("image_metadata"),
  sourceData: jsonb("source_data"),
  bulkGroupId: text("bulk_group_id"),
});

export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
}).extend({
  rawData: z.any().optional(),
  images: z.array(z.string()),
  itemSpecifics: z.any().optional(),
  suggestedCategories: z.any().optional(),
  titleScore: z.any().optional(),
  processedImages: z.any().optional(),
  lifestyleImages: z.array(z.string()).optional(),
  imageMetadata: z.any().optional(),
  sourceData: z.any().optional(),
  bulkGroupId: z.string().optional(),
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;

// ─── Bulk Jobs ────────────────────────────────────────────────────────────────
export const bulkJobs = pgTable("bulk_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  totalUrls: integer("total_urls").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBulkJobSchema = createInsertSchema(bulkJobs).omit({
  id: true,
  createdAt: true,
}).extend({
  results: z.any().optional(),
});

export type BulkJob = typeof bulkJobs.$inferSelect;
export type InsertBulkJob = z.infer<typeof insertBulkJobSchema>;

// ─── Watchlist Items ─────────────────────────────────────────────────────────
export const watchlistItems = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  productTitle: text("product_title").notNull(),
  productUrl: text("product_url"),
  imageUrl: text("image_url"),
  searchKeyword: text("search_keyword"),
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }),
  currentAvgPrice: numeric("current_avg_price", { precision: 10, scale: 2 }),
  sellThroughRate: numeric("sell_through_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
  marketplace: text("marketplace").default("EBAY-US"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).omit({
  id: true,
  createdAt: true,
});

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;

// ─── Tracked Sellers ─────────────────────────────────────────────────────────
export const trackedSellers = pgTable("tracked_sellers", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  feedbackScore: integer("feedback_score"),
  positiveFeedbackPercent: numeric("positive_feedback_percent", { precision: 5, scale: 2 }),
  totalListings: integer("total_listings"),
  topCategories: jsonb("top_categories"),
  avgPrice: numeric("avg_price", { precision: 10, scale: 2 }),
  snapshotData: jsonb("snapshot_data"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrackedSellerSchema = createInsertSchema(trackedSellers).omit({
  id: true,
  createdAt: true,
}).extend({
  topCategories: z.array(z.string()).optional().nullable(),
  snapshotData: z.any().optional().nullable(),
});

export type TrackedSeller = typeof trackedSellers.$inferSelect;
export type InsertTrackedSeller = z.infer<typeof insertTrackedSellerSchema>;

// ─── Keyword Searches ────────────────────────────────────────────────────────
export const keywordSearches = pgTable("keyword_searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  marketplace: text("marketplace").notNull().default("EBAY-US"),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKeywordSearchSchema = createInsertSchema(keywordSearches).omit({
  id: true,
  createdAt: true,
}).extend({
  results: z.any().optional().nullable(),
});

export type KeywordSearch = typeof keywordSearches.$inferSelect;
export type InsertKeywordSearch = z.infer<typeof insertKeywordSearchSchema>;

// ─── Supplier Searches ────────────────────────────────────────────────────────
export const supplierSearches = pgTable("supplier_searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  results: jsonb("results"),
  resultCount: integer("result_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupplierSearchSchema = createInsertSchema(supplierSearches).omit({
  id: true,
  createdAt: true,
}).extend({
  results: z.any().optional(),
});

export type SupplierSearch = typeof supplierSearches.$inferSelect;
export type InsertSupplierSearch = z.infer<typeof insertSupplierSearchSchema>;

// ─── Profit Scenarios ─────────────────────────────────────────────────────────
export const profitScenarios = pgTable("profit_scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Untitled Scenario"),
  inputs: jsonb("inputs").notNull(),
  outputs: jsonb("outputs").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProfitScenarioSchema = createInsertSchema(profitScenarios).omit({
  id: true,
  createdAt: true,
}).extend({
  inputs: z.any(),
  outputs: z.any(),
});

export type ProfitScenario = typeof profitScenarios.$inferSelect;
export type InsertProfitScenario = z.infer<typeof insertProfitScenarioSchema>;

// ─── Templates ────────────────────────────────────────────────────────────────
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  blocks: jsonb("blocks").notNull(),
  isDefault: boolean("is_default").default(false),
  versions: jsonb("versions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  blocks: z.any(),
  versions: z.any().optional(),
  isDefault: z.boolean().optional(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

// ─── Request/Response Schemas ────────────────────────────────────────────────
export const generateRequestSchema = z.object({
  productUrl: z.string().url("Must be a valid URL"),
  titleOverride: z.string().max(80).optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateResponse = Listing;
