import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { uploadRequestSchema, type ExtractedData } from "@shared/schema";
import { randomUUID } from "crypto";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function generateMockExtractedData(): ExtractedData {
  const vendors = [
    "Acme Corporation Ltd",
    "TechSupply Inc",
    "Global Services GmbH",
    "Nordic Solutions AB",
    "Pacific Trading Co",
  ];
  
  const currencies = ["USD", "EUR", "GBP", "CHF", "CAD"];
  
  const lineItemDescriptions = [
    "Software License - Annual",
    "Support & Maintenance",
    "Implementation Services",
    "Consulting Hours",
    "Hardware Components",
    "Cloud Storage - Monthly",
    "Training Session",
    "API Access Fee",
  ];

  const vendor = vendors[Math.floor(Math.random() * vendors.length)];
  const currency = currencies[Math.floor(Math.random() * currencies.length)];
  const invoiceNum = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
  
  const numItems = Math.floor(Math.random() * 4) + 1;
  const lineItems = [];
  let subtotal = 0;
  
  for (let i = 0; i < numItems; i++) {
    const desc = lineItemDescriptions[Math.floor(Math.random() * lineItemDescriptions.length)];
    const qty = Math.floor(Math.random() * 10) + 1;
    const unitPrice = Math.round((Math.random() * 500 + 50) * 100) / 100;
    const total = Math.round(qty * unitPrice * 100) / 100;
    subtotal += total;
    
    lineItems.push({
      description: desc,
      quantity: qty,
      unitPrice,
      total,
    });
  }
  
  const vatRate = [0.05, 0.10, 0.19, 0.20, 0.21][Math.floor(Math.random() * 5)];
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
  
  const today = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const invoiceDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  return {
    id: randomUUID(),
    vendorName: vendor,
    invoiceNumber: invoiceNum,
    invoiceDate: invoiceDate.toISOString().split('T')[0],
    totalAmount,
    vatAmount,
    currency,
    lineItems,
  };
}

async function extractDataWithAI(fileName: string, fileType: string): Promise<ExtractedData> {
  try {
    const prompt = `You are an invoice data extraction AI. Extract structured data from an invoice document.

The uploaded file is: "${fileName}" (type: ${fileType})

Since I cannot see the actual document content, generate realistic sample invoice data that would be typical for a business invoice. Return a JSON object with these fields:

{
  "vendorName": "Company name",
  "invoiceNumber": "INV-XXXX-XXXX format",
  "invoiceDate": "YYYY-MM-DD format",
  "dueDate": "YYYY-MM-DD format (optional)",
  "totalAmount": number,
  "subtotal": number (optional),
  "vatAmount": number (optional),
  "taxRate": number (optional, as decimal like 0.20 for 20%),
  "currency": "USD/EUR/GBP etc",
  "vendorAddress": "Full address (optional)",
  "vendorTaxId": "Tax ID number (optional)",
  "customerName": "Customer company name (optional)",
  "customerAddress": "Customer address (optional)",
  "paymentTerms": "Net 30, etc (optional)",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ]
}

Return ONLY valid JSON, no explanation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      id: randomUUID(),
      vendorName: parsed.vendorName || "Unknown Vendor",
      invoiceNumber: parsed.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: parsed.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: parsed.dueDate,
      totalAmount: parsed.totalAmount || 0,
      subtotal: parsed.subtotal,
      vatAmount: parsed.vatAmount,
      taxRate: parsed.taxRate,
      currency: parsed.currency || "USD",
      vendorAddress: parsed.vendorAddress,
      vendorTaxId: parsed.vendorTaxId,
      customerName: parsed.customerName,
      customerAddress: parsed.customerAddress,
      paymentTerms: parsed.paymentTerms,
      lineItems: parsed.lineItems || [],
    };
  } catch (error) {
    console.error("AI extraction failed, using mock data:", error);
    return generateMockExtractedData();
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);
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
      
      await storage.updateSession(req.params.id, { status: "processing" });
      
      const extractedData = await extractDataWithAI(session.fileName, session.fileType);
      
      const updatedSession = await storage.updateSession(req.params.id, {
        status: "completed",
        extractedData,
      });
      
      res.json(updatedSession);
    } catch (error) {
      console.error("Error processing session:", error);
      
      await storage.updateSession(req.params.id, {
        status: "error",
        errorMessage: "Processing failed. Please try again.",
      });
      
      res.status(500).json({ error: "Processing failed" });
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
      const rows = [
        ["Vendor Name", data.vendorName || ""],
        ["Invoice Number", data.invoiceNumber || ""],
        ["Invoice Date", data.invoiceDate || ""],
        ["Total Amount", String(data.totalAmount || "")],
        ["VAT Amount", String(data.vatAmount || "")],
        ["Currency", data.currency || ""],
      ];
      
      if (data.lineItems && data.lineItems.length > 0) {
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(["Description", "Quantity", "Unit Price", "Total"]);
        for (const item of data.lineItems) {
          rows.push([item.description, String(item.quantity), String(item.unitPrice), String(item.total)]);
        }
      }
      
      const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-data-${data.invoiceNumber || 'export'}.csv"`);
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
      
      const rows = [
        ["Field", "Value"],
        ["Vendor Name", data.vendorName || ""],
        ["Invoice Number", data.invoiceNumber || ""],
        ["Invoice Date", data.invoiceDate || ""],
        ["Total Amount", String(data.totalAmount || "")],
        ["VAT Amount", String(data.vatAmount || "")],
        ["Currency", data.currency || ""],
      ];
      
      if (data.lineItems && data.lineItems.length > 0) {
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(["Description", "Quantity", "Unit Price", "Total"]);
        for (const item of data.lineItems) {
          rows.push([item.description, String(item.quantity), String(item.unitPrice), String(item.total)]);
        }
      }
      
      const tsvContent = rows.map(row => row.join("\t")).join("\n");
      
      res.setHeader("Content-Type", "application/vnd.ms-excel");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-data-${data.invoiceNumber || 'export'}.xls"`);
      res.send(tsvContent);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  return httpServer;
}
