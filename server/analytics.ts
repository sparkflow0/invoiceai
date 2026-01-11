import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getFirestore } from "./firebase-admin";

export type AnalyticsEventName =
  | "upload_start"
  | "upload_success"
  | "process_start"
  | "process_success"
  | "process_fail"
  | "export_csv"
  | "export_xlsx"
  | "upgrade_click"
  | "checkout_success";

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  metadata?: {
    docType?: string;
    durationMs?: number;
    errorCode?: string;
  };
};

type AnalyticsBucket = {
  dateKey: string;
  events: Record<string, number>;
  errors: Record<string, number>;
  docTypes: Record<string, number>;
  processing: {
    totalMs: number;
    count: number;
    success: number;
    fail: number;
  };
};

type MetricsSummary = {
  range: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    events: Record<string, number>;
    errors: Record<string, number>;
    docTypes: Record<string, number>;
    processing: {
      totalMs: number;
      count: number;
      success: number;
      fail: number;
      successRate: number;
      avgDurationMs: number;
    };
  };
  daily: Array<{
    date: string;
    events: Record<string, number>;
    errors: Record<string, number>;
    docTypes: Record<string, number>;
    processing: {
      totalMs: number;
      count: number;
      success: number;
      fail: number;
      successRate: number;
      avgDurationMs: number;
    };
  }>;
  topErrors: Array<{ code: string; count: number }>;
};

const memoryBuckets = new Map<string, AnalyticsBucket>();

function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function ensureBucket(dateKey: string): AnalyticsBucket {
  const existing = memoryBuckets.get(dateKey);
  if (existing) return existing;
  const bucket: AnalyticsBucket = {
    dateKey,
    events: {},
    errors: {},
    docTypes: {},
    processing: {
      totalMs: 0,
      count: 0,
      success: 0,
      fail: 0,
    },
  };
  memoryBuckets.set(dateKey, bucket);
  return bucket;
}

function incrementRecord(record: Record<string, number>, key: string, value = 1) {
  record[key] = (record[key] ?? 0) + value;
}

function updateBucket(bucket: AnalyticsBucket, event: AnalyticsEvent) {
  incrementRecord(bucket.events, event.name);

  const docType = event.metadata?.docType ? sanitizeKey(event.metadata.docType) : null;
  if (docType) {
    incrementRecord(bucket.docTypes, docType);
  }

  if (event.metadata?.durationMs !== undefined) {
    bucket.processing.totalMs += Math.max(0, event.metadata.durationMs);
    bucket.processing.count += 1;
  }

  if (event.name === "process_success") {
    bucket.processing.success += 1;
  }
  if (event.name === "process_fail") {
    bucket.processing.fail += 1;
    if (event.metadata?.errorCode) {
      incrementRecord(bucket.errors, sanitizeKey(event.metadata.errorCode));
    }
  }
}

async function updateFirestore(firestore: Firestore, dateKey: string, event: AnalyticsEvent) {
  const docRef = firestore.collection("analytics_daily").doc(dateKey);
  const update: Record<string, unknown> = {
    dateKey,
    updatedAt: FieldValue.serverTimestamp(),
    [`events.${event.name}`]: FieldValue.increment(1),
  };

  if (event.metadata?.docType) {
    update[`docTypes.${sanitizeKey(event.metadata.docType)}`] = FieldValue.increment(1);
  }

  if (event.metadata?.durationMs !== undefined) {
    update["processing.totalMs"] = FieldValue.increment(Math.max(0, event.metadata.durationMs));
    update["processing.count"] = FieldValue.increment(1);
  }

  if (event.name === "process_success") {
    update["processing.success"] = FieldValue.increment(1);
  }

  if (event.name === "process_fail") {
    update["processing.fail"] = FieldValue.increment(1);
    if (event.metadata?.errorCode) {
      update[`errors.${sanitizeKey(event.metadata.errorCode)}`] = FieldValue.increment(1);
    }
  }

  await docRef.set(update, { merge: true });
}

export async function recordAnalyticsEvent(event: AnalyticsEvent) {
  const dateKey = getDateKey();
  const firestore = getFirestore();
  if (!firestore) {
    const bucket = ensureBucket(dateKey);
    updateBucket(bucket, event);
    return;
  }

  try {
    await updateFirestore(firestore, dateKey, event);
  } catch (error) {
    const bucket = ensureBucket(dateKey);
    updateBucket(bucket, event);
  }
}

function buildProcessingSummary(processing: AnalyticsBucket["processing"]) {
  const total = processing.totalMs;
  const count = processing.count;
  const success = processing.success;
  const fail = processing.fail;
  const totalAttempts = success + fail;
  return {
    totalMs: total,
    count,
    success,
    fail,
    successRate: totalAttempts > 0 ? success / totalAttempts : 0,
    avgDurationMs: count > 0 ? Math.round(total / count) : 0,
  };
}

function buildTotals(daily: MetricsSummary["daily"]) {
  const totals: MetricsSummary["totals"] = {
    events: {},
    errors: {},
    docTypes: {},
    processing: {
      totalMs: 0,
      count: 0,
      success: 0,
      fail: 0,
      successRate: 0,
      avgDurationMs: 0,
    },
  };

  for (const day of daily) {
    for (const [key, value] of Object.entries(day.events)) {
      totals.events[key] = (totals.events[key] ?? 0) + value;
    }
    for (const [key, value] of Object.entries(day.errors)) {
      totals.errors[key] = (totals.errors[key] ?? 0) + value;
    }
    for (const [key, value] of Object.entries(day.docTypes)) {
      totals.docTypes[key] = (totals.docTypes[key] ?? 0) + value;
    }
    totals.processing.totalMs += day.processing.totalMs;
    totals.processing.count += day.processing.count;
    totals.processing.success += day.processing.success;
    totals.processing.fail += day.processing.fail;
  }

  const totalAttempts = totals.processing.success + totals.processing.fail;
  totals.processing.successRate = totalAttempts > 0 ? totals.processing.success / totalAttempts : 0;
  totals.processing.avgDurationMs =
    totals.processing.count > 0
      ? Math.round(totals.processing.totalMs / totals.processing.count)
      : 0;

  return totals;
}

function buildTopErrors(errors: Record<string, number>) {
  return Object.entries(errors)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function getDailyBucketsFirestore(firestore: Firestore, days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));
  const startKey = getDateKey(startDate);

  const snapshot = await firestore
    .collection("analytics_daily")
    .where("dateKey", ">=", startKey)
    .orderBy("dateKey", "asc")
    .get();

  return snapshot.docs.map((doc) => doc.data() as AnalyticsBucket);
}

function getDailyBucketsMemory(days: number) {
  const buckets: AnalyticsBucket[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = getDateKey(date);
    const bucket = memoryBuckets.get(dateKey);
    if (bucket) {
      buckets.push(bucket);
    }
  }
  return buckets;
}

export async function getMetricsSummary(days = 14): Promise<MetricsSummary> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 14;
  const endDate = getDateKey();
  const startDate = getDateKey(new Date(Date.now() - (safeDays - 1) * 24 * 60 * 60 * 1000));

  const firestore = getFirestore();
  const buckets = firestore
    ? await getDailyBucketsFirestore(firestore, safeDays)
    : getDailyBucketsMemory(safeDays);

  const daily = buckets.map((bucket) => ({
    date: bucket.dateKey,
    events: bucket.events ?? {},
    errors: bucket.errors ?? {},
    docTypes: bucket.docTypes ?? {},
    processing: buildProcessingSummary(bucket.processing ?? {
      totalMs: 0,
      count: 0,
      success: 0,
      fail: 0,
    }),
  }));

  const totals = buildTotals(daily);

  return {
    range: {
      start: startDate,
      end: endDate,
      days: safeDays,
    },
    totals,
    daily,
    topErrors: buildTopErrors(totals.errors),
  };
}
