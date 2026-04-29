import {
  listings,
  bulkJobs,
  watchlistItems,
  trackedSellers,
  keywordSearches,
  supplierSearches,
  profitScenarios,
  templates,
  type InsertListing,
  type Listing,
  type BulkJob,
  type InsertBulkJob,
  type InsertWatchlistItem,
  type WatchlistItem,
  type InsertTrackedSeller,
  type TrackedSeller,
  type InsertKeywordSearch,
  type KeywordSearch,
  type SupplierSearch,
  type InsertSupplierSearch,
  type ProfitScenario,
  type InsertProfitScenario,
  type Template,
  type InsertTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, gte } from "drizzle-orm";

export interface IStorage {
  // Listings
  createListing(listing: InsertListing): Promise<Listing>;
  getListings(): Promise<Listing[]>;
  getListing(id: number): Promise<Listing | undefined>;
  updateListing(id: number, data: Partial<InsertListing>): Promise<Listing>;
  getListingsCount(): Promise<number>;

  // Bulk Jobs
  createBulkJob(job: InsertBulkJob): Promise<BulkJob>;
  getBulkJob(id: number): Promise<BulkJob | undefined>;
  updateBulkJob(id: number, data: Partial<InsertBulkJob>): Promise<BulkJob>;

  // Watchlist
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  getWatchlistItems(): Promise<WatchlistItem[]>;
  getWatchlistItem(id: number): Promise<WatchlistItem | undefined>;
  updateWatchlistItem(id: number, data: Partial<InsertWatchlistItem>): Promise<WatchlistItem>;
  deleteWatchlistItem(id: number): Promise<void>;
  getWatchlistCount(): Promise<number>;

  // Tracked Sellers
  createTrackedSeller(seller: InsertTrackedSeller): Promise<TrackedSeller>;
  getTrackedSellers(): Promise<TrackedSeller[]>;
  getTrackedSeller(username: string): Promise<TrackedSeller | undefined>;
  updateTrackedSeller(id: number, data: Partial<InsertTrackedSeller>): Promise<TrackedSeller>;
  deleteTrackedSeller(id: number): Promise<void>;
  getTrackedSellersCount(): Promise<number>;

  // Keyword Searches
  createKeywordSearch(search: InsertKeywordSearch): Promise<KeywordSearch>;
  getKeywordSearches(limit?: number): Promise<KeywordSearch[]>;
  getKeywordSearchesToday(): Promise<number>;

  // Supplier Searches
  createSupplierSearch(search: InsertSupplierSearch): Promise<SupplierSearch>;
  getSupplierSearchHistory(limit?: number): Promise<SupplierSearch[]>;

  // Profit Scenarios
  createProfitScenario(scenario: InsertProfitScenario): Promise<ProfitScenario>;
  getProfitScenarios(): Promise<ProfitScenario[]>;
  deleteProfitScenario(id: number): Promise<void>;

  // Templates
  createTemplate(template: InsertTemplate): Promise<Template>;
  getTemplates(): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;
  setDefaultTemplate(id: number): Promise<Template>;
  getDefaultTemplate(): Promise<Template | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ─── Listings ───────────────────────────────────────────────────────────────
  async createListing(insertListing: InsertListing): Promise<Listing> {
    const [listing] = await db.insert(listings).values(insertListing).returning();
    return listing;
  }

  async getListings(): Promise<Listing[]> {
    return await db.select().from(listings).orderBy(desc(listings.createdAt));
  }

  async getListing(id: number): Promise<Listing | undefined> {
    const [listing] = await db.select().from(listings).where(eq(listings.id, id));
    return listing;
  }

  async updateListing(id: number, data: Partial<InsertListing>): Promise<Listing> {
    const [updated] = await db.update(listings).set(data).where(eq(listings.id, id)).returning();
    return updated;
  }

  async getListingsCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(listings);
    return Number(result.count);
  }

  // ─── Bulk Jobs ───────────────────────────────────────────────────────────────
  async createBulkJob(job: InsertBulkJob): Promise<BulkJob> {
    const [created] = await db.insert(bulkJobs).values(job).returning();
    return created;
  }

  async getBulkJob(id: number): Promise<BulkJob | undefined> {
    const [job] = await db.select().from(bulkJobs).where(eq(bulkJobs.id, id));
    return job;
  }

  async updateBulkJob(id: number, data: Partial<InsertBulkJob>): Promise<BulkJob> {
    const [updated] = await db.update(bulkJobs).set(data).where(eq(bulkJobs.id, id)).returning();
    return updated;
  }

  // ─── Watchlist ──────────────────────────────────────────────────────────────
  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [created] = await db.insert(watchlistItems).values(item).returning();
    return created;
  }

  async getWatchlistItems(): Promise<WatchlistItem[]> {
    return await db.select().from(watchlistItems).orderBy(desc(watchlistItems.createdAt));
  }

  async getWatchlistItem(id: number): Promise<WatchlistItem | undefined> {
    const [item] = await db.select().from(watchlistItems).where(eq(watchlistItems.id, id));
    return item;
  }

  async updateWatchlistItem(id: number, data: Partial<InsertWatchlistItem>): Promise<WatchlistItem> {
    const [updated] = await db.update(watchlistItems).set(data).where(eq(watchlistItems.id, id)).returning();
    return updated;
  }

  async deleteWatchlistItem(id: number): Promise<void> {
    await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
  }

  async getWatchlistCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(watchlistItems);
    return Number(result.count);
  }

  // ─── Tracked Sellers ────────────────────────────────────────────────────────
  async createTrackedSeller(seller: InsertTrackedSeller): Promise<TrackedSeller> {
    const [created] = await db.insert(trackedSellers).values(seller).returning();
    return created;
  }

  async getTrackedSellers(): Promise<TrackedSeller[]> {
    return await db.select().from(trackedSellers).orderBy(desc(trackedSellers.createdAt));
  }

  async getTrackedSeller(username: string): Promise<TrackedSeller | undefined> {
    const [seller] = await db.select().from(trackedSellers).where(eq(trackedSellers.username, username));
    return seller;
  }

  async updateTrackedSeller(id: number, data: Partial<InsertTrackedSeller>): Promise<TrackedSeller> {
    const [updated] = await db.update(trackedSellers).set(data).where(eq(trackedSellers.id, id)).returning();
    return updated;
  }

  async deleteTrackedSeller(id: number): Promise<void> {
    await db.delete(trackedSellers).where(eq(trackedSellers.id, id));
  }

  async getTrackedSellersCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(trackedSellers);
    return Number(result.count);
  }

  // ─── Keyword Searches ───────────────────────────────────────────────────────
  async createKeywordSearch(search: InsertKeywordSearch): Promise<KeywordSearch> {
    const [created] = await db.insert(keywordSearches).values(search).returning();
    return created;
  }

  async getKeywordSearches(limit = 20): Promise<KeywordSearch[]> {
    return await db.select().from(keywordSearches).orderBy(desc(keywordSearches.createdAt)).limit(limit);
  }

  async getKeywordSearchesToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(keywordSearches)
      .where(gte(keywordSearches.createdAt, startOfDay));
    return Number(result.count);
  }

  // ─── Supplier Searches ───────────────────────────────────────────────────────
  async createSupplierSearch(search: InsertSupplierSearch): Promise<SupplierSearch> {
    const [created] = await db.insert(supplierSearches).values(search).returning();
    return created;
  }

  async getSupplierSearchHistory(limit = 20): Promise<SupplierSearch[]> {
    return await db.select().from(supplierSearches).orderBy(desc(supplierSearches.createdAt)).limit(limit);
  }

  // ─── Profit Scenarios ───────────────────────────────────────────────────────
  async createProfitScenario(scenario: InsertProfitScenario): Promise<ProfitScenario> {
    const [created] = await db.insert(profitScenarios).values({
      ...scenario,
      inputs: scenario.inputs ?? {},
      outputs: scenario.outputs ?? {},
    }).returning();
    return created;
  }

  async getProfitScenarios(): Promise<ProfitScenario[]> {
    return await db.select().from(profitScenarios).orderBy(desc(profitScenarios.createdAt));
  }

  async deleteProfitScenario(id: number): Promise<void> {
    await db.delete(profitScenarios).where(eq(profitScenarios.id, id));
  }

  // ─── Templates ──────────────────────────────────────────────────────────────
  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values({
      ...template,
      blocks: template.blocks ?? [],
    }).returning();
    return created;
  }

  async getTemplates(): Promise<Template[]> {
    return await db.select().from(templates).orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    const [tmpl] = await db.select().from(templates).where(eq(templates.id, id));
    return tmpl;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template> {
    const [updated] = await db
      .update(templates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return updated;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async setDefaultTemplate(id: number): Promise<Template> {
    await db.update(templates).set({ isDefault: false });
    const [updated] = await db
      .update(templates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return updated;
  }

  async getDefaultTemplate(): Promise<Template | undefined> {
    const [tmpl] = await db.select().from(templates).where(eq(templates.isDefault, true));
    return tmpl;
  }
}

export const storage = new DatabaseStorage();
