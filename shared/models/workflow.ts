import { pgTable, text, timestamp, integer, jsonb, serial, uuid, boolean, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const workflowStatusEnum = pgEnum("workflow_status", ["active", "completed", "error", "closed_approved", "closed_rejected"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "completed", "cancelled"]);

export const documents = pgTable("documents", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size"),
    objectPath: text("object_path").notNull(),
    storageUrl: text("storage_url"),
    userId: text("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"), // For TTL
});

export const workflowInstances = pgTable("workflow_instances", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workflowType: text("workflow_type").notNull(), // e.g., "invoice_approval"
    currentStep: text("current_step").notNull(),
    status: workflowStatusEnum("status").default("active").notNull(),
    data: jsonb("data").default({}).notNull(), // Shared state/context
    userId: text("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoiceRecords = pgTable("invoice_records", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: uuid("document_id").references(() => documents.id),
    instanceId: uuid("instance_id").references(() => workflowInstances.id).notNull(),
    extractedFields: jsonb("extracted_fields").notNull(),
    lineItems: jsonb("line_items"),
    riskScore: integer("risk_score"),
    flags: jsonb("flags").default([]),
    summaryFinance: text("summary_finance"),
    summaryRequester: text("summary_requester"),
    auditLogId: uuid("audit_log_id"), // Reference to final archive log
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    instanceId: uuid("instance_id").references(() => workflowInstances.id).notNull(),
    role: text("role").notNull(), // e.g., "finance", "requester", "dept_head"
    assignedTo: text("assigned_to"), // userId
    status: taskStatusEnum("status").default("pending").notNull(),
    actionType: text("action_type").notNull(), // e.g., "manual_review", "edit_fields"
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    instanceId: uuid("instance_id").references(() => workflowInstances.id).notNull(),
    userId: text("user_id"), // system or actual user
    action: text("action").notNull(), // e.g., "step_advance", "agent_run", "user_approval"
    previousState: jsonb("previous_state"),
    newState: jsonb("new_state"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod Schemas
export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);

export type Notification = typeof notifications.$inferSelect;
export const insertDocumentSchema = createInsertSchema(documents);
export const selectDocumentSchema = createSelectSchema(documents);

export const insertWorkflowInstanceSchema = createInsertSchema(workflowInstances);
export const selectWorkflowInstanceSchema = createSelectSchema(workflowInstances);

export const insertInvoiceRecordSchema = createInsertSchema(invoiceRecords);
export const selectInvoiceRecordSchema = createSelectSchema(invoiceRecords);

export const insertTaskSchema = createInsertSchema(tasks);
export const selectTaskSchema = createSelectSchema(tasks);

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

// Types
export type Document = typeof documents.$inferSelect;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InvoiceRecord = typeof invoiceRecords.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
