import OpenAI, { toFile } from "openai";
import { z, ZodError } from "zod";
import { randomUUID } from "crypto";
import {
    DEFAULT_CONFIDENCE,
    LOW_CONFIDENCE_THRESHOLD,
    getOpenAIClient,
    withRetry,
    withTimeout,
    AI_TIMEOUT_MS,
    toAppError,
    clampConfidence,
    AppError
} from "./agent-utils"; // I'll create this to share common utils from routes.ts

const aiFieldSchema = z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    confidence: z.number().min(0).max(1).optional(),
});

const aiExtractedDataSchema = z.object({
    fields: z.array(aiFieldSchema),
    lineItems: z.array(z.record(z.any())).optional(),
});

export async function extractorAgent(fileName: string, mimeType: string, buffer: Buffer) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey || apiKey === "_DUMMY_API_KEY_") {
        throw new Error("AI API key is missing.");
    }

    const prompt = `You are a document data extraction system. Extract structured data from the provided invoice, receipt, or statement.
The uploaded file is: "${fileName}" (type: ${mimeType})
Return a JSON object with this shape:
{
  "fields": [
    { "label": "Invoice Number", "value": "INV-0001", "confidence": 0.86 },
    { "label": "Invoice Date", "value": "2025-01-31", "confidence": 0.74 },
    { "label": "Total", "value": 123.45, "confidence": 0.91 }
  ],
  "lineItems": [
    { "Description": "Item description", "Quantity": 2, "Unit Price": 10.5, "Total": 21.0 }
  ]
}
Include a confidence score for each field between 0 and 1. Return ONLY valid JSON.`;

    const inputContent: any[] = [{ type: "text", text: prompt }];

    if (mimeType === "application/pdf") {
        const file = await toFile(buffer, fileName || "document.pdf", { type: mimeType });
        const uploadResponse = await getOpenAIClient(apiKey).files.create({ file, purpose: "assistants" });
        inputContent.push({ type: "input_file", file_id: uploadResponse.id });
    } else {
        const base64 = buffer.toString("base64");
        inputContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
    }

    const response = await getOpenAIClient(apiKey).chat.completions.create({
        model: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4o",
        messages: [{ role: "user", content: inputContent }],
        response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("AI returned an empty response.");

    const parsed = aiExtractedDataSchema.parse(JSON.parse(content));

    // Calculate confidence map
    const confidenceMap: Record<string, number> = {};
    parsed.fields.forEach(f => {
        confidenceMap[f.label] = f.confidence ?? 0.5;
    });

    return {
        fields: parsed.fields,
        lineItems: parsed.lineItems,
        confidenceMap,
    };
}

export async function complianceAgent(fields: any[], lineItems: any[]) {
    // input: extracted_fields + line_items
    // output: validation_results + risk_score + flags

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY!;
    const prompt = `Perform a compliance and risk assessment on these invoice fields and line items.
Fields: ${JSON.stringify(fields)}
Line Items: ${JSON.stringify(lineItems)}

Rules:
1. Check for duplicates (simulated, if we had history).
2. Check if Total matches sum of Line Items.
3. Check for suspicious vendors or keywords (refurbished, personal, gift).
4. Assign a risk score 0-100.
5. Provide a list of flags.

Return JSON:
{
  "risk_score": 0-100,
  "flags": ["string"],
  "validation_results": { "total_match": boolean, "valid_date": boolean, "suspicious_vendor": boolean }
}`;

    const response = await getOpenAIClient(apiKey).chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content!);
}

export async function routerAgent(risk_score: number, flags: string[], fields: any[], validation_results: any) {
    // input: risk_score + flags + extracted_fields + validation_results
    // output: recommended_next_role + summary_for_finance + summary_for_requester

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY!;
    const prompt = `Based on the invoice analysis, recommend the next role for approval and provide summaries.
Risk Score: ${risk_score}
Flags: ${JSON.stringify(flags)}
Fields: ${JSON.stringify(fields)}
Validation: ${JSON.stringify(validation_results)}

Rules:
- risk <= 20 -> finance_approval
- 21-60 -> dept_review
- > 60 -> senior_approval

Return JSON:
{
  "recommended_next_role": "string",
  "summary_for_finance": "string",
  "summary_for_requester": "string"
}`;

    const response = await getOpenAIClient(apiKey).chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content!);
}
