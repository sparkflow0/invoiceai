import { db } from "../db";
import { documents } from "@shared/schema";
import { lt, sql, eq } from "drizzle-orm";
import { deleteUploadObject } from "../uploads";

export async function cleanupExpiredDocuments() {
    console.log("Running TTL cleanup job...");
    try {
        const expired = await db.select().from(documents).where(lt(documents.expiresAt, sql`NOW()`));

        for (const doc of expired) {
            console.log(`Deleting expired document: ${doc.id} (${doc.objectPath})`);
            try {
                await deleteUploadObject(doc.objectPath);
                await db.delete(documents).where(eq(documents.id, doc.id));
            } catch (err) {
                console.error(`Failed to delete document ${doc.id}:`, err);
            }
        }
    } catch (err) {
        console.error("TTL job failed:", err);
    }
}

// In a real app, this would be scheduled via cron or a job runner
// For now, we'll just export it and it could be called from index.ts or a separate process
