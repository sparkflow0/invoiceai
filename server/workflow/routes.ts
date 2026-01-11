import { Express } from "express";
import { workflowEngine } from "./engine";
import { firestoreGet, firestoreQuery } from "../firebase-db";

export function registerWorkflowRoutes(app: Express) {
    app.get("/api/workflows/:id", async (req, res) => {
        try {
            const instance = await firestoreGet("workflow_instances", req.params.id);
            if (!instance) {
                return res.status(404).json({ error: "Workflow instance not found" });
            }
            res.json(instance);
        } catch (error) {
            console.error("Error fetching workflow:", error);
            res.status(500).json({ error: "Failed to fetch workflow" });
        }
    });

    app.get("/api/workflows/:id/timeline", async (req, res) => {
        try {
            const auditLogs = await firestoreQuery("audit_logs", [
                { field: "instanceId", operator: "==", value: req.params.id }
            ], { field: "createdAt", direction: "asc" }); // Assuming createdAt exists and we want chronological order
            // If createdAt isn't on the root, we might need to adjust or rely on default insertion order if that's safe (it's often not in Firestore)
            // For now, let's assume simple query works.
            res.json(auditLogs);
        } catch (error) {
            console.error("Error fetching timeline:", error);
            res.status(500).json({ error: "Failed to fetch timeline" });
        }
    });

    app.post("/api/workflows/:id/action", async (req, res) => {
        try {
            const { action, data } = req.body;
            const userId = (req as any).firebaseUser?.uid || "anonymous";

            // Re-fetch instance to ensure latest state
            const result = await workflowEngine.advanceStep(req.params.id, userId, action, data);
            res.json(result);
        } catch (error: any) {
            console.error("Error performing workflow action:", error);
            res.status(400).json({ error: error.message });
        }
    });

    // Optional: Create new workflow instance (for testing/dev)
    app.post("/api/workflows", async (req, res) => {
        try {
            const { type, initialData } = req.body;
            const userId = (req as any).firebaseUser?.uid || "anonymous";

            const instance = await workflowEngine.createInstance(type, userId, initialData);
            res.json(instance);
        } catch (error: any) {
            console.error("Error creating workflow:", error);
            res.status(500).json({ error: error.message });
        }
    });
}
