import { useListings } from "@/hooks/use-listings";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Calendar, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function HistoryPage() {
  const { data: listings, isLoading } = useListings();
  const [search, setSearch] = useState("");

  const filteredListings = listings?.filter(l => 
    l.generatedTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Generation History</h1>
            <p className="text-muted-foreground mt-1">View and manage your past AI-generated listings.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search listings..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredListings?.length === 0 ? (
          <div className="text-center py-20 bg-secondary/20 rounded-2xl border border-dashed border-border">
            <h3 className="text-lg font-medium text-foreground">No listings found</h3>
            <p className="text-muted-foreground">Try adjusting your search or generate a new listing.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredListings?.map((listing) => (
              <Link key={listing.id} href={`/listing/${listing.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border-border/60 group">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-secondary rounded-lg overflow-hidden flex-shrink-0 border border-border">
                      {listing.images?.[0] && (
                        <img 
                          src={listing.images[0]} 
                          alt="" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate pr-4 group-hover:text-primary transition-colors">
                        {listing.generatedTitle}
                      </h3>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(listing.createdAt!).toLocaleDateString()}
                        </span>
                        <span className="truncate max-w-[200px] text-xs opacity-70">
                          {new URL(listing.productUrl).hostname}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 text-muted-foreground group-hover:text-foreground">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
