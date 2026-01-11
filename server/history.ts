import { randomUUID } from "crypto";
import type { ExtractedData, ProcessingSession } from "@shared/schema";
import { getFirestore } from "./firebase-admin";

const HISTORY_COLLECTION = "document_history";
const HISTORY_RETENTION_MIN_DAYS = 30;
const HISTORY_RETENTION_MAX_DAYS = 90;
const HISTORY_RETENTION_DEFAULT_DAYS = 30;
const HISTORY_LIST_MAX = 200;

type HistoryEntry = {
  id: string;
  userId: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  vendorName?: string | null;
  documentDate?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  extractedData: ExtractedData;
  fieldsCount: number;
  lineItemsCount: number;
  createdAtMs: number;
  expiresAtMs: number;
};

export type HistorySummary = Omit<HistoryEntry, "userId" | "extractedData">;

type HistoryQuery = {
  query?: string;
  limit?: number;
};

type HistoryMetadata = Pick<
  HistoryEntry,
  "vendorName" | "documentDate" | "invoiceNumber" | "totalAmount" | "currency"
>;

const MEMORY_HISTORY = new Map<string, HistoryEntry[]>();

function clampRetentionDays(value: number | null): number {
  if (!value || !Number.isFinite(value)) {
    return HISTORY_RETENTION_DEFAULT_DAYS;
  }
  return Math.min(
    HISTORY_RETENTION_MAX_DAYS,
    Math.max(HISTORY_RETENTION_MIN_DAYS, Math.floor(value)),
  );
}

export function getHistoryRetentionDays(): number {
  const raw = Number(process.env.HISTORY_RETENTION_DAYS);
  return clampRetentionDays(Number.isFinite(raw) ? raw : null);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCurrency(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.toUpperCase().match(/\b[A-Z]{3}\b/);
  if (match) return match[0];
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("¥")) return "JPY";
  return null;
}

type FieldMatchOptions = {
  exclude?: string[];
};

function findFieldByKeywords(
  fields: ExtractedData["fields"],
  keywords: string[],
  options: FieldMatchOptions = {},
) {
  const normalized = fields.map((field) => ({
    field,
    label: field.label.toLowerCase(),
  }));
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    const match = normalized.find(({ label }) => {
      if (!label.includes(lowerKeyword)) return false;
      if (!options.exclude || options.exclude.length === 0) return true;
      return !options.exclude.some((excluded) => label.includes(excluded.toLowerCase()));
    });
    if (match) {
      return match.field;
    }
  }
  return null;
}

function deriveHistoryMetadata(extractedData: ExtractedData): HistoryMetadata {
  const fields = Array.isArray(extractedData.fields) ? extractedData.fields : [];

  const vendorField = findFieldByKeywords(fields, [
    "vendor",
    "seller",
    "merchant",
    "supplier",
    "store",
    "issued by",
    "from",
  ]);
  const invoiceField = findFieldByKeywords(fields, [
    "invoice number",
    "invoice #",
    "invoice no",
    "receipt number",
    "statement number",
    "reference",
    "ref",
  ]);
  const dateField =
    findFieldByKeywords(fields, [
      "invoice date",
      "receipt date",
      "statement date",
      "issue date",
      "transaction date",
    ]) ??
    findFieldByKeywords(fields, ["date"], { exclude: ["due"] }) ??
    findFieldByKeywords(fields, ["due date"]);
  const totalField =
    findFieldByKeywords(fields, [
      "total amount",
      "amount due",
      "balance due",
      "grand total",
      "total",
    ], { exclude: ["subtotal", "sub total", "tax", "vat"] }) ??
    findFieldByKeywords(fields, ["amount"], { exclude: ["tax", "vat", "subtotal", "sub total"] });
  const currencyField = findFieldByKeywords(fields, ["currency", "currency code", "curr"]);

  const vendorName = normalizeText(vendorField?.value);
  const invoiceNumber = normalizeText(invoiceField?.value);
  const documentDate = normalizeText(dateField?.value);
  const totalAmount = normalizeAmount(totalField?.value);
  const currency =
    normalizeCurrency(currencyField?.value) ??
    normalizeCurrency(totalField?.value);

  return {
    vendorName,
    documentDate,
    invoiceNumber,
    totalAmount,
    currency,
  };
}

function buildHistoryEntry(
  userId: string,
  session: ProcessingSession,
  extractedData: ExtractedData,
): HistoryEntry {
  const nowMs = Date.now();
  const retentionDays = getHistoryRetentionDays();
  const expiresAtMs = nowMs + retentionDays * 24 * 60 * 60 * 1000;
  const metadata = deriveHistoryMetadata(extractedData);

  return {
    id: randomUUID(),
    userId,
    sessionId: session.id,
    fileName: session.fileName,
    fileType: session.fileType,
    fileSize: session.fileSize,
    vendorName: metadata.vendorName,
    documentDate: metadata.documentDate,
    invoiceNumber: metadata.invoiceNumber,
    totalAmount: metadata.totalAmount,
    currency: metadata.currency,
    extractedData,
    fieldsCount: extractedData.fields?.length ?? 0,
    lineItemsCount: extractedData.lineItems?.length ?? 0,
    createdAtMs: nowMs,
    expiresAtMs,
  };
}

function isExpired(entry: HistoryEntry, nowMs: number): boolean {
  return entry.expiresAtMs > 0 && entry.expiresAtMs <= nowMs;
}

function matchesQuery(entry: HistoryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystacks = [
    entry.vendorName,
    entry.documentDate,
    entry.invoiceNumber,
    entry.currency,
    entry.fileName,
    entry.fileType,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (haystacks.some((value) => value.includes(q))) {
    return true;
  }

  if (entry.totalAmount !== null && entry.totalAmount !== undefined) {
    return String(entry.totalAmount).includes(q);
  }

  return false;
}

function toSummary(entry: HistoryEntry): HistorySummary {
  const { userId, extractedData, ...summary } = entry;
  return summary;
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.min(HISTORY_LIST_MAX, Math.max(1, Math.floor(limit)));
}

async function saveHistoryToFirestore(entry: HistoryEntry) {
  const firestore = getFirestore();
  if (!firestore) return;

  await firestore.collection(HISTORY_COLLECTION).doc(entry.id).set({
    ...entry,
    createdAt: new Date(entry.createdAtMs),
    expiresAt: new Date(entry.expiresAtMs),
  });
}

function hydrateHistoryEntry(id: string, data: Record<string, any>): HistoryEntry | null {
  if (!data || typeof data !== "object") return null;
  const extractedData = data.extractedData as ExtractedData | undefined;
  if (!extractedData || !Array.isArray(extractedData.fields)) {
    return null;
  }

  const createdAtMs =
    typeof data.createdAtMs === "number"
      ? data.createdAtMs
      : typeof data.createdAt?.toMillis === "function"
        ? data.createdAt.toMillis()
        : Date.now();
  const expiresAtMs =
    typeof data.expiresAtMs === "number"
      ? data.expiresAtMs
      : typeof data.expiresAt?.toMillis === "function"
        ? data.expiresAt.toMillis()
        : createdAtMs + getHistoryRetentionDays() * 24 * 60 * 60 * 1000;

  return {
    id,
    userId: String(data.userId || ""),
    sessionId: String(data.sessionId || ""),
    fileName: String(data.fileName || ""),
    fileType: String(data.fileType || ""),
    fileSize: typeof data.fileSize === "number" ? data.fileSize : undefined,
    vendorName: typeof data.vendorName === "string" ? data.vendorName : null,
    documentDate: typeof data.documentDate === "string" ? data.documentDate : null,
    invoiceNumber: typeof data.invoiceNumber === "string" ? data.invoiceNumber : null,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    currency: typeof data.currency === "string" ? data.currency : null,
    extractedData,
    fieldsCount: typeof data.fieldsCount === "number" ? data.fieldsCount : extractedData.fields.length,
    lineItemsCount:
      typeof data.lineItemsCount === "number"
        ? data.lineItemsCount
        : extractedData.lineItems?.length ?? 0,
    createdAtMs,
    expiresAtMs,
  };
}

async function deleteHistoryEntry(userId: string, id: string) {
  const firestore = getFirestore();
  if (firestore) {
    await firestore.collection(HISTORY_COLLECTION).doc(id).delete();
    return;
  }

  const entries = MEMORY_HISTORY.get(userId) ?? [];
  MEMORY_HISTORY.set(
    userId,
    entries.filter((entry) => entry.id !== id),
  );
}

export async function saveHistoryEntryForUser(
  userId: string,
  session: ProcessingSession,
  extractedData: ExtractedData,
): Promise<HistoryEntry | null> {
  if (!userId) return null;
  const entry = buildHistoryEntry(userId, session, extractedData);

  const firestore = getFirestore();
  if (firestore) {
    await saveHistoryToFirestore(entry);
    return entry;
  }

  const entries = MEMORY_HISTORY.get(userId) ?? [];
  entries.unshift(entry);
  MEMORY_HISTORY.set(userId, entries);
  return entry;
}

export async function listHistoryEntriesForUser(
  userId: string,
  query: HistoryQuery = {},
): Promise<{ items: HistorySummary[]; retentionDays: number }> {
  const retentionDays = getHistoryRetentionDays();
  const limit = normalizeLimit(query.limit);
  const nowMs = Date.now();
  const normalizedQuery = query.query?.trim().toLowerCase() ?? "";

  const firestore = getFirestore();
  let entries: HistoryEntry[] = [];

  if (firestore) {
    const fetchLimit = Math.min(HISTORY_LIST_MAX, Math.max(limit * 3, limit));
    const snapshot = await firestore
      .collection(HISTORY_COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAtMs", "desc")
      .limit(fetchLimit)
      .get();

    entries = snapshot.docs
      .map((doc) => hydrateHistoryEntry(doc.id, doc.data()))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  } else {
    entries = [...(MEMORY_HISTORY.get(userId) ?? [])];
  }

  const expiredIds = entries.filter((entry) => isExpired(entry, nowMs)).map((entry) => entry.id);
  if (expiredIds.length > 0) {
    await Promise.allSettled(expiredIds.map((id) => deleteHistoryEntry(userId, id)));
    entries = entries.filter((entry) => !expiredIds.includes(entry.id));
  }

  const filtered = entries.filter((entry) => matchesQuery(entry, normalizedQuery));
  const sorted = filtered.sort((a, b) => b.createdAtMs - a.createdAtMs);
  const items = sorted.slice(0, limit).map((entry) => toSummary(entry));

  return { items, retentionDays };
}

export async function getHistoryEntryForUser(
  userId: string,
  id: string,
): Promise<HistoryEntry | null> {
  const firestore = getFirestore();
  if (firestore) {
    const doc = await firestore.collection(HISTORY_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    const entry = hydrateHistoryEntry(doc.id, doc.data());
    if (!entry || entry.userId !== userId) return null;
    if (isExpired(entry, Date.now())) {
      await deleteHistoryEntry(userId, id);
      return null;
    }
    return entry;
  }

  const entries = MEMORY_HISTORY.get(userId) ?? [];
  const entry = entries.find((item) => item.id === id);
  if (!entry) return null;
  if (isExpired(entry, Date.now())) {
    await deleteHistoryEntry(userId, id);
    return null;
  }
  return entry;
}
