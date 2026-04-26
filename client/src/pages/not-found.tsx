import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="w-12 h-12" />
            </div>
            
            <h1 className="text-3xl font-bold text-foreground">Page not found</h1>
            <p className="text-muted-foreground mb-4">
              The page you are looking for doesn't exist or has been moved.
            </p>

            <Link href="/">
              <Button className="w-full" size="lg">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
