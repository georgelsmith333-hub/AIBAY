# AIBAY — eBay Market Intelligence Platform

## Overview
AIBAY is a premium eBay market intelligence and listing generation platform designed to surpass ZikAnalytics, AutoDS, and CJ Dropshipping. It provides real-time eBay data analysis, AI-powered listing generation, and comprehensive market research tools.

## Architecture

### Stack
- **Frontend**: React + Vite, TanStack Query v5, wouter routing, shadcn/ui, Tailwind CSS, framer-motion
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenRouter API (via `OPENROUTER_API_KEY`) for listing generation and keyword research
- **eBay Data**: eBay Finding API (via `EBAY_APP_ID` secret)

### Key Files
- `shared/schema.ts` — Drizzle ORM schema for listings, watchlist_items, tracked_sellers, keyword_searches
- `server/routes.ts` — All API routes (`/api/ebay/*`, `/api/listings`, `/api/keywords/*`, `/api/watchlist`, `/api/tracked-sellers`, `/api/stats`)
- `server/storage.ts` — IStorage interface + PostgreSQL implementation
- `server/services/ebayApi.ts` — eBay Finding API service with 5-min TTL cache
- `server/services/aiRouter.ts` — OpenRouter AI service (listing generation + keyword suggestions)
- `server/services/platformScrapers.ts` — Platform-specific scrapers (AliExpress, Amazon, Temu, CJ Dropshipping, generic)
- `server/services/scraper.ts` — Re-exports from platformScrapers for backward compatibility
- `server/services/replicateService.ts` — Replicate API integration (upscale, remove-bg, lifestyle image SDXL)
- `server/services/imageProcessor.ts` — Image extraction/processing
- `client/src/components/layout.tsx` — AIBAY sidebar navigation layout
- `client/src/App.tsx` — Route registrations

### Frontend Routes
| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Stats, quick analyzer, tool grid, recent listings |
| `/market-research` | Market Research | Live STR, demand scores, profit calculator, listings grid |
| `/turbo-scanner` | Turbo Scanner | Category scan with AIBAY Worth Score™ |
| `/trending` | Trending Items | eBay trending by watch count |
| `/top-sellers` | Top Sellers | Seller intelligence + revenue estimates |
| `/categories` | Category Analytics | 20 categories with on-demand stats |
| `/generate` | AI Listing Engine 2.0 | AI listing from any URL — tabs: AI Generator (single + bulk) + Title Optimizer + Quick Templates |
| `/profit-calculator` | Profit Calculator | Real eBay fee engine: FVF 13.25%, international fee, break-even, ROI, net profit |
| `/calculator` | Profit & Fee Calculator | Live eBay fee calculator with break-even, batch mode, save scenarios |
| `/supplier-finder` | Supplier Finder | Amazon/AliExpress/Temu search with live eBay sold price cross-reference |
| `/supplier` | Supplier Intelligence | AI-scored supplier search (Amazon/AliExpress/Temu) with history |
| `/templates` | Template Manager | eBay description template builder with blocks, variables, live preview |
| `/keywords` | Keyword Tool | AI keyword research with STR data |
| `/history` | History | Past generated listings |
| `/watchlist` | Watchlist | Saved products with price alerts, refresh, CSV export |
| `/listing/:id` | Listing Details | Multi-tab result: Overview, Image AI, Item Specifics, Categories, Description, SEO Score |

### API Endpoints
- `GET /api/ebay/status` — Check if EBAY_APP_ID is configured
- `GET /api/ebay/search` — Market analysis (keyword, marketplace, categoryId)
- `GET /api/ebay/turbo-scan` — Category scanner (categoryId, minPrice, maxPrice, condition)
- `GET /api/ebay/trending` — Trending items by category
- `GET /api/ebay/seller/:username` — Seller profile + store intelligence
- `GET /api/ebay/category/:id/stats` — Category statistics
- `GET /api/ebay/item/:itemId` — Shopping API GetSingleItem (full item details, specifics, images)
- `GET /api/ebay/sold-summary` — Completed sold items summary (avgSoldPrice, totalSold, top items)
- `GET /api/profit/calculate` — eBay profit calculator (FVF, international fee, ROI, break-even)
- `GET /api/supplier/search` — Supplier search across Amazon/AliExpress/Temu
- `GET /api/listings` — All generated listings
- `POST /api/listings` — Generate new listing (productUrl)
- `POST /api/optimize/manual` — Generate listing from manual text input (productName, description, notes, category, imageUrls[])
- `GET /api/listings/:id` — Single listing
- `GET /api/keywords/history` — Recent keyword searches
- `POST /api/keywords/research` — AI keyword research
- `GET /api/watchlist` — Watchlist items
- `POST /api/watchlist` — Add to watchlist
- `PATCH /api/watchlist/:id` — Update watchlist item
- `DELETE /api/watchlist/:id` — Remove from watchlist
- `POST /api/watchlist/:id/refresh` — Refresh single watchlist price
- `POST /api/watchlist/refresh-all` — Refresh all watchlist prices
- `GET /api/tracked-sellers` — Tracked sellers
- `POST /api/tracked-sellers` — Add tracked seller
- `DELETE /api/tracked-sellers/:id` — Remove tracked seller
- `GET /api/stats` — Dashboard stats
- `POST /api/supplier/search` — AI-scored supplier search across platforms
- `GET /api/supplier/history` — Past supplier searches
- `POST /api/profit/calculate` — eBay fee calculation
- `POST /api/profit/save` — Save profit scenario
- `GET /api/profit/scenarios` — List saved scenarios
- `DELETE /api/profit/scenarios/:id` — Delete scenario
- `GET /api/templates` — List templates
- `POST /api/templates` — Create template
- `PUT /api/templates/:id` — Update template
- `DELETE /api/templates/:id` — Delete template
- `POST /api/templates/:id/duplicate` — Duplicate template
- `GET /api/templates/:id/history` — Template version history

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection (auto-configured by Replit)
- `EBAY_APP_ID` — eBay Developer App ID (required for live eBay data)
- `OPENROUTER_API_KEY` — OpenRouter API key for AI features (also powers AI Arena free models)
- `SESSION_SECRET` — Express session secret
- `REPLICATE_API_TOKEN` — Replicate API for image upscaling/generation

## AI Model Arena (LMArena-style)
- **Page**: `/ai-arena`
- **API**: `POST /api/arena/compare` — run multiple models in parallel
- **API**: `POST /api/arena/auto` — full auto: scrape → best free models → pick winner
- **API**: `POST /api/arena/score` — score a listing comprehensively
- **API**: `GET /api/arena/models` — list all available models
- **Service**: `server/services/modelArena.ts`
- **Client utility**: `client/src/lib/optimizationScore.ts` — client-side listing score
- Features: 8 free models (`:free` suffix, no credits), 3 premium models, side-by-side comparison, winner badge, expandable scoring breakdown, description preview modal, one-click Full Auto mode
- Model Registry: Gemini 2.0 Flash, Gemma 3 27B, Llama 3.3 70B, DeepSeek R1, Mistral 7B, Qwen 2.5 72B, Hermes 3 405B, Gemini 2.0 Pro (all free), plus Claude 3.5 Sonnet, GPT-4o, Gemini 2.0 Flash Pro (premium)

## Full Listing Optimization Score
- Multi-dimensional score: Title (35%), Description (30%), Item Specifics (20%), Images (15%)
- Grade: A+/A/B+/B/C/D
- Ranking Confidence: "Very Likely" / "Likely" / "Moderate" / "Needs Work"
- Displayed on: Listing Details → SEO Score tab (new "Full Listing Optimization Score" card)
- Computed client-side via `computeListingScore()` from `client/src/lib/optimizationScore.ts`

## Design System
- Dark navy sidebar (`#0d1117` base) with blue-600 primary accent
- Font: "Plus Jakarta Sans" (display), "Inter" (body)
- Custom CSS variables in `client/src/index.css`
- Tailwind config extended in `tailwind.config.ts`

## Key Features
1. **Quick Analyzer** (Dashboard) — Inline market check with 4 key metrics + one-click next step actions
2. **Smart 4-Step Workflow** (Dashboard) — Research → Source → Generate → Profit clickable guide
3. **Hot Categories** (Dashboard) — 12 trending product categories always visible to guests; clicking navigates to Supplier Finder pre-filled
4. **PWA / App Install** — AIBAY is installable on Android, iOS, Windows & Linux via browser "Add to Home Screen"; service worker enables offline access
5. **Market Research** — Live STR, demand/competition/opportunity scores, price distribution histogram, profit calculator, export CSV
6. **Turbo Scanner** — Category scan with proprietary AIBAY Worth Score™ (0–100), hot/good/OK badges, sort & filter
7. **Trending Items** — eBay trending items by category
8. **Top Sellers** — Seller intelligence: feedback, active listings, categories, revenue estimate
9. **Category Analytics** — 20 categories, click to expand for live stats
10. **AI Listing Engine 2.0** — Three input modes: Single URL, Notes/Manual (no URL needed — describe product with name/description/notes/category/image URLs), Bulk Mode (up to 25 URLs). Cassini-optimized title (68 chars target, max 80) + HTML description + images + item specifics + categories
11. **Supplier Finder** — Multi-strategy scraping with AliExpress bypass (mobile API → AJAX API → HTML with cookie simulation → OpenSearch API), Amazon & Temu; compare prices, see profit margins, import URL to Listing Generator
    - **URL Scraper**: HTTP + Cheerio based (no headless browser needed). Custom cookie jar with manual redirect handling breaks AliExpress's `sync_cookie_write` infinite loop and supports both .com and .us domains.
12. **Supplier Intelligence** — AI-scored supplier search across Amazon, AliExpress & Temu; resale score, search history persistence
13. **Profit & Fee Calculator** — Real eBay fee schedule (March 2025); instant break-even, margin, ROI; batch mode, save scenarios
14. **Template Manager** — eBay HTML description builder with block types (hero, bullets, specs, gallery), {{variable}} tokens, live preview, version history
15. **Keyword Research Tool** — AI keyword variations with STR data, title builder template
16. **Watchlist** — Price alerts, one-click refresh, CSV export, last-checked timestamps
17. **History** — All past listings with thumbnail previews
18. **Next Steps Auto-Suggest** — After generating a listing: buttons for Check Profit, Market Research, Find Supplier

## Title Generation Rules
- **Target: 68 characters** (optimum for eBay Cassini algorithm)
- **Max: 80 characters** (eBay hard limit, titles exceeding this are truncated)
- **Ideal range: 60–70 chars**
- All AI prompts updated to target 68 chars
- `optimizeTitle()` function uses `TITLE_TARGET = 68`, `TITLE_MAX = 80`

## Supplier Finder
- **Page**: `/supplier-finder`
- **API**: `GET /api/supplier/search?q=keyword`
- **API**: `GET /api/supplier/urls?q=keyword` (returns open search URLs only)
- **Service**: `server/services/supplierFinder.ts`
- Searches Amazon, AliExpress, Temu in parallel with 30-min result caching
- Calculates profit margin if eBay target price is provided
- "Import to Generator" button pre-fills the listing generator with supplier URL
- Fallback to direct search links if scraping is blocked
