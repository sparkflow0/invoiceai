import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";
export * from "./models/workflow";

const extractedFieldSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1).optional().nullable(),
  issues: z.array(z.string()).optional(),
});

const extractedLineItemSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const extractedDataSchema = z.object({
  id: z.string(),
  fields: z.array(extractedFieldSchema),
  lineItems: z.array(extractedLineItemSchema).optional(),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

export const processingSessionSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  objectPath: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(["uploading", "processing", "completed", "error", "needs_review"]),
  extractedData: extractedDataSchema.optional(),
  ocrText: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date().optional(),
});

export type ProcessingSession = z.infer<typeof processingSessionSchema>;

export const uploadRequestSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  objectPath: z.string().optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const pricingPlan = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  period: z.enum(["free", "monthly", "yearly", "credits"]),
  features: z.array(z.string()),
  filesPerDay: z.number().optional(),
  credits: z.number().optional(),
  highlighted: z.boolean().optional(),
});

export type PricingPlan = z.infer<typeof pricingPlan>;
