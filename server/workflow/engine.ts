import { db } from "../db";
import { workflowInstances, auditLogs, tasks, type WorkflowInstance, type AuditLog, type Task } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { WorkflowDefinition, WorkflowStep } from "./types";
import * as fs from "fs";
import * as path from "path";
import { runSystemAction } from "./actions";
import { notifyTaskAssigned, notifyRequestInfo } from "./notifications";

export class WorkflowEngine {
    private definitions: Map<string, WorkflowDefinition> = new Map();

    constructor() {
        this.loadDefinitions();
    }

    private loadDefinitions() {
        const definitionsDir = path.join(__dirname, "definitions");
        if (!fs.existsSync(definitionsDir)) return;

        const files = fs.readdirSync(definitionsDir);
        for (const file of files) {
            if (file.endsWith(".json")) {
                const content = fs.readFileSync(path.join(definitionsDir, file), "utf-8");
                const def = JSON.parse(content) as WorkflowDefinition;
                this.definitions.set(def.id, def);
            }
        }
    }

    async createInstance(workflowId: string, userId: string, initialData: any = {}) {
        const def = this.definitions.get(workflowId);
        if (!def) throw new Error(`Workflow definition ${workflowId} not found`);

        const [instance] = await db.insert(workflowInstances).values({
            workflowType: workflowId,
            currentStep: def.initialStep,
            status: "active",
            data: initialData,
            userId,
        }).returning();

        await this.logAction(instance.id, userId, "instance_created", null, instance.data);

        // Automatically advance if initial step is system_action
        await this.processStep(instance.id, userId);

        return instance;
    }

    async advanceStep(instanceId: string, userId: string, userAction?: string, actionData: any = {}) {
        const [instance] = await db.select().from(workflowInstances).where(eq(workflowInstances.id, instanceId));
        if (!instance) throw new Error("Instance not found");

        const def = this.definitions.get(instance.workflowType);
        if (!def) throw new Error("Definition not found");

        const currentStep = def.steps[instance.currentStep];
        if (!currentStep) throw new Error("Current step not found in definition");

        let nextStepName: string | undefined;

        if (currentStep.type === "user_action") {
            if (!userAction || !currentStep.actions?.[userAction]) {
                throw new Error(`Invalid action ${userAction} for step ${instance.currentStep}`);
            }
            nextStepName = currentStep.actions[userAction];

            // Mark task as completed if it exists
            await db.update(tasks)
                .set({ status: "completed", updatedAt: sql`NOW()` })
                .where(sql`instance_id = ${instanceId} AND status = 'pending' AND role = ${currentStep.role}`);
        } else if (currentStep.type === "system_action") {
            nextStepName = currentStep.nextStep;
        }

        if (userAction === "request_info") {
            await notifyRequestInfo(instance.userId || "anonymous", instanceId);
        }

        if (!nextStepName) {
            throw new Error(`Could not determine next step for ${instance.currentStep}`);
        }

        const previousState = { step: instance.currentStep, data: instance.data };

        const updatedData = { ...instance.data, ...actionData };
        const nextStepDef = def.steps[nextStepName];

        let status = instance.status;
        if (nextStepDef.type === "terminal") {
            status = (nextStepDef.status as any) || "completed";
        }

        const [updatedInstance] = await db.update(workflowInstances)
            .set({
                currentStep: nextStepName,
                data: updatedData,
                status,
                updatedAt: sql`NOW()`,
            })
            .where(eq(workflowInstances.id, instanceId))
            .returning();

        await this.logAction(instanceId, userId, "step_advance", previousState, { step: nextStepName, data: updatedData });

        // Process the next step (if it's a system action)
        await this.processStep(instanceId, userId);

        return updatedInstance;
    }

    async processStep(instanceId: string, userId: string) {
        const [instance] = await db.select().from(workflowInstances).where(eq(workflowInstances.id, instanceId));
        const def = this.definitions.get(instance.workflowType)!;
        const currentStep = def.steps[instance.currentStep];

        if (currentStep.type === "system_action") {
            // System actions are handled by a separate runner or directly here for simplicity
            // In a real system, this might be a background job
            await this.runSystemAction(instance, currentStep, userId);
        } else if (currentStep.type === "user_action") {
            // Create a task for the role
            await db.insert(tasks).values({
                instanceId: instance.id,
                role: currentStep.role!,
                actionType: "manual_review",
                status: "pending",
                metadata: { step: instance.currentStep },
            });
            await notifyTaskAssigned(currentStep.role!, instance.id);
        }
    }

    private async runSystemAction(instance: WorkflowInstance, step: WorkflowStep, userId: string) {
        await runSystemAction(instance, step, userId);
    }

    private async logAction(instanceId: string, userId: string, action: string, previousState: any, newState: any) {
        await db.insert(auditLogs).values({
            instanceId,
            userId,
            action,
            previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
            newState: newState ? JSON.parse(JSON.stringify(newState)) : null,
            metadata: {},
        });
    }
}

export const workflowEngine = new WorkflowEngine();
