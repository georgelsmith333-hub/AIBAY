import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EbaySetupBanner() {
  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 mb-6">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-amber-800 dark:text-amber-300">
        <strong>eBay API key not configured.</strong> To enable live eBay data, add your free{" "}
        <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono">
          EBAY_APP_ID
        </code>{" "}
        to Secrets. Get a free key in 2 minutes at{" "}
        <a
          href="https://developer.ebay.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium inline-flex items-center gap-1"
        >
          developer.ebay.com
          <ExternalLink className="w-3 h-3" />
        </a>
        {" "}— register as a developer, create an app, copy the App ID.
      </AlertDescription>
    </Alert>
  );
}
