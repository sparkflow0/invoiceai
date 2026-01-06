import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const extractedDataSchema = z.object({
  id: z.string(),
  vendorName: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  totalAmount: z.number(),
  subtotal: z.number().optional(),
  vatAmount: z.number().optional(),
  taxRate: z.number().optional(),
  currency: z.string(),
  vendorAddress: z.string().optional(),
  vendorTaxId: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  paymentTerms: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })).optional(),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

export const processingSessionSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  objectPath: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(["uploading", "processing", "completed", "error"]),
  extractedData: extractedDataSchema.optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date().optional(),
});

export type ProcessingSession = z.infer<typeof processingSessionSchema>;

export const uploadRequestSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
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
