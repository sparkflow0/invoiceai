import { firestoreQuery, firestoreDelete } from "../firebase-db";
import { deleteUploadObject } from "../uploads";

export async function cleanupExpiredDocuments() {
    console.log("Running TTL cleanup job...");
    try {
        const expired = await firestoreQuery("documents", [
            { field: "expiresAt", operator: "<", value: new Date() }
        ]);

        for (const doc of expired) {
            console.log(`Deleting expired document: ${doc.id} (${doc.objectPath})`);
            try {
                await deleteUploadObject(doc.objectPath);
                await firestoreDelete("documents", doc.id);
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
