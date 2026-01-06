import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  Copy, 
  Trash2, 
  Shield,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  X,
  AlertCircle
} from "lucide-react";
import type { ExtractedData, ProcessingSession } from "@shared/schema";

type ProcessingStatus = "idle" | "uploading" | "processing" | "completed" | "error";

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const errorFormFields = [
  "Vendor Name",
  "Invoice Number",
  "Invoice Date",
  "Total Amount",
  "VAT Amount",
  "Currency",
];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatFieldValue = (
  value: ExtractedData["fields"][number]["value"] | undefined
) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const getLineItemColumns = (
  lineItems: NonNullable<ExtractedData["lineItems"]>
) => {
  const columns: string[] = [];
  for (const item of lineItems) {
    for (const key of Object.keys(item)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
};

export default function UploadApp() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editableData, setEditableData] = useState<ExtractedData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const createSessionMutation = useMutation({
    mutationFn: async (file: FileInfo) => {
      const response = await apiRequest("POST", "/api/sessions", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      return response.json() as Promise<ProcessingSession>;
    },
  });

  const processSessionMutation = useMutation({
    mutationFn: async ({ id, fileDataUrl }: { id: string; fileDataUrl: string }) => {
      const response = await apiRequest("POST", `/api/sessions/${id}/process`, {
        fileDataUrl,
      });
      return response.json() as Promise<ProcessingSession>;
    },
  });

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    const info = { name: file.name, size: file.size, type: file.type };
    setFileInfo(info);
    setStatus("uploading");
    setProgress(0);
    setErrorMessage(null);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 30));
    }, 100);

    try {
      const fileDataUrl = await readFileAsDataUrl(file);
      setFilePreviewUrl(fileDataUrl);

      const session = await createSessionMutation.mutateAsync(info);
      setSessionId(session.id);
      clearInterval(progressInterval);
      setProgress(40);
      setStatus("processing");

      const processingInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 150);

      const result = await processSessionMutation.mutateAsync({
        id: session.id,
        fileDataUrl,
      });
      clearInterval(processingInterval);
      setProgress(100);

      if (result.status === "completed" && result.extractedData) {
        setExtractedData(result.extractedData);
        setEditableData(result.extractedData);
        setStatus("completed");
      } else if (result.status === "error") {
        setStatus("error");
        setErrorMessage(result.errorMessage || "Processing failed. Please try again.");
      }
    } catch (error) {
      clearInterval(progressInterval);
      setStatus("error");
      const aiFailureMessage =
        "AI could not read this document. Review the original below and try again.";
      const fallbackMessage = "There was an error processing your file. Please try again.";
      const message =
        error instanceof Error && error.message.includes("AI extraction failed")
          ? aiFailureMessage
          : fallbackMessage;
      setErrorMessage(message);
      toast({
        title: "Processing Failed",
        description: message,
        variant: "destructive",
      });
    }
  }, [createSessionMutation, processSessionMutation, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFileType(file)) {
        processFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, JPG, or PNG file.",
          variant: "destructive",
        });
      }
    }
  }, [processFile, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isValidFileType(file)) {
        processFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, JPG, or PNG file.",
          variant: "destructive",
        });
      }
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    return validTypes.includes(file.type);
  };

  const handleFieldChange = (index: number, value: string) => {
    if (!editableData) return;
    const nextFields = editableData.fields.map((field, fieldIndex) =>
      fieldIndex === index ? { ...field, value } : field
    );
    setEditableData({ ...editableData, fields: nextFields });
  };

  const handleExportExcel = () => {
    if (editableData) {
      const headers = ["Field", "Value"];
      const rows = editableData.fields.map((field) => [
        field.label,
        formatFieldValue(field.value),
      ]);

      if (editableData.lineItems && editableData.lineItems.length > 0) {
        const lineItemColumns = getLineItemColumns(editableData.lineItems);
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(lineItemColumns);
        for (const item of editableData.lineItems) {
          rows.push(
            lineItemColumns.map((column) =>
              formatFieldValue(item[column] ?? null)
            )
          );
        }
      }
      
      const csvContent = [headers, ...rows].map(row => 
        Array.isArray(row) ? row.join("\t") : row
      ).join("\n");
      
      const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = fileInfo?.name?.replace(/\.[^/.]+$/, "") || "extracted-data";
      a.download = `${baseName}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Excel Exported",
        description: "Your file has been downloaded.",
      });
    }
  };

  const handleExportCSV = () => {
    if (editableData) {
      const headers = ["Field", "Value"];
      const rows = editableData.fields.map((field) => [
        field.label,
        formatFieldValue(field.value),
      ]);

      if (editableData.lineItems && editableData.lineItems.length > 0) {
        const lineItemColumns = getLineItemColumns(editableData.lineItems);
        rows.push(["", ""]);
        rows.push(["Line Items", ""]);
        rows.push(lineItemColumns);
        for (const item of editableData.lineItems) {
          rows.push(
            lineItemColumns.map((column) =>
              formatFieldValue(item[column] ?? null)
            )
          );
        }
      }
      
      const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = fileInfo?.name?.replace(/\.[^/.]+$/, "") || "extracted-data";
      a.download = `${baseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "CSV Exported",
        description: "Your file has been downloaded.",
      });
    }
  };

  const handleCopyToClipboard = () => {
    if (editableData) {
      const fieldLines = editableData.fields.map(
        (field) => `${field.label}: ${formatFieldValue(field.value)}`
      );
      let text = fieldLines.join("\n");

      if (editableData.lineItems && editableData.lineItems.length > 0) {
        const lineItemColumns = getLineItemColumns(editableData.lineItems);
        text += "\n\nLine Items:\n";
        text += lineItemColumns.join(" | ");
        for (const item of editableData.lineItems) {
          const row = lineItemColumns.map((column) =>
            formatFieldValue(item[column] ?? null)
          );
          text += `\n${row.join(" | ")}`;
        }
      }
      
      navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard",
        description: "Invoice data has been copied.",
      });
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress(0);
    setFileInfo(null);
    setFilePreviewUrl(null);
    setSessionId(null);
    setExtractedData(null);
    setEditableData(null);
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const lineItemColumns = editableData?.lineItems
    ? getLineItemColumns(editableData.lineItems)
    : [];

  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold md:text-4xl" data-testid="text-upload-title">
            Extract Invoice Data
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Upload your invoice or receipt to extract structured data
          </p>
        </div>

        {status === "idle" && (
          <Card className="mt-12">
            <CardContent className="p-8">
              <div
                className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                data-testid="dropzone-upload"
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileInput}
                  className="hidden"
                  data-testid="input-file"
                />
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <p className="mt-6 text-lg font-medium">
                  Drag and drop your file here
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  or <span className="text-primary font-medium">browse</span> to choose a file
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Supports PDF, JPG, PNG (max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {(status === "uploading" || status === "processing") && (
          <Card className="mt-12">
            <CardContent className="p-8">
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="mt-6 text-lg font-medium">
                  {status === "uploading" ? "Uploading..." : "Processing with AI..."}
                </p>
                {fileInfo && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {fileInfo.name} ({formatFileSize(fileInfo.size)})
                  </p>
                )}
                <div className="mt-6 w-full max-w-md">
                  <Progress value={progress} className="h-2" data-testid="progress-upload" />
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {progress}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "error" && (
          <Card className="mt-12">
            <CardContent className="p-8">
              {filePreviewUrl ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Extraction Incomplete</p>
                      <p className="mt-1 text-sm text-muted-foreground max-w-md">
                        {errorMessage || "AI could not read this document. Review the original below and try again."}
                      </p>
                    </div>
                  </div>

                  <div className="relative min-h-[360px] overflow-hidden rounded-xl border bg-background">
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/40">
                      {fileInfo?.type === "application/pdf" ? (
                        <object
                          data={filePreviewUrl}
                          type="application/pdf"
                          className="h-full w-full"
                          aria-label="Uploaded document"
                        />
                      ) : (
                        <img
                          src={filePreviewUrl}
                          alt={fileInfo?.name ? `Uploaded ${fileInfo.name}` : "Uploaded document"}
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="relative p-6 opacity-30">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Field</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errorFormFields.map((label) => (
                            <TableRow key={label}>
                              <TableCell className="font-medium">{label}</TableCell>
                              <TableCell>
                                <div className="h-9 w-full rounded-md border bg-muted/30" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleReset} data-testid="button-try-again">
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <p className="mt-6 text-lg font-medium">
                    Processing Failed
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    {errorMessage || "There was an error processing your file. Please try again."}
                  </p>
                  <Button onClick={handleReset} className="mt-6" data-testid="button-try-again">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {status === "completed" && editableData && (
          <>
            <Card className="mt-12">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Extraction Complete</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {fileInfo?.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  data-testid="button-clear"
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Field</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableData.fields.map((field, index) => (
                      <TableRow key={`${field.label}-${index}`}>
                        <TableCell className="font-medium">{field.label}</TableCell>
                        <TableCell>
                          <Input
                            value={formatFieldValue(field.value)}
                            onChange={(e) => handleFieldChange(index, e.target.value)}
                            className="max-w-sm"
                            data-testid={`input-field-${index}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {editableData.lineItems && editableData.lineItems.length > 0 && (
                  <div className="mt-8">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Line Items
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {lineItemColumns.map((column) => (
                            <TableHead key={column} className="text-left">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableData.lineItems.map((item, index) => (
                          <TableRow key={index}>
                            {lineItemColumns.map((column) => (
                              <TableCell key={`${index}-${column}`}>
                                {formatFieldValue(item[column] ?? null)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={handleExportExcel} className="gap-2" data-testid="button-export-excel">
                <FileSpreadsheet className="h-4 w-4" />
                Export to Excel
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="button-export-csv">
                <Download className="h-4 w-4" />
                Export to CSV
              </Button>
              <Button variant="outline" onClick={handleCopyToClipboard} className="gap-2" data-testid="button-copy">
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </Button>
              <Button variant="ghost" onClick={handleReset} className="gap-2" data-testid="button-new-upload">
                <Trash2 className="h-4 w-4" />
                New Upload
              </Button>
            </div>
          </>
        )}

        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span data-testid="text-security-notice">Files are encrypted and auto-deleted after processing</span>
        </div>
      </div>
    </div>
  );
}
