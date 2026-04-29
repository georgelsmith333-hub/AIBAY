import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import GeneratePage from "@/pages/generate";
import ListingDetails from "@/pages/listing-details";
import HistoryPage from "@/pages/history";
import MarketResearch from "@/pages/market-research";
import TurboScanner from "@/pages/turbo-scanner";
import TrendingPage from "@/pages/trending";
import TopSellers from "@/pages/top-sellers";
import KeywordsPage from "@/pages/keywords";
import CategoriesPage from "@/pages/categories";
import WatchlistPage from "@/pages/watchlist";
import SupplierFinderPage from "@/pages/supplier-finder";
import ProfitCalculatorPage from "@/pages/profit-calculator";
import SupplierIntelligencePage from "@/pages/supplier-intelligence";
import CalculatorPage from "@/pages/calculator";
import TemplatesPage from "@/pages/templates";
import VeroCheckerPage from "@/pages/vero-checker";
import RoasCalculatorPage from "@/pages/roas-calculator";
import AdSpyPage from "@/pages/ad-spy";
import NotFound from "@/pages/not-found";

function ThemeInit() {
  useEffect(() => {
    const saved = localStorage.getItem("aibay-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/generate" component={GeneratePage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/listing/:id" component={ListingDetails} />
      <Route path="/market-research" component={MarketResearch} />
      <Route path="/turbo-scanner" component={TurboScanner} />
      <Route path="/trending" component={TrendingPage} />
      <Route path="/top-sellers" component={TopSellers} />
      <Route path="/keywords" component={KeywordsPage} />
      <Route path="/categories" component={CategoriesPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/supplier-finder" component={SupplierFinderPage} />
      <Route path="/profit-calculator" component={ProfitCalculatorPage} />
      <Route path="/supplier" component={SupplierIntelligencePage} />
      <Route path="/calculator" component={CalculatorPage} />
      <Route path="/templates" component={TemplatesPage} />
      <Route path="/vero-checker" component={VeroCheckerPage} />
      <Route path="/roas-calculator" component={RoasCalculatorPage} />
      <Route path="/ad-spy" component={AdSpyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const BASE_PATH = import.meta.env.VITE_BASE_PATH?.replace(/\/$/, '') || '';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInit />
        <Toaster />
        <WouterRouter base={BASE_PATH}>
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
