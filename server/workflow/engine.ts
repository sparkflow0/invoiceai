import { firestoreAdd, firestoreUpdate, firestoreGet, firestoreQuery } from "../firebase-db";
import { type WorkflowInstance, type AuditLog, type Task } from "@shared/schema";
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

        const instance = await firestoreAdd("workflow_instances", {
            workflowType: workflowId,
            currentStep: def.initialStep,
            status: "active",
            data: initialData,
            userId,
        });

        await this.logAction(instance.id, userId, "instance_created", null, instance.data);

        // Automatically advance if initial step is system_action
        await this.processStep(instance.id, userId);

        return instance;
    }

    async advanceStep(instanceId: string, userId: string, userAction?: string, actionData: any = {}) {
        const instance = await firestoreGet("workflow_instances", instanceId) as any;
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
            const pendingTasks = await firestoreQuery("tasks", [
                { field: "instanceId", operator: "==", value: instanceId },
                { field: "status", operator: "==", value: "pending" },
                { field: "role", operator: "==", value: currentStep.role }
            ]);

            for (const task of pendingTasks) {
                await firestoreUpdate("tasks", task.id, { status: "completed" });
            }
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

        const updatedInstance = await firestoreUpdate("workflow_instances", instanceId, {
            currentStep: nextStepName,
            data: updatedData,
            status,
        });

        await this.logAction(instanceId, userId, "step_advance", previousState, { step: nextStepName, data: updatedData });

        // Process the next step (if it's a system action)
        await this.processStep(instanceId, userId);

        return { ...instance, ...updatedInstance };
    }

    async processStep(instanceId: string, userId: string) {
        const instance = await firestoreGet("workflow_instances", instanceId) as any;
        const def = this.definitions.get(instance.workflowType)!;
        const currentStep = def.steps[instance.currentStep];

        if (currentStep.type === "system_action") {
            await this.runSystemAction(instance, currentStep, userId);
        } else if (currentStep.type === "user_action") {
            // Create a task for the role
            const task = await firestoreAdd("tasks", {
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
        await firestoreAdd("audit_logs", {
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
