import { z } from "zod";

export const documentSchema = z.object({
    id: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number().optional().nullable(),
    objectPath: z.string(),
    storageUrl: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    createdAt: z.union([z.date(), z.string(), z.number()]),
    expiresAt: z.union([z.date(), z.string(), z.number()]).optional().nullable(),
});

export const workflowInstanceSchema = z.object({
    id: z.string(),
    workflowType: z.string(),
    currentStep: z.string(),
    status: z.enum(["active", "completed", "error", "closed_approved", "closed_rejected"]),
    data: z.any(),
    userId: z.string().optional().nullable(),
    createdAt: z.union([z.date(), z.string(), z.number()]),
    updatedAt: z.union([z.date(), z.string(), z.number()]),
});

export const invoiceRecordSchema = z.object({
    id: z.string(),
    documentId: z.string().optional().nullable(),
    instanceId: z.string(),
    extractedFields: z.any(),
    lineItems: z.any().optional().nullable(),
    riskScore: z.number().optional().nullable(),
    flags: z.array(z.string()).default([]),
    summaryFinance: z.string().optional().nullable(),
    summaryRequester: z.string().optional().nullable(),
    auditLogId: z.string().optional().nullable(),
    createdAt: z.union([z.date(), z.string(), z.number()]),
});

export const taskSchema = z.object({
    id: z.string(),
    instanceId: z.string(),
    role: z.string(),
    assignedTo: z.string().optional().nullable(),
    status: z.enum(["pending", "completed", "cancelled"]),
    actionType: z.string(),
    metadata: z.any(),
    createdAt: z.union([z.date(), z.string(), z.number()]),
    updatedAt: z.union([z.date(), z.string(), z.number()]),
});

export const auditLogSchema = z.object({
    id: z.string(),
    instanceId: z.string(),
    userId: z.string().optional().nullable(),
    action: z.string(),
    previousState: z.any().optional().nullable(),
    newState: z.any().optional().nullable(),
    metadata: z.any(),
    createdAt: z.union([z.date(), z.string(), z.number()]),
});

export const notificationSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    message: z.string(),
    link: z.string().optional().nullable(),
    read: z.boolean().default(false),
    createdAt: z.union([z.date(), z.string(), z.number()]),
});

export type Document = z.infer<typeof documentSchema>;
export type WorkflowInstance = z.infer<typeof workflowInstanceSchema>;
export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>;
export type Task = z.infer<typeof taskSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type Notification = z.infer<typeof notificationSchema>;

export const insertDocumentSchema = documentSchema.omit({ id: true, createdAt: true });
export const selectDocumentSchema = documentSchema;
export const insertWorkflowInstanceSchema = workflowInstanceSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const selectWorkflowInstanceSchema = workflowInstanceSchema;
export const insertInvoiceRecordSchema = invoiceRecordSchema.omit({ id: true, createdAt: true });
export const selectInvoiceRecordSchema = invoiceRecordSchema;
export const insertTaskSchema = taskSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const selectTaskSchema = taskSchema;
export const insertAuditLogSchema = auditLogSchema.omit({ id: true, createdAt: true });
export const selectAuditLogSchema = auditLogSchema;
export const insertNotificationSchema = notificationSchema.omit({ id: true, createdAt: true });
export const selectNotificationSchema = notificationSchema;
