import { z } from "zod";

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.union([z.date(), z.string(), z.number()]),
});

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.string(),
  content: z.string(),
  createdAt: z.union([z.date(), z.string(), z.number()]),
});

export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type InsertConversation = Omit<Conversation, "id" | "createdAt">;
export type InsertMessage = Omit<Message, "id" | "createdAt">;
