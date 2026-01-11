import { db } from "../db";
import { workflowInstances, invoiceRecords, documents, auditLogs, tasks } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { extractorAgent, complianceAgent, routerAgent } from "./agents";
import { workflowEngine } from "./engine";
import { fetchUploadBuffer } from "../uploads";
import { calculateRiskScore } from "./risk-score.test";

export async function runSystemAction(instance: any, step: any, userId: string) {
    const { action } = step;
    console.log(`Executing system action: ${action} for instance ${instance.id}`);

    try {
        switch (action) {
            case "run_extractor":
                await handleExtractor(instance, userId);
                break;
            case "run_compliance":
                await handleCompliance(instance, userId);
                break;
            case "run_router":
                await handleRouter(instance, userId);
                break;
            case "route_dispatch":
                await handleDispatch(instance, userId);
                break;
            case "archive":
                await handleArchive(instance, userId);
                break;
            default:
                console.error(`Unknown system action: ${action}`);
        }
    } catch (error) {
        console.error(`Error in system action ${action}:`, error);
        // Move to error state or retry? For now, just mark as error
        await db.update(workflowInstances)
            .set({ status: "error", updatedAt: sql`NOW()` })
            .where(eq(workflowInstances.id, instance.id));
    }
}

async function handleExtractor(instance: any, userId: string) {
    const documentId = instance.data.documentId;
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!doc) throw new Error("Document not found");

    const { buffer } = await fetchUploadBuffer(doc.objectPath);

    const extracted = await extractorAgent(doc.fileName, doc.fileType, buffer);

    // Save to instance data
    const updatedData = {
        ...instance.data,
        extractedFields: extracted.fields,
        lineItems: extracted.lineItems,
        confidenceMap: extracted.confidenceMap,
    };

    await workflowEngine.advanceStep(instance.id, "system", undefined, updatedData);
}

async function handleCompliance(instance: any, userId: string) {
    const { extractedFields, lineItems } = instance.data;

    // Deterministic risk scoring
    const { riskScore: deterministicRisk, flags } = calculateRiskScore(extractedFields, lineItems);

    // AI-based compliance check
    const aiCompliance = await complianceAgent(extractedFields, lineItems);

    const finalRiskScore = Math.min(100, deterministicRisk + (aiCompliance.risk_score || 0) / 2);
    const finalFlags = Array.from(new Set([...flags, ...(aiCompliance.flags || [])]));

    const updatedData = {
        ...instance.data,
        riskScore: finalRiskScore,
        flags: finalFlags,
        validationResults: aiCompliance.validation_results,
    };

    await workflowEngine.advanceStep(instance.id, "system", undefined, updatedData);
}

async function handleRouter(instance: any, userId: string) {
    const { riskScore, flags, extractedFields, validationResults } = instance.data;

    const recommendations = await routerAgent(riskScore, flags, extractedFields, validationResults);

    const updatedData = {
        ...instance.data,
        recommendedRole: recommendations.recommended_next_role,
        summaryFinance: recommendations.summary_for_finance,
        summaryRequester: recommendations.summary_for_requester,
    };

    await workflowEngine.advanceStep(instance.id, "system", undefined, updatedData);
}

async function handleDispatch(instance: any, userId: string) {
    const { riskScore } = instance.data;

    let nextStep = "finance_approval";
    if (riskScore > 60) {
        nextStep = "senior_approval";
    } else if (riskScore > 20) {
        nextStep = "dept_review";
    }

    // We need to manually set the next step here because route_dispatch is a branching point
    const previousState = { step: instance.currentStep, data: instance.data };

    await db.update(workflowInstances)
        .set({
            currentStep: nextStep,
            updatedAt: sql`NOW()`,
        })
        .where(eq(workflowInstances.id, instance.id));

    await db.insert(auditLogs).values({
        instanceId: instance.id,
        userId: "system",
        action: "route_dispatch",
        previousState,
        newState: { step: nextStep, data: instance.data },
        metadata: { riskScore },
    });

    // Since it's now a user_action step, processStep will create a task
    await workflowEngine.processStep(instance.id, "system");
}

async function handleArchive(instance: any, userId: string) {
    const { extractedFields, lineItems, riskScore, flags, summaryFinance, summaryRequester, documentId } = instance.data;

    // Create final invoice record
    const [record] = await db.insert(invoiceRecords).values({
        instanceId: instance.id,
        documentId,
        extractedFields,
        lineItems,
        riskScore,
        flags,
        summaryFinance,
        summaryRequester,
    }).returning();

    // Audit log entry for archive
    const [log] = await db.insert(auditLogs).values({
        instanceId: instance.id,
        userId: "system",
        action: "archived",
        previousState: instance.data,
        newState: { status: "closed_approved" },
        metadata: { recordId: record.id },
    }).returning();

    // Update record with log association
    await db.update(invoiceRecords).set({ auditLogId: log.id }).where(eq(invoiceRecords.id, record.id));

    // Mark workflow as closed_approved
    await db.update(workflowInstances)
        .set({ status: "closed_approved", currentStep: "closed_approved", updatedAt: sql`NOW()` })
        .where(eq(workflowInstances.id, instance.id));

    // Files are marked for TTL in the documents table, a separate job handles deletion
}
