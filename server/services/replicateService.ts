import axios, { AxiosError } from "axios";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const BASE_URL = "https://api.replicate.com/v1";
const POLL_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

export function isReplicateConfigured(): boolean {
  return !!REPLICATE_API_TOKEN;
}

export class ReplicateApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ReplicateApiError";
  }
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
}

function extractApiError(err: unknown, fallbackStatus = 500): ReplicateApiError {
  if (err instanceof AxiosError && err.response) {
    const data = err.response.data as { detail?: string; title?: string; message?: string } | undefined;
    const detail = data?.detail || data?.title || data?.message;
    const status = err.response.status;
    if (status === 402) {
      return new ReplicateApiError(
        402,
        detail ||
          "Your Replicate account has insufficient credit. Add billing at https://replicate.com/account/billing to use AI image features."
      );
    }
    if (status === 401 || status === 403) {
      return new ReplicateApiError(status, detail || "Replicate API token is invalid or unauthorized.");
    }
    return new ReplicateApiError(status, detail || `Replicate API error (${status})`);
  }
  if (err instanceof Error) return new ReplicateApiError(fallbackStatus, err.message);
  return new ReplicateApiError(fallbackStatus, "Unknown Replicate API error");
}

async function createPrediction(modelVersion: string, input: Record<string, unknown>): Promise<string> {
  try {
    const res = await axios.post(
      `${BASE_URL}/predictions`,
      { version: modelVersion, input },
      { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}`, "Content-Type": "application/json" } }
    );
    return res.data.id as string;
  } catch (err) {
    throw extractApiError(err);
  }
}

async function pollPrediction(predictionId: string): Promise<string> {
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    let pred: Prediction;
    try {
      const res = await axios.get<Prediction>(`${BASE_URL}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      pred = res.data;
    } catch (err) {
      throw extractApiError(err);
    }
    if (pred.status === "succeeded") {
      const output = pred.output;
      if (typeof output === "string") return output;
      if (Array.isArray(output) && output.length > 0) return output[0];
      throw new ReplicateApiError(500, "Empty output from Replicate");
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new ReplicateApiError(500, `Replicate prediction ${pred.status}: ${pred.error || "unknown error"}`);
    }
  }
  throw new ReplicateApiError(504, "Replicate prediction timed out after 90 seconds");
}

// nightmareai/real-esrgan — upscale 4x
const REAL_ESRGAN_VERSION = "350d32041630ffbe63c8352783a26d94126809164e54085352f8326e53999085";

export async function upscaleImageStrict(imageUrl: string): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new ReplicateApiError(402, "REPLICATE_API_TOKEN not configured");
  }
  const id = await createPrediction(REAL_ESRGAN_VERSION, { image: imageUrl, scale: 4, face_enhance: false });
  return await pollPrediction(id);
}

export async function upscaleImage(imageUrl: string): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    return imageUrl;
  }
  try {
    return await upscaleImageStrict(imageUrl);
  } catch (err) {
    console.warn("Upscale failed, returning original:", (err as Error).message);
    return imageUrl;
  }
}

// lucataco/remove-bg
const REMOVE_BG_VERSION = "95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1";

export async function removeBackground(imageUrl: string): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  const id = await createPrediction(REMOVE_BG_VERSION, { image: imageUrl });
  return await pollPrediction(id);
}

// stability-ai/sdxl — lifestyle image generation
const SDXL_VERSION = "39ed52f2319f9bfb5d748f09897e0fa3dcd8cbfc17e7bb5f5cbf5f2c2a0f18c5";

export async function generateLifestyleImage(prompt: string): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  const id = await createPrediction(SDXL_VERSION, {
    prompt: `${prompt}, product photography, professional studio lighting, ultra high quality, 4k`,
    negative_prompt: "blurry, distorted, text, watermark, low quality, cartoon",
    width: 1024,
    height: 1024,
    num_inference_steps: 30,
    guidance_scale: 7.5,
  });
  return await pollPrediction(id);
}

export async function upscaleImagesBatch(imageUrls: string[]): Promise<{ url: string; upscaledUrl: string; status: "done" | "failed" | "skipped" }[]> {
  if (!REPLICATE_API_TOKEN) {
    return imageUrls.map(url => ({ url, upscaledUrl: url, status: "skipped" as const }));
  }
  return Promise.all(
    imageUrls.map(async url => {
      try {
        const upscaledUrl = await upscaleImage(url);
        return { url, upscaledUrl, status: "done" as const };
      } catch {
        return { url, upscaledUrl: url, status: "failed" as const };
      }
    })
  );
}
