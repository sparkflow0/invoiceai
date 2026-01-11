import { randomUUID } from "crypto";
import { getFirestore, getStorageBucket } from "./firebase-admin";
import {
  INVOICE_ALLOWED_MIME_TYPES,
  DEFAULT_UPLOAD_TTL_MS,
  MAX_FILE_SIZE_BYTES,
  sanitizeFileName,
} from "./upload-utils";

type UploadRecord = {
  id: string;
  objectPath: string;
  contentType: string;
  sizeBytes: number;
  createdAtMs: number;
  expiresAtMs: number;
};

const UPLOAD_COLLECTION = "uploads";
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const MEMORY_UPLOADS = new Map<string, UploadRecord>();

function buildObjectPath(fileName: string) {
  const safeName = sanitizeFileName(fileName);
  return `uploads/${randomUUID()}-${safeName}`;
}

export function normalizeObjectPath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    throw new Error("Invalid object path.");
  }
  return trimmed;
}

function toDate(ms: number): Date {
  return new Date(ms);
}

function validateUploadRequest(
  contentType: string,
  sizeBytes: number,
  options?: { allowedMimes?: Set<string>; maxFileSizeBytes?: number },
) {
  const allowedMimes = options?.allowedMimes ?? INVOICE_ALLOWED_MIME_TYPES;
  const maxFileSizeBytes = options?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;

  if (!allowedMimes.has(contentType)) {
    throw new Error("Unsupported file type.");
  }
  if (sizeBytes > maxFileSizeBytes) {
    throw new Error("File exceeds size limit.");
  }
}

async function storeUploadRecord(record: UploadRecord) {
  const firestore = getFirestore();
  if (!firestore) {
    MEMORY_UPLOADS.set(record.id, record);
    return;
  }

  await firestore.collection(UPLOAD_COLLECTION).doc(record.id).set({
    ...record,
    createdAt: toDate(record.createdAtMs),
    expiresAt: toDate(record.expiresAtMs),
  });
}

async function deleteUploadRecordByPath(objectPath: string) {
  const firestore = getFirestore();
  if (!firestore) {
    for (const [id, record] of MEMORY_UPLOADS.entries()) {
      if (record.objectPath === objectPath) {
        MEMORY_UPLOADS.delete(id);
      }
    }
    return;
  }

  const snapshot = await firestore
    .collection(UPLOAD_COLLECTION)
    .where("objectPath", "==", objectPath)
    .limit(5)
    .get();

  if (snapshot.empty) return;
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

export async function createSignedUploadUrl(params: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  allowedMimes?: Set<string>;
  maxFileSizeBytes?: number;
}): Promise<{ uploadUrl: string; objectPath: string; expiresAtMs: number }> {
  validateUploadRequest(params.contentType, params.sizeBytes, {
    allowedMimes: params.allowedMimes,
    maxFileSizeBytes: params.maxFileSizeBytes,
  });

  const bucket = getStorageBucket();
  if (!bucket) {
    throw new Error("Storage bucket unavailable.");
  }

  const objectPath = buildObjectPath(params.fileName);
  const normalizedPath = normalizeObjectPath(objectPath);
  const file = bucket.file(normalizedPath);
  const expiresAtMs = Date.now() + DEFAULT_UPLOAD_TTL_MS;

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType: params.contentType,
  });

  await storeUploadRecord({
    id: randomUUID(),
    objectPath: normalizedPath,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
    createdAtMs: Date.now(),
    expiresAtMs,
  });

  return { uploadUrl, objectPath: normalizedPath, expiresAtMs };
}

export async function createSignedDownloadUrl(objectPath: string): Promise<{
  downloadUrl: string;
  expiresAtMs: number;
}> {
  const bucket = getStorageBucket();
  if (!bucket) {
    throw new Error("Storage bucket unavailable.");
  }

  const normalizedPath = normalizeObjectPath(objectPath);
  const file = bucket.file(normalizedPath);
  const expiresAtMs = Date.now() + SIGNED_URL_TTL_MS;

  const [downloadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAtMs,
  });

  return { downloadUrl, expiresAtMs };
}

export async function fetchUploadBuffer(objectPath: string): Promise<{
  buffer: Buffer;
  contentType: string;
  sizeBytes: number;
}> {
  const bucket = getStorageBucket();
  if (!bucket) {
    throw new Error("Storage bucket unavailable.");
  }

  const normalizedPath = normalizeObjectPath(objectPath);
  const file = bucket.file(normalizedPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();

  return {
    buffer,
    contentType: metadata.contentType || "application/octet-stream",
    sizeBytes: Number(metadata.size) || buffer.length,
  };
}

export async function deleteUploadObject(objectPath: string) {
  const bucket = getStorageBucket();
  if (!bucket) return;

  const normalizedPath = normalizeObjectPath(objectPath);
  try {
    await bucket.file(normalizedPath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn("Failed to delete upload object.");
  } finally {
    await deleteUploadRecordByPath(normalizedPath);
  }
}

export async function cleanupExpiredUploads(limit = 200) {
  const nowMs = Date.now();
  const firestore = getFirestore();

  if (!firestore) {
    for (const record of MEMORY_UPLOADS.values()) {
      if (record.expiresAtMs <= nowMs) {
        await deleteUploadObject(record.objectPath);
      }
    }
    return;
  }

  const snapshot = await firestore
    .collection(UPLOAD_COLLECTION)
    .where("expiresAtMs", "<=", nowMs)
    .limit(limit)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const data = doc.data() as UploadRecord | undefined;
    if (!data?.objectPath) {
      await doc.ref.delete();
      continue;
    }
    await deleteUploadObject(data.objectPath);
    await doc.ref.delete();
  }
}
