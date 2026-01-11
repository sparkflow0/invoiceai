import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { uploadRequestSchema, type ExtractedData } from "@shared/schema";
import { randomUUID } from "crypto";
import { z, ZodError } from "zod";
import pdfParse from "pdf-parse";
import rateLimit from "express-rate-limit";
import OpenAI, { toFile } from "openai";
import * as XLSX from "xlsx";
import type Stripe from "stripe";
import { attachFirebaseUser } from "./firebase-auth";
import {
  INVOICE_ALLOWED_MIME_TYPES,
  PDF_TOOL_ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGES,
  PDF_TOOL_MAX_FILE_SIZE_BYTES,
  PDF_TOOL_MAX_PDF_PAGES,
  detectMimeFromBuffer,
  getBase64Size,
  hasPdfScripts,
  parseDataUrl,
  sanitizeFileName,
} from "./upload-utils";
import {
  createSignedUploadUrl,
  deleteUploadObject,
  createSignedDownloadUrl,
  fetchUploadBuffer,
} from "./uploads";
import { recordAnalyticsEvent, getMetricsSummary } from "./analytics";
import { getFreeDailyLimit, getUsageScope, reserveDailyUsage } from "./usage";
import {
  applyStripeSubscriptionUpdate,
  findUserIdByStripeCustomerId,
  getUserEntitlement,
  upsertUserEntitlement,
} from "./entitlements";
import { getStripeClient, getStripePriceId, getStripeWebhookSecret } from "./billing";
import { getHistoryEntryForUser, listHistoryEntriesForUser, saveHistoryEntryForUser } from "./history";
import { workflowEngine } from "./workflow/engine";
import { registerWorkflowRoutes } from "./workflow/routes";
import { firestoreAdd, firestoreUpdate, firestoreGet, firestoreQuery } from "./firebase-db";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

type ErrorCode =
  | "UPLOAD_INVALID"
  | "OCR_FAIL"
  | "AI_TIMEOUT"
  | "PARSE_FAIL"
  | "USAGE_LIMIT"
  | "AUTH_REQUIRED"
  | "PLAN_REQUIRED"
  | "HISTORY_NOT_FOUND"
  | "PDF_TOOL_FAIL";

const AI_TIMEOUT_MS = 45_000;
const AI_RETRY_LIMIT = 2;
const AI_RETRY_BASE_DELAY_MS = 800;
const CLOUDCONVERT_BASE_URL = "https://api.cloudconvert.com/v2";
const PDF_TOOL_TIMEOUT_MS = 60_000;
const PDF_TOOL_MAX_FILES = 10;

class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
  );
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AppError("AI_TIMEOUT", "AI request timed out.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableError(error: unknown): boolean {
  const status = typeof (error as any)?.status === "number" ? (error as any).status : null;
  if (status === 429 || (status !== null && status >= 500)) {
    return true;
  }
  if (error instanceof AppError && error.code === "AI_TIMEOUT") {
    return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, retries = AI_RETRY_LIMIT): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryableError(error)) {
        throw error;
      }
      const delay = AI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
}

function toAppError(error: unknown, fallbackCode: ErrorCode, fallbackStatus = 500): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const status = typeof (error as any)?.status === "number" ? (error as any).status : null;
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (isAbortError(error)) {
    return new AppError("AI_TIMEOUT", "AI request timed out.", 504);
  }
  if (status === 400 && message.toLowerCase().includes("file_data")) {
    return new AppError("UPLOAD_INVALID", "Invalid document payload.", 400);
  }
  if (status === 413) {
    return new AppError("UPLOAD_INVALID", "File is too large.", 413);
  }
  if (status === 429 || (status !== null && status >= 500)) {
    return new AppError("AI_TIMEOUT", "AI service is unavailable.", 503);
  }
  if (error instanceof SyntaxError || error instanceof ZodError) {
    return new AppError("PARSE_FAIL", "Failed to parse AI response.", 422);
  }

  return new AppError(fallbackCode, message, fallbackStatus);
}

function sendError(
  res: Express["response"],
  error: AppError,
  details?: unknown,
) {
  res.status(error.status).json({
    code: error.code,
    message: error.message,
    details: details ?? error.details,
  });
}

async function maybeDeleteUpload(objectPath: string | null | undefined, shouldDelete: boolean) {
  if (!shouldDelete || !objectPath) return;
  await deleteUploadObject(objectPath);
}

async function maybeDeleteUploads(objectPaths: Array<string | null | undefined>, shouldDelete: boolean) {
  if (!shouldDelete) return;
  await Promise.all(
    objectPaths
      .filter((path): path is string => Boolean(path))
      .map((path) => deleteUploadObject(path)),
  );
}

function getCloudConvertApiKey(): string {
  const apiKey = process.env.PDF_TOOLS_CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new AppError("PDF_TOOL_FAIL", "CloudConvert API key is missing.", 500);
  }
  return apiKey;
}

async function withToolTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AppError("PDF_TOOL_FAIL", "PDF tool request timed out.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function cloudConvertRequest<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getCloudConvertApiKey();
  return withToolTimeout(async (signal) => {
    const response = await fetch(`${CLOUDCONVERT_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload?.message === "string" ? payload.message : "CloudConvert request failed.";
      throw new AppError("PDF_TOOL_FAIL", message, response.status || 502, payload);
    }
    return payload as T;
  }, PDF_TOOL_TIMEOUT_MS);
}

type CloudConvertFile = {
  filename: string;
  size: number;
  url: string;
};

function getJobTasks(job: any): Array<Record<string, any>> {
  const data = job?.data ?? job;
  const tasks = data?.tasks;
  if (Array.isArray(tasks)) {
    return tasks as Array<Record<string, any>>;
  }
  if (tasks && typeof tasks === "object") {
    return Object.values(tasks) as Array<Record<string, any>>;
  }
  return [];
}

function extractCloudConvertFiles(job: any, exportTaskName: string): CloudConvertFile[] {
  const tasks = getJobTasks(job);
  const task =
    tasks.find((entry) => entry?.name === exportTaskName) ??
    tasks.find((entry) => entry?.operation === "export/url");
  const files = task?.result?.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError("PDF_TOOL_FAIL", "Conversion did not return output files.", 502);
  }
  return files.map((file: any) => ({
    filename: String(file.filename ?? "output"),
    size: Number(file.size ?? 0),
    url: String(file.url ?? ""),
  }));
}

function inferContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdfa")) return "application/pdf";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  throw new AppError("PDF_TOOL_FAIL", "Unsupported output type.", 500);
}

async function storeCloudConvertFiles(
  files: CloudConvertFile[],
): Promise<
  Array<{
    fileName: string;
    objectPath: string;
    downloadUrl: string;
    sizeBytes: number;
    expiresAtMs: number;
  }>
> {
  const stored: Array<{
    fileName: string;
    objectPath: string;
    downloadUrl: string;
    sizeBytes: number;
    expiresAtMs: number;
  }> = [];

  for (const file of files) {
    if (!file.url) {
      throw new AppError("PDF_TOOL_FAIL", "Missing output download URL.", 502);
    }
    const normalizedName = file.filename.toLowerCase().endsWith(".pdfa")
      ? file.filename.replace(/\.pdfa$/i, ".pdf")
      : file.filename;
    const contentType = inferContentType(normalizedName);
    const signedUpload = await createSignedUploadUrl({
      fileName: normalizedName,
      contentType,
      sizeBytes: file.size || 0,
      allowedMimes: PDF_TOOL_ALLOWED_MIME_TYPES,
      maxFileSizeBytes: PDF_TOOL_MAX_FILE_SIZE_BYTES,
    });
    const downloadResponse = await fetch(file.url);
    if (!downloadResponse.ok) {
      throw new AppError("PDF_TOOL_FAIL", "Failed to download conversion output.", 502);
    }
    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    const uploadResponse = await fetch(signedUpload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    });
    if (!uploadResponse.ok) {
      throw new AppError("PDF_TOOL_FAIL", "Failed to store conversion output.", 502);
    }
    const signedDownload = await createSignedDownloadUrl(signedUpload.objectPath);
    stored.push({
      fileName: normalizedName,
      objectPath: signedUpload.objectPath,
      downloadUrl: signedDownload.downloadUrl,
      sizeBytes: buffer.length,
      expiresAtMs: signedUpload.expiresAtMs,
    });
  }

  return stored;
}

function buildImportTasks(urls: string[]): {
  tasks: Record<string, unknown>;
  importNames: string[];
} {
  const tasks: Record<string, unknown> = {};
  const importNames: string[] = [];

  urls.forEach((url, index) => {
    const name = `import-${index + 1}`;
    tasks[name] = {
      operation: "import/url",
      url,
    };
    importNames.push(name);
  });

  return { tasks, importNames };
}

async function runConversionJob(params: {
  jobId: string;
  downloadUrl: string;
  outputFormat: string;
  inputFormat?: string;
}) {
  const { tasks, importNames } = buildImportTasks([params.downloadUrl]);
  const convertTask: Record<string, unknown> = {
    operation: "convert",
    input: importNames[0],
    output_format: params.outputFormat,
  };
  if (params.inputFormat) {
    convertTask.input_format = params.inputFormat;
  }
  tasks["convert-1"] = convertTask;
  tasks["export-1"] = {
    operation: "export/url",
    input: "convert-1",
  };

  const job = await cloudConvertRequest<any>("/jobs?wait=true", {
    tag: params.jobId,
    tasks,
  });
  const files = extractCloudConvertFiles(job, "export-1");
  return storeCloudConvertFiles(files);
}

async function validateUploadBuffer(
  buffer: Buffer,
  mime: string,
  fileType?: string,
  base64Override?: string,
  sizeBytesOverride?: number,
  options?: {
    allowedMimes?: Set<string>;
    maxFileSizeBytes?: number;
    maxPdfPages?: number;
  },
): Promise<{
  mime: string;
  base64: string;
  buffer?: Buffer;
  sizeBytes: number;
  dataUrl: string;
}> {
  const allowedMimes = options?.allowedMimes ?? INVOICE_ALLOWED_MIME_TYPES;
  const maxFileSizeBytes = options?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
  const maxPdfPages = options?.maxPdfPages ?? MAX_PDF_PAGES;

  if (!allowedMimes.has(mime)) {
    throw new AppError("UPLOAD_INVALID", "Unsupported file type.", 400, {
      allowed: Array.from(allowedMimes),
    });
  }

  if (fileType && fileType !== mime) {
    throw new AppError("UPLOAD_INVALID", "File type mismatch.", 400, {
      expected: fileType,
      received: mime,
    });
  }

  const sizeBytes = sizeBytesOverride ?? buffer.length;
  if (sizeBytes <= 0) {
    throw new AppError("UPLOAD_INVALID", "Empty file data.", 400);
  }

  if (sizeBytes > maxFileSizeBytes) {
    throw new AppError("UPLOAD_INVALID", "File exceeds size limit.", 413, {
      maxBytes: maxFileSizeBytes,
    });
  }

  const detectedMime = detectMimeFromBuffer(buffer);
  if (detectedMime && detectedMime !== mime) {
    throw new AppError("UPLOAD_INVALID", "File type mismatch.", 400, {
      expected: mime,
      detected: detectedMime,
    });
  }

  if (mime === "application/pdf") {
    if (hasPdfScripts(buffer)) {
      throw new AppError("UPLOAD_INVALID", "PDF contains active scripts.", 400);
    }
    try {
      const pdfInfo = await pdfParse(buffer);
      if (pdfInfo.numpages > maxPdfPages) {
        throw new AppError("UPLOAD_INVALID", "PDF has too many pages.", 400, {
          maxPages: maxPdfPages,
          pages: pdfInfo.numpages,
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("UPLOAD_INVALID", "Unable to read PDF.", 400);
    }
  }

  const base64 = base64Override ?? buffer.toString("base64");
  const dataUrl = `data:${mime};base64,${base64}`;
  return {
    mime,
    base64,
    buffer,
    sizeBytes,
    dataUrl,
  };
}

async function validateUpload(
  fileDataUrl: string,
  fileType?: string,
): Promise<{
  mime: string;
  base64: string;
  buffer?: Buffer;
  sizeBytes: number;
  dataUrl: string;
}> {
  const parsed = parseDataUrl(fileDataUrl);
  if (!parsed) {
    throw new AppError("UPLOAD_INVALID", "Invalid file data.", 400);
  }

  const sizeBytes = getBase64Size(parsed.base64);
  const buffer = Buffer.from(parsed.base64, "base64");
  return validateUploadBuffer(buffer, parsed.mime, fileType, parsed.base64, sizeBytes);
}

function normalizePageRange(range?: string): string | undefined {
  if (!range) return undefined;
  const trimmed = range.trim();
  if (!trimmed) return undefined;
  if (!/^[0-9,\-\s]+$/.test(trimmed)) {
    throw new AppError("UPLOAD_INVALID", "Invalid page range format.", 400);
  }
  return trimmed.replace(/\s+/g, "");
}

function mapCompressProfile(quality?: "low" | "medium" | "high"): string {
  if (quality === "high") return "prepress";
  if (quality === "medium") return "print";
  return "web";
}

async function validateToolUploads(
  objectPaths: string[],
  allowedMimes: string[],
): Promise<
  Array<{
    objectPath: string;
    downloadUrl: string;
    upload: { mime: string; sizeBytes: number };
  }>
> {
  if (objectPaths.length > PDF_TOOL_MAX_FILES) {
    throw new AppError("UPLOAD_INVALID", "Too many files uploaded.", 400, {
      maxFiles: PDF_TOOL_MAX_FILES,
    });
  }

  const allowedSet = new Set(allowedMimes);
  const validated: Array<{
    objectPath: string;
    downloadUrl: string;
    upload: { mime: string; sizeBytes: number };
  }> = [];

  for (const objectPath of objectPaths) {
    const fetched = await fetchUploadBuffer(objectPath);
    const upload = await validateUploadBuffer(
      fetched.buffer,
      fetched.contentType,
      undefined,
      undefined,
      fetched.sizeBytes,
      {
        allowedMimes: allowedSet,
        maxFileSizeBytes: PDF_TOOL_MAX_FILE_SIZE_BYTES,
        maxPdfPages: PDF_TOOL_MAX_PDF_PAGES,
      },
    );
    const signed = await createSignedDownloadUrl(objectPath);
    validated.push({
      objectPath,
      downloadUrl: signed.downloadUrl,
      upload: { mime: upload.mime, sizeBytes: upload.sizeBytes },
    });
  }

  return validated;
}

async function enforceToolUsage(req: Express["request"]) {
  const usageScope = getUsageScope(req);
  const entitlement = await getUserEntitlement(
    usageScope.kind === "user" ? usageScope.id : null,
  );
  const isPro =
    entitlement.plan === "pro" &&
    (!entitlement.status ||
      ["active", "trialing", "past_due"].includes(entitlement.status));

  if (!isPro) {
    const usage = await reserveDailyUsage(usageScope, getFreeDailyLimit());
    if (!usage.allowed) {
      throw new AppError(
        "USAGE_LIMIT",
        "Free tier limit reached. Upgrade to Pro for unlimited processing.",
        429,
        {
          limit: usage.limit,
          remaining: usage.remaining,
          scope: usageScope.kind,
        },
      );
    }
  }

  return { usageScope, isPro };
}

function logJobEvent(jobId: string, status: string, details?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event: "job_status",
      job_id: jobId,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function isAdminRequest(req: Express["request"]): boolean {
  const adminToken = process.env.ADMIN_METRICS_TOKEN;
  const authHeader = req.headers.authorization || "";
  if (adminToken) {
    const token =
      authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const headerToken = req.headers["x-admin-token"];
    if (token && token === adminToken) return true;
    if (typeof headerToken === "string" && headerToken === adminToken) return true;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = req.firebaseUser?.email?.toLowerCase();
  if (email && adminEmails.includes(email)) {
    return true;
  }

  return false;
}

function validateUploadMetadata(
  fileType: string,
  fileSize: number,
  options?: { allowedMimes?: Set<string>; maxFileSizeBytes?: number },
) {
  const allowedMimes = options?.allowedMimes ?? INVOICE_ALLOWED_MIME_TYPES;
  const maxFileSizeBytes = options?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;

  if (!allowedMimes.has(fileType)) {
    throw new AppError("UPLOAD_INVALID", "Unsupported file type.", 400, {
      allowed: Array.from(allowedMimes),
    });
  }
  if (fileSize > maxFileSizeBytes) {
    throw new AppError("UPLOAD_INVALID", "File exceeds size limit.", 413, {
      maxBytes: maxFileSizeBytes,
    });
  }
}

const processRequestSchema = z
  .object({
    fileDataUrl: z.string().min(1).optional(),
    objectPath: z.string().min(1).optional(),
    deleteAfterProcessing: z.boolean().optional(),
  })
  .refine((data) => data.fileDataUrl || data.objectPath, {
    message: "fileDataUrl or objectPath is required.",
  });

const extractRequestSchema = z
  .object({
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    fileSize: z.number().int().nonnegative(),
    fileDataUrl: z.string().min(1).optional(),
    objectPath: z.string().min(1).optional(),
    deleteAfterProcessing: z.boolean().optional(),
  })
  .refine((data) => data.fileDataUrl || data.objectPath, {
    message: "fileDataUrl or objectPath is required.",
  });

const mergePdfRequestSchema = z.object({
  objectPaths: z.array(z.string().min(1)).min(2),
  deleteAfterProcessing: z.boolean().optional(),
});

const splitPdfRequestSchema = z.object({
  objectPath: z.string().min(1),
  pages: z.string().optional(),
  deleteAfterProcessing: z.boolean().optional(),
});

const compressPdfRequestSchema = z.object({
  objectPath: z.string().min(1),
  quality: z.enum(["low", "medium", "high"]).optional(),
  deleteAfterProcessing: z.boolean().optional(),
});

const pdfToJpgRequestSchema = z.object({
  objectPath: z.string().min(1),
  pageRange: z.string().optional(),
  quality: z.number().min(30).max(100).optional(),
  dpi: z.number().min(72).max(300).optional(),
  deleteAfterProcessing: z.boolean().optional(),
});

const jpgToPdfRequestSchema = z.object({
  objectPaths: z.array(z.string().min(1)).min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const pdfToWordRequestSchema = z.object({
  objectPath: z.string().min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const pdfToPowerPointRequestSchema = z.object({
  objectPath: z.string().min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const pdfToExcelRequestSchema = z.object({
  objectPath: z.string().min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const wordToPdfRequestSchema = z.object({
  objectPath: z.string().min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const powerPointToPdfRequestSchema = z.object({
  objectPath: z.string().min(1),
  deleteAfterProcessing: z.boolean().optional(),
});

const aiFieldSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const aiExtractedDataSchema = z
  .object({
    fields: z
      .array(aiFieldSchema)
      .min(1)
      .refine(
        (fields) =>
          fields.some((field) => {
            if (field.value === null || field.value === undefined) return false;
            if (typeof field.value === "string") return field.value.trim().length > 0;
            return true;
          }),
        { message: "No extracted field values found." }
      ),
    lineItems: z
      .array(
        z.record(
          z.union([z.string(), z.number(), z.boolean(), z.null()])
        )
      )
      .optional(),
  })
  .passthrough();

const DEFAULT_CONFIDENCE = 0.82;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidDateValue(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const parsed = Date.parse(trimmed);
    return !Number.isNaN(parsed);
  }
  return false;
}

function isValidCurrencyValue(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^[A-Z]{3}$/i.test(trimmed)) return true;
    if (/[€$£¥]/.test(trimmed)) return true;
  }
  return false;
}

function labelMatches(label: string, tokens: string[]): boolean {
  const normalized = label.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function applyValidationRules(
  extractedData: ExtractedData,
): ExtractedData {
  const fields = extractedData.fields.map((field) => {
    const issues: string[] = [];
    const label = field.label ?? "";

    const isDateField = labelMatches(label, ["date", "issued", "due"]);
    const isCurrencyField = labelMatches(label, ["currency", "curr"]);
    const isTotalField = labelMatches(label, ["total", "amount due", "balance due", "grand total"]);
    const isVatField = labelMatches(label, ["vat", "tax"]);

    if (isDateField && !isValidDateValue(field.value)) {
      issues.push("Invalid date format.");
    }

    if ((isTotalField || isVatField) && parseNumberValue(field.value) === null) {
      issues.push("Invalid amount format.");
    }

    if (isCurrencyField && !isValidCurrencyValue(field.value)) {
      issues.push("Invalid currency format.");
    }

    let confidence = clampConfidence(field.confidence) ?? DEFAULT_CONFIDENCE;
    if (field.value === null || field.value === undefined || field.value === "") {
      confidence = Math.min(confidence, 0.4);
    }
    if (issues.length > 0) {
      confidence = Math.min(confidence, LOW_CONFIDENCE_THRESHOLD - 0.05);
    }

    return {
      ...field,
      confidence,
      issues: issues.length > 0 ? issues : undefined,
    };
  });

  const totalField = fields.find((field) =>
    labelMatches(field.label, ["total", "amount due", "balance due", "grand total"]),
  );
  const totalAmount = totalField ? parseNumberValue(totalField.value) : null;

  if (totalAmount !== null) {
    fields.forEach((field, index) => {
      if (!labelMatches(field.label, ["vat", "tax"])) return;
      const vatValue = parseNumberValue(field.value);
      if (vatValue === null) return;
      if (vatValue > totalAmount) {
        const issues = [...(field.issues ?? []), "VAT exceeds total."];
        const confidence = Math.min(field.confidence ?? DEFAULT_CONFIDENCE, LOW_CONFIDENCE_THRESHOLD - 0.1);
        fields[index] = { ...field, issues, confidence };
      }
    });
  }

  return {
    ...extractedData,
    fields,
  };
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getLineItemColumns(lineItems: Array<Record<string, unknown>>): string[] {
  const columns: string[] = [];
  for (const item of lineItems) {
    for (const key of Object.keys(item)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
}

type InvoiceInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "low" | "high" | "auto" }
  | {
    type: "input_file";
    file_data?: string;
    file_id?: string;
    file_url?: string;
    filename?: string;
  };

async function extractDataWithAI(
  fileName: string,
  upload: {
    mime: string;
    base64: string;
    buffer?: Buffer;
    dataUrl: string;
  },
): Promise<ExtractedData> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey || apiKey === "_DUMMY_API_KEY_") {
    throw new AppError("OCR_FAIL", "AI API key is missing.", 500);
  }

  let uploadedFileId: string | null = null;
  try {
    const prompt = `You are a document data extraction system. Extract structured data from the provided invoice, receipt, or statement.

The uploaded file is: "${fileName}" (type: ${upload.mime})

Return a JSON object with this shape:

{
  "fields": [
    { "label": "Invoice Number", "value": "INV-0001", "confidence": 0.86 },
    { "label": "Invoice Date", "value": "2025-01-31", "confidence": 0.74 },
    { "label": "Total", "value": 123.45, "confidence": 0.91 }
  ],
  "lineItems": [
    { "Description": "Item description", "Quantity": 2, "Unit Price": 10.5, "Total": 21.0 }
  ]
}

Use labels as they appear in the document. Use numbers for numeric values and ISO dates where possible.
Include a confidence score for each field between 0 and 1 (0 = low confidence, 1 = high).
Only include fields you can read. If you cannot read any fields, return {"fields": []}.
Return ONLY valid JSON, no explanation.`;

    const inputContent: InvoiceInputContent[] = [
      { type: "input_text", text: prompt },
    ];

    if (upload.mime === "application/pdf") {
      const buffer = upload.buffer ?? Buffer.from(upload.base64, "base64");
      if (buffer.length === 0) {
        throw new AppError("UPLOAD_INVALID", "Invalid PDF data.", 400);
      }

      const uploadResponse = await withRetry(() =>
        withTimeout(async (signal) =>
          getOpenAIClient(apiKey).files.create(
            {
              file: await toFile(buffer, fileName || "document.pdf", {
                type: upload.mime,
              }),
              purpose: "assistants",
            },
            { signal },
          ),
          AI_TIMEOUT_MS,
        ),
      );
      uploadedFileId = uploadResponse.id;
      inputContent.push({
        type: "input_file",
        file_id: uploadResponse.id,
        filename: fileName || "invoice.pdf",
      });
    } else {
      inputContent.push({
        type: "input_image",
        image_url: upload.dataUrl,
        detail: "high",
      });
    }

    const response = await withRetry(() =>
      withTimeout(
        (signal) =>
          getOpenAIClient(apiKey).responses.create(
            {
              model: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4.1-mini",
              input: [
                {
                  role: "user",
                  content: inputContent,
                },
              ],
              text: { format: { type: "json_object" } },
              max_output_tokens: 2048,
            },
            { signal },
          ),
        AI_TIMEOUT_MS,
      ),
    );

    const content = response.output_text;
    if (!content) {
      throw new AppError("PARSE_FAIL", "AI returned an empty response.", 422);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch (error) {
      throw new AppError("PARSE_FAIL", "Failed to parse AI response.", 422);
    }

    let parsed;
    try {
      parsed = aiExtractedDataSchema.parse(parsedJson);
    } catch (error) {
      throw new AppError("PARSE_FAIL", "AI response did not match expected format.", 422, {
        issues: error instanceof ZodError ? error.issues : undefined,
      });
    }

    const fields = parsed.fields.map((field) => ({
      label: field.label,
      value: field.value === undefined ? null : field.value,
      confidence: clampConfidence(field.confidence),
    }));

    return applyValidationRules({
      id: randomUUID(),
      fields,
      lineItems: parsed.lineItems,
    });
  } catch (error) {
    throw toAppError(error, "PARSE_FAIL", 500);
  } finally {
    if (uploadedFileId) {
      try {
        await getOpenAIClient(apiKey).files.delete(uploadedFileId);
      } catch (deleteError) {
        console.warn("Failed to delete OpenAI file:", deleteError);
      }
    }
  }
}

async function extractOcrText(
  fileName: string,
  upload: {
    mime: string;
    base64: string;
    buffer?: Buffer;
    dataUrl: string;
  },
): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey || apiKey === "_DUMMY_API_KEY_") {
    throw new AppError("OCR_FAIL", "AI API key is missing.", 500);
  }

  let uploadedFileId: string | null = null;
  try {
    const prompt =
      "You are an OCR engine. Extract all readable text from the document. Preserve line breaks. Return plain text only.";

    const inputContent: InvoiceInputContent[] = [
      { type: "input_text", text: prompt },
    ];

    if (upload.mime === "application/pdf") {
      const buffer = upload.buffer ?? Buffer.from(upload.base64, "base64");
      if (buffer.length === 0) {
        throw new AppError("UPLOAD_INVALID", "Invalid PDF data.", 400);
      }

      const uploadResponse = await withRetry(() =>
        withTimeout(async (signal) =>
          getOpenAIClient(apiKey).files.create(
            {
              file: await toFile(buffer, fileName || "document.pdf", {
                type: upload.mime,
              }),
              purpose: "assistants",
            },
            { signal },
          ),
          AI_TIMEOUT_MS,
        ),
      );
      uploadedFileId = uploadResponse.id;
      inputContent.push({
        type: "input_file",
        file_id: uploadResponse.id,
        filename: fileName || "invoice.pdf",
      });
    } else {
      inputContent.push({
        type: "input_image",
        image_url: upload.dataUrl,
        detail: "high",
      });
    }

    const response = await withRetry(() =>
      withTimeout(
        (signal) =>
          getOpenAIClient(apiKey).responses.create(
            {
              model: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4.1-mini",
              input: [
                {
                  role: "user",
                  content: inputContent,
                },
              ],
              max_output_tokens: 2048,
            },
            { signal },
          ),
        AI_TIMEOUT_MS,
      ),
    );

    const text = response.output_text?.trim() ?? "";
    if (!text) {
      throw new AppError("OCR_FAIL", "OCR returned no text.", 422);
    }
    return text;
  } catch (error) {
    throw toAppError(error, "OCR_FAIL", 500);
  } finally {
    if (uploadedFileId) {
      try {
        await getOpenAIClient(apiKey).files.delete(uploadedFileId);
      } catch (deleteError) {
        console.warn("Failed to delete OpenAI file:", deleteError);
      }
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const authEnabled = Boolean(
    process.env.REPL_ID && process.env.SESSION_SECRET && process.env.DATABASE_URL,
  );

  if (authEnabled) {
    // Lazy-load auth to avoid requiring DB config when auth is disabled.
    const { setupAuth } = await import("./replit_integrations/auth/replitAuth");
    const { registerAuthRoutes } = await import(
      "./replit_integrations/auth/routes"
    );
    await setupAuth(app);
    registerAuthRoutes(app);

    const userLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const user = (req as any).user as { id?: string; claims?: { sub?: string } } | undefined;
        return user?.id ?? user?.claims?.sub ?? "unknown";
      },
      skip: (req) => {
        const user = (req as any).user as { id?: string; claims?: { sub?: string } } | undefined;
        return !user?.id && !user?.claims?.sub;
      },
    });

    app.use("/api", userLimiter);
  } else {
    app.get("/api/auth/user", (_req, res) => {
      res.status(200).json(null);
    });
    app.get("/api/login", (_req, res) => {
      res.redirect("/login");
    });
    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });
  }

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const payload = z
        .object({
          name: z.string().min(1),
          size: z.number().positive(),
          contentType: z.string().min(1),
          scope: z.enum(["invoice", "pdf_tool"]).optional(),
        })
        .safeParse(req.body ?? {});

      if (!payload.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid upload metadata.", 400, payload.error.issues);
        return sendError(res, error);
      }

      const { name, size, contentType, scope } = payload.data;
      const uploadScope = scope ?? "invoice";
      const allowedMimes =
        uploadScope === "pdf_tool" ? PDF_TOOL_ALLOWED_MIME_TYPES : INVOICE_ALLOWED_MIME_TYPES;
      const maxFileSizeBytes =
        uploadScope === "pdf_tool" ? PDF_TOOL_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
      validateUploadMetadata(contentType, size, { allowedMimes, maxFileSizeBytes });

      const signed = await createSignedUploadUrl({
        fileName: name,
        contentType,
        sizeBytes: size,
        allowedMimes,
        maxFileSizeBytes,
      });

      return res.json({
        uploadUrl: signed.uploadUrl,
        uploadURL: signed.uploadUrl,
        objectPath: signed.objectPath,
        expiresAtMs: signed.expiresAtMs,
        metadata: {
          name,
          size,
          contentType,
        },
      });
    } catch (error) {
      const appError = toAppError(error, "UPLOAD_INVALID", 500);
      return sendError(res, appError);
    }
  });

  app.post("/api/analytics/event", async (req, res) => {
    const eventSchema = z.object({
      name: z.enum([
        "upload_start",
        "upload_success",
        "process_start",
        "process_success",
        "process_fail",
        "export_csv",
        "export_xlsx",
        "upgrade_click",
        "checkout_success",
      ]),
      metadata: z
        .object({
          docType: z.string().optional(),
          durationMs: z.number().optional(),
          errorCode: z.string().optional(),
        })
        .optional(),
    });

    const parsed = eventSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid analytics payload." });
    }

    try {
      await recordAnalyticsEvent(parsed.data);
    } catch (error) {
      console.warn("Failed to record analytics event.");
    }

    return res.json({ ok: true });
  });

  app.get("/admin/metrics", attachFirebaseUser, async (req, res) => {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const daysParam = typeof req.query.days === "string" ? Number(req.query.days) : undefined;
    const summary = await getMetricsSummary(daysParam);
    return res.json(summary);
  });

  app.get("/api/billing/entitlement", async (req, res) => {
    const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? (req as any).user?.claims?.sub;
    if (!userId) {
      return res.json({ plan: "free" });
    }

    try {
      const entitlement = await getUserEntitlement(userId);
      return res.json({
        plan: entitlement.plan ?? "free",
        status: entitlement.status ?? null,
      });
    } catch (error) {
      return res.json({ plan: "free" });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? (req as any).user?.claims?.sub;
      if (!userId) {
        const error = new AppError("AUTH_REQUIRED", "Authentication required.", 401);
        return sendError(res, error);
      }

      const entitlement = await getUserEntitlement(userId);
      const isPro =
        entitlement.plan === "pro" &&
        (!entitlement.status ||
          ["active", "trialing", "past_due"].includes(entitlement.status));
      if (!isPro) {
        const error = new AppError("PLAN_REQUIRED", "Upgrade to Pro to access history.", 403);
        return sendError(res, error);
      }

      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const data = await listHistoryEntriesForUser(userId, { query, limit });
      return res.json(data);
    } catch (error) {
      console.warn("Error listing history");
      const appError = toAppError(error, "PARSE_FAIL", 500);
      return sendError(res, appError);
    }
  });

  app.get("/api/history/:id", async (req, res) => {
    try {
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? (req as any).user?.claims?.sub;
      if (!userId) {
        const error = new AppError("AUTH_REQUIRED", "Authentication required.", 401);
        return sendError(res, error);
      }

      const entitlement = await getUserEntitlement(userId);
      const isPro =
        entitlement.plan === "pro" &&
        (!entitlement.status ||
          ["active", "trialing", "past_due"].includes(entitlement.status));
      if (!isPro) {
        const error = new AppError("PLAN_REQUIRED", "Upgrade to Pro to access history.", 403);
        return sendError(res, error);
      }

      const entry = await getHistoryEntryForUser(userId, req.params.id);
      if (!entry) {
        const error = new AppError("HISTORY_NOT_FOUND", "History item not found.", 404);
        return sendError(res, error);
      }

      return res.json(entry);
    } catch (error) {
      console.warn("Error fetching history item");
      const appError = toAppError(error, "PARSE_FAIL", 500);
      return sendError(res, appError);
    }
  });

  app.post("/api/billing/checkout", async (req, res) => {
    try {
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const entitlement = await getUserEntitlement(userId);
      const stripe = getStripeClient();
      const priceId = getStripePriceId();
      const appUrl = process.env.APP_URL || req.headers.origin || "http://localhost:5000";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: userId,
        customer_email: entitlement.stripeCustomerId ? undefined : req.firebaseUser?.email ?? undefined,
        customer: entitlement.stripeCustomerId ?? undefined,
        allow_promotion_codes: true,
        success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/pricing`,
        subscription_data: {
          metadata: { userId },
        },
        metadata: { userId },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.warn("Error creating checkout session");
      res.status(500).json({ message: "Failed to create checkout session." });
    }
  });

  app.post("/api/billing/webhook", async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).send("Missing Stripe signature.");
    }

    let stripe: Stripe;
    try {
      stripe = getStripeClient();
    } catch (error) {
      console.warn("Stripe client unavailable.");
      return res.status(500).send("Stripe not configured.");
    }
    let event: Stripe.Event;
    try {
      const rawBody = req.rawBody instanceof Buffer ? req.rawBody : Buffer.from(String(req.rawBody || ""));
      event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
    } catch (error) {
      console.warn("Invalid Stripe webhook signature.");
      return res.status(400).send("Invalid signature.");
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (userId) {
          await upsertUserEntitlement(userId, {
            plan: "pro",
            status: session.status ?? "active",
            stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : null,
          });
        }
        await recordAnalyticsEvent({ name: "checkout_success" });
      }

      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        if (customerId) {
          const userId = await findUserIdByStripeCustomerId(customerId);
          if (userId) {
            await applyStripeSubscriptionUpdate(userId, subscription);
          }
        }
      }
    } catch (error) {
      console.warn("Stripe webhook handler failed.");
      return res.status(500).send("Webhook error.");
    }

    return res.json({ received: true });
  });

  // Workflow Routes
  app.post("/api/workflows", async (req, res) => {
    try {
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? "anonymous";
      const { workflowType, documentId, objectPath, fileName, fileType, fileSize } = req.body;

      let finalDocId = documentId;
      if (objectPath && !documentId) {
        const doc = await firestoreAdd("documents", {
          fileName: fileName || "unnamed",
          fileType: fileType || "application/pdf",
          fileSize: fileSize || 0,
          objectPath,
          userId,
        });
        finalDocId = doc.id;
      }

      const instance = await workflowEngine.createInstance(workflowType || "invoice_approval", userId, {
        documentId: finalDocId
      });
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const instance = await firestoreGet("workflow_instances", req.params.id);
      if (!instance) return res.status(404).json({ message: "Not found" });

      const records = await firestoreQuery("invoice_records", [{ field: "instanceId", operator: "==", value: req.params.id }]);

      res.json({ ...instance, invoiceRecord: records[0] || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/workflows/:id/action", async (req, res) => {
    try {
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? "anonymous";
      const { action, data } = req.body;

      const updated = await workflowEngine.advanceStep(req.params.id, userId, action, data);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workflows/:id/timeline", async (req, res) => {
    try {
      const logs = await firestoreQuery("audit_logs",
        [{ field: "instanceId", operator: "==", value: req.params.id }],
        { field: "createdAt", direction: "desc" }
      );
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      const { role } = req.query;
      const queries: any[] = [{ field: "status", operator: "==", value: "pending" }];
      if (role) {
        queries.push({ field: "role", operator: "==", value: role as string });
      }
      const pendingTasks = await firestoreQuery("tasks", queries);
      res.json(pendingTasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/extract", async (req, res) => {
    const jobId = randomUUID();
    let objectPath: string | null | undefined = null;
    let deleteAfterProcessing = false;
    try {
      const parsed = extractRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      const { fileName, fileType, fileSize } = parsed.data;
      validateUploadMetadata(fileType, fileSize);
      const safeFileName = sanitizeFileName(fileName);
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      objectPath = parsed.data.objectPath ?? null;
      logJobEvent(jobId, "created", { fileType, fileSize });

      await recordAnalyticsEvent({
        name: "upload_start",
        metadata: { docType: fileType },
      });

      let upload:
        | {
          mime: string;
          base64: string;
          buffer?: Buffer;
          sizeBytes: number;
          dataUrl: string;
        }
        | null = null;

      if (objectPath) {
        try {
          const fetched = await fetchUploadBuffer(objectPath);
          upload = await validateUploadBuffer(
            fetched.buffer,
            fetched.contentType,
            fileType,
            undefined,
            fetched.sizeBytes,
          );
        } catch (error) {
          const appError = new AppError("UPLOAD_INVALID", "Unable to access uploaded file.", 400);
          return sendError(res, appError);
        }
      } else if (parsed.data.fileDataUrl) {
        upload = await validateUpload(parsed.data.fileDataUrl, fileType);
      }

      if (!upload) {
        const error = new AppError("UPLOAD_INVALID", "No file data provided.", 400);
        return sendError(res, error);
      }

      await recordAnalyticsEvent({
        name: "upload_success",
        metadata: { docType: fileType },
      });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: fileType },
      });

      const processStartedAt = Date.now();
      const usageScope = getUsageScope(req);
      const entitlement = await getUserEntitlement(
        usageScope.kind === "user" ? usageScope.id : null,
      );
      const isPro =
        entitlement.plan === "pro" &&
        (!entitlement.status ||
          ["active", "trialing", "past_due"].includes(entitlement.status));
      if (!isPro) {
        const usage = await reserveDailyUsage(usageScope, getFreeDailyLimit());
        if (!usage.allowed) {
          await recordAnalyticsEvent({
            name: "process_fail",
            metadata: {
              docType: fileType,
              durationMs: Date.now() - processStartedAt,
              errorCode: "USAGE_LIMIT",
            },
          });
          const error = new AppError(
            "USAGE_LIMIT",
            "Free tier limit reached. Upgrade to Pro for unlimited processing.",
            429,
            {
              limit: usage.limit,
              remaining: usage.remaining,
              scope: usageScope.kind,
            },
          );
          return sendError(res, error);
        }
      }

      logJobEvent(jobId, "processing", {
        fileType,
        sizeBytes: upload.sizeBytes,
      });

      try {
        const extractedData = await extractDataWithAI(safeFileName, upload);
        await recordAnalyticsEvent({
          name: "process_success",
          metadata: {
            docType: fileType,
            durationMs: Date.now() - processStartedAt,
          },
        });
        logJobEvent(jobId, "completed");
        await maybeDeleteUpload(objectPath, deleteAfterProcessing);
        return res.json({ jobId, status: "completed", extractedData });
      } catch (error) {
        const appError = toAppError(error, "PARSE_FAIL", 500);
        await recordAnalyticsEvent({
          name: "process_fail",
          metadata: {
            docType: fileType,
            durationMs: Date.now() - processStartedAt,
            errorCode: appError.code,
          },
        });
        logJobEvent(jobId, "ai_failed", { code: appError.code });

        try {
          const ocrText = await extractOcrText(safeFileName, upload);
          logJobEvent(jobId, "needs_review", { code: appError.code });
          await maybeDeleteUpload(objectPath, deleteAfterProcessing);
          return res.json({
            jobId,
            status: "needs_review",
            ocrText,
            errorCode: appError.code,
            errorMessage: appError.message,
          });
        } catch (ocrError) {
          const ocrAppError = toAppError(ocrError, "OCR_FAIL", 500);
          logJobEvent(jobId, "error", { code: ocrAppError.code });
          await maybeDeleteUpload(objectPath, deleteAfterProcessing);
          return sendError(res, ocrAppError);
        }
      }
    } catch (error) {
      const appError = toAppError(error, "OCR_FAIL", 500);
      console.warn("Error processing extract:", appError.code);
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUpload(objectPath, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/merge", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = mergePdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = parsed.data.objectPaths;
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "merge", files: inputPaths.length });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_merge" },
      });

      const { tasks, importNames } = buildImportTasks(
        validated.map((entry) => entry.downloadUrl),
      );
      tasks["merge-1"] = {
        operation: "merge",
        input: importNames,
        output_format: "pdf",
      };
      tasks["pdfa-1"] = {
        operation: "pdf/a",
        input: ["merge-1"],
        conformance_level: "3b",
      };
      tasks["export-1"] = {
        operation: "export/url",
        input: "pdfa-1",
      };

      const job = await cloudConvertRequest<any>("/jobs?wait=true", {
        tag: jobId,
        tasks,
      });
      const files = extractCloudConvertFiles(job, "export-1");
      const storedFiles = await storeCloudConvertFiles(files);

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_merge",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF merge failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_merge",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/split", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = splitPdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const pageRange = normalizePageRange(parsed.data.pages);
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "split" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_split" },
      });

      const { tasks, importNames } = buildImportTasks(
        validated.map((entry) => entry.downloadUrl),
      );
      const splitTask: Record<string, unknown> = {
        operation: "split",
        input: importNames[0],
        output_format: "pdf",
      };
      if (pageRange) {
        splitTask.pages = pageRange;
      }
      tasks["split-1"] = splitTask;
      tasks["export-1"] = {
        operation: "export/url",
        input: "split-1",
      };

      const job = await cloudConvertRequest<any>("/jobs?wait=true", {
        tag: jobId,
        tasks,
      });
      const files = extractCloudConvertFiles(job, "export-1");
      const storedFiles = await storeCloudConvertFiles(files);

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_split",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF split failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_split",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/compress", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = compressPdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const profile = mapCompressProfile(parsed.data.quality);
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "compress", profile });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_compress" },
      });

      const { tasks, importNames } = buildImportTasks(
        validated.map((entry) => entry.downloadUrl),
      );
      tasks["optimize-1"] = {
        operation: "optimize",
        input: importNames[0],
        input_format: "pdf",
        profile,
      };
      tasks["export-1"] = {
        operation: "export/url",
        input: "optimize-1",
      };

      const job = await cloudConvertRequest<any>("/jobs?wait=true", {
        tag: jobId,
        tasks,
      });
      const files = extractCloudConvertFiles(job, "export-1");
      const storedFiles = await storeCloudConvertFiles(files);

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_compress",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF compress failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_compress",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/pdf-to-jpg", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = pdfToJpgRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const pageRange = normalizePageRange(parsed.data.pageRange);
      const quality = parsed.data.quality ?? 85;
      const dpi = parsed.data.dpi ?? 150;
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "pdf_to_jpg", quality, dpi });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_to_jpg" },
      });

      const { tasks, importNames } = buildImportTasks(
        validated.map((entry) => entry.downloadUrl),
      );
      const convertTask: Record<string, unknown> = {
        operation: "convert",
        input: importNames[0],
        output_format: "jpg",
        quality,
        density: dpi,
      };
      if (pageRange) {
        convertTask.page_range = pageRange;
      }
      tasks["convert-1"] = convertTask;
      tasks["export-1"] = {
        operation: "export/url",
        input: "convert-1",
      };

      const job = await cloudConvertRequest<any>("/jobs?wait=true", {
        tag: jobId,
        tasks,
      });
      const files = extractCloudConvertFiles(job, "export-1");
      const storedFiles = await storeCloudConvertFiles(files);

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_to_jpg",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF to JPG failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_to_jpg",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/jpg-to-pdf", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = jpgToPdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = parsed.data.objectPaths;
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, [
        "image/jpeg",
        "image/png",
      ]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "jpg_to_pdf", files: inputPaths.length });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "jpg_to_pdf" },
      });

      const { tasks, importNames } = buildImportTasks(
        validated.map((entry) => entry.downloadUrl),
      );
      const convertNames = importNames.map((name, index) => {
        const convertName = `convert-${index + 1}`;
        tasks[convertName] = {
          operation: "convert",
          input: name,
          output_format: "pdf",
        };
        return convertName;
      });

      tasks["merge-1"] = {
        operation: "merge",
        input: convertNames,
        output_format: "pdf",
      };
      tasks["export-1"] = {
        operation: "export/url",
        input: "merge-1",
      };

      const job = await cloudConvertRequest<any>("/jobs?wait=true", {
        tag: jobId,
        tasks,
      });
      const files = extractCloudConvertFiles(job, "export-1");
      const storedFiles = await storeCloudConvertFiles(files);

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "jpg_to_pdf",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "JPG to PDF failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "jpg_to_pdf",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/pdf-to-word", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = pdfToWordRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "pdf_to_word" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_to_word" },
      });

      const storedFiles = await runConversionJob({
        jobId,
        downloadUrl: validated[0].downloadUrl,
        outputFormat: "docx",
      });

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_to_word",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF to Word failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_to_word",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/pdf-to-powerpoint", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = pdfToPowerPointRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "pdf_to_powerpoint" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_to_powerpoint" },
      });

      const storedFiles = await runConversionJob({
        jobId,
        downloadUrl: validated[0].downloadUrl,
        outputFormat: "pptx",
      });

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_to_powerpoint",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF to PowerPoint failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_to_powerpoint",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/pdf-to-excel", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = pdfToExcelRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, ["application/pdf"]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "pdf_to_excel" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "pdf_to_excel" },
      });

      const storedFiles = await runConversionJob({
        jobId,
        downloadUrl: validated[0].downloadUrl,
        outputFormat: "xlsx",
      });

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "pdf_to_excel",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PDF to Excel failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "pdf_to_excel",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/word-to-pdf", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = wordToPdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "word_to_pdf" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "word_to_pdf" },
      });

      const storedFiles = await runConversionJob({
        jobId,
        downloadUrl: validated[0].downloadUrl,
        outputFormat: "pdf",
      });

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "word_to_pdf",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "Word to PDF failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "word_to_pdf",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/pdf-tools/powerpoint-to-pdf", async (req, res) => {
    const jobId = randomUUID();
    let inputPaths: string[] = [];
    let deleteAfterProcessing = false;
    const processStartedAt = Date.now();
    try {
      const parsed = powerPointToPdfRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      inputPaths = [parsed.data.objectPath];
      deleteAfterProcessing = parsed.data.deleteAfterProcessing ?? false;
      const validated = await validateToolUploads(inputPaths, [
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ]);
      await enforceToolUsage(req);

      logJobEvent(jobId, "processing", { tool: "powerpoint_to_pdf" });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: "powerpoint_to_pdf" },
      });

      const storedFiles = await runConversionJob({
        jobId,
        downloadUrl: validated[0].downloadUrl,
        outputFormat: "pdf",
      });

      await recordAnalyticsEvent({
        name: "process_success",
        metadata: {
          docType: "powerpoint_to_pdf",
          durationMs: Date.now() - processStartedAt,
        },
      });
      logJobEvent(jobId, "completed");
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return res.json({ jobId, status: "completed", files: storedFiles });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
            "PDF_TOOL_FAIL",
            error instanceof Error ? error.message : "PowerPoint to PDF failed.",
            500,
          );
      await recordAnalyticsEvent({
        name: "process_fail",
        metadata: {
          docType: "powerpoint_to_pdf",
          durationMs: Date.now() - processStartedAt,
          errorCode: appError.code,
        },
      });
      logJobEvent(jobId, "error", { code: appError.code });
      await maybeDeleteUploads(inputPaths, deleteAfterProcessing);
      return sendError(res, appError);
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const parsed = uploadRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid upload metadata.", 400, parsed.error.issues);
        return sendError(res, error);
      }

      const { fileName, fileType, fileSize, objectPath } = parsed.data;
      validateUploadMetadata(fileType, fileSize);
      const safeFileName = sanitizeFileName(fileName);
      const userId = req.firebaseUser?.uid ?? (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const session = await storage.createSession(
        safeFileName,
        fileType,
        fileSize,
        userId,
        objectPath,
      );
      logJobEvent(session.id, "created", { fileType, fileSize });
      await recordAnalyticsEvent({
        name: "upload_start",
        metadata: { docType: fileType },
      });

      res.json(session);
    } catch (error) {
      const appError = toAppError(error, "UPLOAD_INVALID", 500);
      console.warn("Error creating session:", appError.code);
      sendError(res, appError);
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.warn("Error getting session");
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.post("/api/sessions/:id/process", async (req, res) => {
    let objectPath: string | null | undefined = null;
    let deleteAfterProcessing = false;
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const parsedProcess = processRequestSchema.safeParse(req.body ?? {});
      if (!parsedProcess.success) {
        const error = new AppError("UPLOAD_INVALID", "Invalid request body.", 400, parsedProcess.error.issues);
        return sendError(res, error);
      }

      deleteAfterProcessing = parsedProcess.data.deleteAfterProcessing ?? false;
      let upload:
        | {
          mime: string;
          base64: string;
          buffer?: Buffer;
          sizeBytes: number;
          dataUrl: string;
        }
        | null = null;

      objectPath = parsedProcess.data.objectPath ?? session.objectPath;
      if (objectPath) {
        try {
          const fetched = await fetchUploadBuffer(objectPath);
          upload = await validateUploadBuffer(
            fetched.buffer,
            fetched.contentType,
            session.fileType,
            undefined,
            fetched.sizeBytes,
          );
        } catch (error) {
          const appError = new AppError("UPLOAD_INVALID", "Unable to access uploaded file.", 400);
          return sendError(res, appError);
        }
      } else if (parsedProcess.data.fileDataUrl) {
        upload = await validateUpload(parsedProcess.data.fileDataUrl, session.fileType);
      }

      if (!upload) {
        const error = new AppError("UPLOAD_INVALID", "No file data provided.", 400);
        return sendError(res, error);
      }
      await recordAnalyticsEvent({
        name: "upload_success",
        metadata: { docType: session.fileType },
      });
      await recordAnalyticsEvent({
        name: "process_start",
        metadata: { docType: session.fileType },
      });
      const processStartedAt = Date.now();
      const usageScope = getUsageScope(req);
      const entitlement = await getUserEntitlement(
        usageScope.kind === "user" ? usageScope.id : null,
      );
      const isPro =
        entitlement.plan === "pro" &&
        (!entitlement.status ||
          ["active", "trialing", "past_due"].includes(entitlement.status));
      if (!isPro) {
        const usage = await reserveDailyUsage(usageScope, getFreeDailyLimit());
        if (!usage.allowed) {
          await recordAnalyticsEvent({
            name: "process_fail",
            metadata: {
              docType: session.fileType,
              durationMs: Date.now() - processStartedAt,
              errorCode: "USAGE_LIMIT",
            },
          });
          const error = new AppError(
            "USAGE_LIMIT",
            "Free tier limit reached. Upgrade to Pro for unlimited processing.",
            429,
            {
              limit: usage.limit,
              remaining: usage.remaining,
              scope: usageScope.kind,
            },
          );
          return sendError(res, error);
        }
      }

      await storage.updateSession(req.params.id, {
        status: "processing",
        objectPath: objectPath ?? session.objectPath,
        errorMessage: undefined,
        errorCode: undefined,
        ocrText: undefined,
      });
      logJobEvent(req.params.id, "processing", {
        fileType: session.fileType,
        sizeBytes: upload.sizeBytes,
      });

      try {
        const extractedData = await extractDataWithAI(session.fileName, upload);
        const updatedSession = await storage.updateSession(req.params.id, {
          status: "completed",
          extractedData,
          errorMessage: undefined,
          errorCode: undefined,
          ocrText: undefined,
        });
        const historyUserId =
          session.userId ?? (usageScope.kind === "user" ? usageScope.id : null);
        if (isPro && historyUserId) {
          try {
            await saveHistoryEntryForUser(historyUserId, session, extractedData);
            logJobEvent(req.params.id, "history_saved");
          } catch (historyError) {
            console.warn("History save failed.");
          }
        }
        await recordAnalyticsEvent({
          name: "process_success",
          metadata: {
            docType: session.fileType,
            durationMs: Date.now() - processStartedAt,
          },
        });
        logJobEvent(req.params.id, "completed");
        await maybeDeleteUpload(objectPath, deleteAfterProcessing);
        return res.json(updatedSession);
      } catch (error) {
        const appError = toAppError(error, "PARSE_FAIL", 500);
        await recordAnalyticsEvent({
          name: "process_fail",
          metadata: {
            docType: session.fileType,
            durationMs: Date.now() - processStartedAt,
            errorCode: appError.code,
          },
        });
        logJobEvent(req.params.id, "ai_failed", { code: appError.code });

        try {
          const ocrText = await extractOcrText(session.fileName, upload);
          const updatedSession = await storage.updateSession(req.params.id, {
            status: "needs_review",
            ocrText,
            errorCode: appError.code,
            errorMessage: appError.message,
          });
          logJobEvent(req.params.id, "needs_review", { code: appError.code });
          await maybeDeleteUpload(objectPath, deleteAfterProcessing);
          return res.json(updatedSession);
        } catch (ocrError) {
          const ocrAppError = toAppError(ocrError, "OCR_FAIL", 500);
          await storage.updateSession(req.params.id, {
            status: "error",
            errorCode: ocrAppError.code,
            errorMessage: ocrAppError.message,
          });
          logJobEvent(req.params.id, "error", { code: ocrAppError.code });
          await maybeDeleteUpload(objectPath, deleteAfterProcessing);
          return sendError(res, ocrAppError);
        }
      }
    } catch (error) {
      const appError = toAppError(error, "OCR_FAIL", 500);
      console.warn("Error processing session:", appError.code);
      await maybeDeleteUpload(objectPath, deleteAfterProcessing);
      await storage.updateSession(req.params.id, {
        status: "error",
        errorCode: appError.code,
        errorMessage: appError.message,
      });
      logJobEvent(req.params.id, "error", { code: appError.code });
      sendError(res, appError);
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const deleted = await storage.deleteSession(req.params.id);
      if (session.objectPath) {
        await deleteUploadObject(session.objectPath);
      }
      res.json({ success: true });
    } catch (error) {
      console.warn("Error deleting session");
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.post("/api/export/csv", async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      const headers = ["Field", "Value"];
      const fields = Array.isArray(data.fields) ? data.fields : [];
      const rows = fields.map((field: any) => [
        formatCellValue(field?.label),
        formatCellValue(field?.value),
      ]);

      if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        const columns = getLineItemColumns(data.lineItems);
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(columns);
        for (const item of data.lineItems) {
          rows.push(columns.map((column) => formatCellValue(item?.[column])));
        }
      }

      const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="extracted-data.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.warn("Error exporting CSV");
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  app.post("/api/export/excel", async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      const fields = Array.isArray(data.fields) ? data.fields : [];
      const rows = [
        ["Field", "Value"],
        ...fields.map((field: any) => [
          formatCellValue(field?.label),
          formatCellValue(field?.value),
        ]),
      ];

      if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        const columns = getLineItemColumns(data.lineItems);
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(columns);
        for (const item of data.lineItems) {
          rows.push(columns.map((column) => formatCellValue(item?.[column])));
        }
      }

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "Document");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="extracted-data.xlsx"`);
      res.send(buffer);
    } catch (error) {
      console.warn("Error exporting Excel");
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  registerWorkflowRoutes(app);

  return httpServer;
}
