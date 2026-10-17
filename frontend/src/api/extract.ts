// Seam 1 — photo upload. Mock mode serves built-in fixture packs without a
// backend; live mode POSTs the photos only (never the profile) to
// POST /api/extract. Errors follow the shared envelope (docs/API_CONTRACT.md).

import type { Extraction } from "@shared/contracts";
import { DEFAULT_MOCK_PACK_ID, getPackById, listPacks } from "./mocks";
import { ERROR_SIM_ID } from "./mocks";

const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
// Stay comfortably below Vercel Functions' 4.5 MB request-body limit,
// including multipart form-data overhead.
const MAX_PER_IMAGE = 4 * 1024 * 1024; // 4 MiB per image
const MAX_TOTAL = 4 * 1024 * 1024; // 4 MiB total
const MAX_IMAGES = 3;

export function extractMode(): "mock" | "live" {
  return import.meta.env.VITE_EXTRACT_MODE === "live" ? "live" : "mock";
}

export class ExtractError extends Error {
  code: string;
  retryable: boolean;
  requestId?: string;
  constructor(code: string, message: string, retryable = false, requestId?: string) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

export interface ExtractOutcome {
  extraction: Extraction;
}

function validateFiles(files: File[]): void {
  if (files.length < 1 || files.length > MAX_IMAGES) {
    throw new ExtractError(
      "bad_input",
      `Choose 1 to ${MAX_IMAGES} photos.`,
    );
  }
  let total = 0;
  for (const file of files) {
    const type = (file.type || "").toLowerCase();
    if (type && !ACCEPTED_MIME.includes(type)) {
      throw new ExtractError(
        "bad_input",
        `“${file.name}” is ${type || "an unknown type"} — please use a JPG, PNG, or WebP photo.`,
      );
    }
    if (file.size > MAX_PER_IMAGE) {
      throw new ExtractError(
        "bad_input",
        `“${file.name}” is larger than 4 MiB. Retake it closer to the panel so the file is smaller.`,
      );
    }
    total += file.size;
  }
  if (total > MAX_TOTAL) {
    throw new ExtractError(
      "bad_input",
      "The photos together exceed 4 MiB. Retake or remove one and try again.",
    );
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function extractMock(files: File[]): Promise<ExtractOutcome> {
  await wait(700); // keep the loading state honest in previews
  if (files.some((f) => f.name === ERROR_SIM_ID)) {
    throw new ExtractError(
      "quota",
      "The vision provider has no quota left right now. Try again in a moment, or use a sample.",
      true,
    );
  }
  const pack = getPackById(DEFAULT_MOCK_PACK_ID) ?? listPacks()[0];
  return { extraction: pack.extraction };
}

async function extractLive(files: File[]): Promise<ExtractOutcome> {
  validateFiles(files);
  const form = new FormData();
  for (const file of files) form.append("images", file, file.name);

  let response: Response;
  try {
    response = await fetch("/api/extract", { method: "POST", body: form });
  } catch {
    throw new ExtractError(
      "provider_error",
      "We couldn't reach the LabelLens service. Check your connection and try again.",
      true,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  const requestId = response.headers.get("X-Request-ID") ?? undefined;

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string; retryable?: boolean } } | null;
    const err = envelope?.error;
    throw new ExtractError(
      err?.code ?? "provider_error",
      err?.message ??
        "The label could not be read right now. Try again, or use a sample.",
      err?.retryable ?? true,
      requestId,
    );
  }

  const extraction = payload as Extraction;
  if (
    !extraction ||
    extraction.schema_version !== "1" ||
    !Array.isArray(extraction.ingredients)
  ) {
    throw new ExtractError(
      "unreadable_response",
      "The reading came back in an unexpected shape. Try again, or use a sample.",
      true,
    );
  }
  return { extraction };
}

/** One entry point the UI calls for both modes. Photos only — never the profile. */
export async function extractLabel(files: File[]): Promise<ExtractOutcome> {
  return extractMode() === "live" ? extractLive(files) : extractMock(files);
}
