import { z } from "zod";
import { listings, generateRequestSchema, type GenerateRequest } from "./schema";
export type { GenerateRequest };

export const api = {
  listings: {
    generate: {
      method: "POST" as const,
      path: "/api/generate" as const,
      input: generateRequestSchema,
      responses: {
        200: z.custom<typeof listings.$inferSelect>(),
        400: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/listings" as const,
      responses: {
        200: z.array(z.custom<typeof listings.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/listings/:id" as const,
      responses: {
        200: z.custom<typeof listings.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    downloadImages: {
      method: "GET" as const,
      path: "/api/listings/:id/download" as const,
      responses: {
        200: z.any(), // Stream
        404: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
