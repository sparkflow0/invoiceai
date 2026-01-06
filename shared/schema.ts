import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const extractedDataSchema = z.object({
  id: z.string(),
  vendorName: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  totalAmount: z.number(),
  vatAmount: z.number().optional(),
  currency: z.string(),
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
  status: z.enum(["uploading", "processing", "completed", "error"]),
  extractedData: extractedDataSchema.optional(),
  errorMessage: z.string().optional(),
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
