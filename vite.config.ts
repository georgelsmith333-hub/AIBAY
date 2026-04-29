import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => {
  const isReplit = process.env.REPL_ID !== undefined;
  const isDev = process.env.NODE_ENV !== "production";

  const plugins = [react()];

  if (isDev && isReplit) {
    const [{ default: runtimeErrorOverlay }, cartographerMod, devBannerMod] = await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal"),
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
    plugins.push(runtimeErrorOverlay(), cartographerMod.cartographer(), devBannerMod.devBanner());
  }

  const base = process.env.VITE_BASE_PATH || '/';

  return {
    plugins,
    base,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
      'import.meta.env.VITE_BASE_PATH': JSON.stringify(base),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
