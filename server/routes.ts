import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { uploadRequestSchema, type ExtractedData } from "@shared/schema";
import { randomUUID } from "crypto";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { z } from "zod";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const processRequestSchema = z.object({
  fileDataUrl: z.string().min(1),
});

const aiFieldSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const aiExtractedDataSchema = z
  .object({
    fields: z
      .array(aiFieldSchema)
      .min(1)
      .refine(
        (fields) =>
          fields.some((field) => {
            if (field.value === null || field.value === undefined) return false;
            if (typeof field.value === "string") return field.value.trim().length > 0;
            return true;
          }),
        { message: "No extracted field values found." }
      ),
    lineItems: z
      .array(
        z.record(
          z.union([z.string(), z.number(), z.boolean(), z.null()])
        )
      )
      .optional(),
  })
  .passthrough();

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function getLineItemColumns(lineItems: Array<Record<string, unknown>>): string[] {
  const columns: string[] = [];
  for (const item of lineItems) {
    for (const key of Object.keys(item)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
}

type InvoiceInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "low" | "high" | "auto" }
  | { type: "input_file"; file_data: string; filename?: string };

async function extractDataWithAI(
  fileName: string,
  fileType: string,
  fileDataUrl?: string
): Promise<ExtractedData> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey || apiKey === "_DUMMY_API_KEY_") {
    throw new Error("AI API key is missing.");
  }

  if (!fileDataUrl) {
    throw new Error("No file data provided.");
  }

  try {
    const prompt = `You are a document data extraction system. Extract structured data from the provided invoice, receipt, or statement.

The uploaded file is: "${fileName}" (type: ${fileType})

Return a JSON object with this shape:

{
  "fields": [
    { "label": "Invoice Number", "value": "INV-0001" },
    { "label": "Invoice Date", "value": "2025-01-31" },
    { "label": "Total", "value": 123.45 }
  ],
  "lineItems": [
    { "Description": "Item description", "Quantity": 2, "Unit Price": 10.5, "Total": 21.0 }
  ]
}

Use labels as they appear in the document. Use numbers for numeric values and ISO dates where possible.
Only include fields you can read. If you cannot read any fields, return {"fields": []}.
Return ONLY valid JSON, no explanation.`;

    const parsedDataUrl = parseDataUrl(fileDataUrl);
    if (!parsedDataUrl) {
      throw new Error("Invalid file data.");
    }

    const resolvedType = fileType || parsedDataUrl.mime;
    const inputContent: InvoiceInputContent[] = [
      { type: "input_text", text: prompt },
    ];

    if (resolvedType === "application/pdf") {
      inputContent.push({
        type: "input_file",
        file_data: parsedDataUrl.base64,
        filename: fileName || "invoice.pdf",
      });
    } else if (resolvedType.startsWith("image/")) {
      inputContent.push({
        type: "input_image",
        image_url: fileDataUrl,
        detail: "high",
      });
    } else {
      throw new Error(`Unsupported file type: ${resolvedType}`);
    }

    const response = await getOpenAIClient(apiKey).responses.create({
      model: process.env.OPENAI_INVOICE_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: inputContent,
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 2048,
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = aiExtractedDataSchema.parse(JSON.parse(content));
    const fields = parsed.fields.map((field) => ({
      label: field.label,
      value: field.value === undefined ? null : field.value,
    }));
    return {
      id: randomUUID(),
      fields,
      lineItems: parsed.lineItems,
    };
  } catch (error) {
    console.error("AI extraction failed:", error);
    throw error;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const authEnabled = Boolean(
    process.env.REPL_ID && process.env.SESSION_SECRET && process.env.DATABASE_URL,
  );

  if (authEnabled) {
    // Lazy-load auth to avoid requiring DB config when auth is disabled.
    const { setupAuth } = await import("./replit_integrations/auth/replitAuth");
    const { registerAuthRoutes } = await import(
      "./replit_integrations/auth/routes"
    );
    await setupAuth(app);
    registerAuthRoutes(app);
  } else {
    app.get("/api/auth/user", (_req, res) => {
      res.status(200).json(null);
    });
    app.get("/api/login", (_req, res) => {
      res.redirect("/login");
    });
    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });
  }

  registerObjectStorageRoutes(app);
  
  app.post("/api/sessions", async (req, res) => {
    try {
      const parsed = uploadRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      }
      
      const { fileName, fileType } = parsed.data;
      const session = await storage.createSession(fileName, fileType);
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error getting session:", error);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.post("/api/sessions/:id/process", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const parsedProcess = processRequestSchema.safeParse(req.body ?? {});
      if (!parsedProcess.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsedProcess.error.issues });
      }
      
      await storage.updateSession(req.params.id, { status: "processing" });
      
      const extractedData = await extractDataWithAI(
        session.fileName,
        session.fileType,
        parsedProcess.data.fileDataUrl
      );
      
      const updatedSession = await storage.updateSession(req.params.id, {
        status: "completed",
        extractedData,
      });
      
      res.json(updatedSession);
    } catch (error) {
      console.error("Error processing session:", error);
      
      await storage.updateSession(req.params.id, {
        status: "error",
        errorMessage: "AI could not read this document. Please review the original and try again.",
      });
      
      res.status(500).json({ error: "AI extraction failed" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

    app.post("/api/export/csv", async (req, res) => {
      try {
        const { data } = req.body;
        if (!data) {
          return res.status(400).json({ error: "No data provided" });
        }
        
        const headers = ["Field", "Value"];
        const fields = Array.isArray(data.fields) ? data.fields : [];
        const rows = fields.map((field: any) => [
          formatCellValue(field?.label),
          formatCellValue(field?.value),
        ]);

        if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
          const columns = getLineItemColumns(data.lineItems);
          rows.push(["", ""]);
          rows.push(["Line Items", ""]);
          rows.push(columns);
          for (const item of data.lineItems) {
            rows.push(columns.map((column) => formatCellValue(item?.[column])));
          }
        }
        
        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="extracted-data.csv"`);
        res.send(csvContent);
      } catch (error) {
        console.error("Error exporting CSV:", error);
        res.status(500).json({ error: "Failed to export CSV" });
    }
  });

    app.post("/api/export/excel", async (req, res) => {
      try {
        const { data } = req.body;
        if (!data) {
          return res.status(400).json({ error: "No data provided" });
        }
        
        const fields = Array.isArray(data.fields) ? data.fields : [];
        const rows = [
          ["Field", "Value"],
          ...fields.map((field: any) => [
            formatCellValue(field?.label),
            formatCellValue(field?.value),
          ]),
        ];

        if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
          const columns = getLineItemColumns(data.lineItems);
          rows.push(["", ""]);
          rows.push(["Line Items", ""]);
          rows.push(columns);
          for (const item of data.lineItems) {
            rows.push(columns.map((column) => formatCellValue(item?.[column])));
          }
        }
        
        const tsvContent = rows.map(row => row.join("\t")).join("\n");
        
        res.setHeader("Content-Type", "application/vnd.ms-excel");
        res.setHeader("Content-Disposition", `attachment; filename="extracted-data.xls"`);
        res.send(tsvContent);
      } catch (error) {
        console.error("Error exporting Excel:", error);
        res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  return httpServer;
}
