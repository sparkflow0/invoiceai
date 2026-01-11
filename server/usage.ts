import type { Request } from "express";
import { createHash } from "crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getFirestore } from "./firebase-admin";

export type UsageScope = {
  kind: "user" | "ip";
  id: string;
};

export type UsageResult = {
  allowed: boolean;
  limit: number;
  count: number;
  remaining: number;
};

const FREE_DAILY_LIMIT_RAW = Number(process.env.FREE_DAILY_LIMIT ?? "3");
const FREE_DAILY_LIMIT =
  Number.isFinite(FREE_DAILY_LIMIT_RAW) && FREE_DAILY_LIMIT_RAW > 0
    ? FREE_DAILY_LIMIT_RAW
    : 3;

const memoryUsage = new Map<string, { count: number; dateKey: string }>();

function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function hashIdentifier(value: string): string {
  const salt = process.env.USAGE_SALT ?? "";
  return createHash("sha256").update(`${value}:${salt}`).digest("hex").slice(0, 32);
}

export function getUsageScope(req: Request): UsageScope {
  const firebaseUserId = req.firebaseUser?.uid;
  const legacyUser = (req as any).user as { id?: string; claims?: { sub?: string } } | undefined;
  const legacyUserId = legacyUser?.id ?? legacyUser?.claims?.sub;
  const userId = firebaseUserId ?? legacyUserId;

  if (userId) {
    return { kind: "user", id: userId };
  }

  const ip = req.ip || "unknown";
  return { kind: "ip", id: hashIdentifier(ip) };
}

function usageDocId(scope: UsageScope, dateKey: string): string {
  return `${scope.kind}:${scope.id}:${dateKey}`;
}

async function reserveUsageFirestore(
  firestore: Firestore,
  scope: UsageScope,
  limit: number,
  dateKey: string,
): Promise<UsageResult> {
  const docId = usageDocId(scope, dateKey);
  const docRef = firestore.collection("usage").doc(docId);

  return firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const data = snapshot.data() as { count?: number; dateKey?: string } | undefined;
    const currentCount = data?.count ?? 0;

    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        count: currentCount,
        remaining: 0,
      };
    }

    const nextCount = currentCount + 1;
    tx.set(
      docRef,
      {
        scope: scope.kind,
        scopeId: scope.id,
        dateKey,
        count: nextCount,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    return {
      allowed: true,
      limit,
      count: nextCount,
      remaining: Math.max(0, limit - nextCount),
    };
  });
}

function reserveUsageMemory(scope: UsageScope, limit: number, dateKey: string): UsageResult {
  const key = usageDocId(scope, dateKey);
  const existing = memoryUsage.get(key);
  const currentCount = existing?.dateKey === dateKey ? existing.count : 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      count: currentCount,
      remaining: 0,
    };
  }

  const nextCount = currentCount + 1;
  memoryUsage.set(key, { count: nextCount, dateKey });
  return {
    allowed: true,
    limit,
    count: nextCount,
    remaining: Math.max(0, limit - nextCount),
  };
}

export async function reserveDailyUsage(scope: UsageScope, limit = FREE_DAILY_LIMIT) {
  const dateKey = getDateKey();
  const firestore = getFirestore();

  if (!firestore) {
    return reserveUsageMemory(scope, limit, dateKey);
  }

  return reserveUsageFirestore(firestore, scope, limit, dateKey);
}

export function getFreeDailyLimit(): number {
  return FREE_DAILY_LIMIT;
}
