import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  profileImageUrl: z.string().optional().nullable(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
  plan: z.string().optional(),
  status: z.string().optional().nullable(),
  stripeCustomerId: z.string().optional().nullable(),
  stripeSubscriptionId: z.string().optional().nullable(),
  currentPeriodEnd: z.number().optional().nullable(),
  cancelAtPeriodEnd: z.boolean().optional().nullable(),
});

export type User = z.infer<typeof userSchema>;
export type UpsertUser = Partial<User>;
