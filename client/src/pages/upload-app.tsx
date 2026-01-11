import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import {
  buildDelimitedContent,
  buildRowsFromExtractedData,
  formatFieldValue,
  getLineItemColumns,
} from "@/lib/extracted-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  RefreshCw
} from "lucide-react";
import type { ExtractedData, ProcessingSession } from "@shared/schema";

type ProcessingStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "needs_review"
  | "error";

type BulkStatus = "queued" | "processing" | "completed" | "failed";

interface FileInfo {
  name: string;
  size: number;
  type: string;
  objectPath?: string;
}

interface BulkItem {
  id: string;
  file: File;
  fileInfo: FileInfo;
  status: BulkStatus;
  sessionId?: string;
  objectPath?: string;
  extractedData?: ExtractedData | null;
  errorMessage?: string;
  errorCode?: string | null;
}

interface EntitlementInfo {
  plan: "free" | "pro";
  status?: string | null;
}

interface HistoryDraftPayload {
  extractedData: ExtractedData;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  historyId?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BULK_FILES = 10;
const HISTORY_DRAFT_KEY = "invoiceai_history_draft";
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const errorFormFields = [
  "Vendor Name",
  "Invoice Number",
  "Invoice Date",
  "Total Amount",
  "VAT Amount",
  "Currency",
];

const sanitizeBaseName = (name: string) => {
  const baseName = name.replace(/\.[^/.]+$/, "") || "document";
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  return sanitized || "document";
};

const getSheetName = (name: string, usedNames: Set<string>) => {
  const baseName = sanitizeBaseName(name).replace(/[\[\]\*\?\/\\]/g, "_");
  const maxLength = 31;
  let sheetName = baseName.slice(0, maxLength) || "Sheet";
  let counter = 1;
  while (usedNames.has(sheetName)) {
    const suffix = `-${counter}`;
    sheetName = `${baseName.slice(0, maxLength - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(sheetName);
  return sheetName;
};

export default function UploadApp() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editableData, setEditableData] = useState<ExtractedData | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteAfterProcessing, setDeleteAfterProcessing] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkActive, setBulkActive] = useState(false);
  const bulkItemsRef = useRef<BulkItem[]>([]);

  const createSessionMutation = useMutation({
    mutationFn: async (file: FileInfo) => {
      const response = await apiRequest("POST", "/api/sessions", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        objectPath: file.objectPath,
      });
      return response.json() as Promise<ProcessingSession>;
    },
  });

  const processSessionMutation = useMutation({
    mutationFn: async ({
      id,
      fileDataUrl,
      objectPath,
      deleteAfterProcessing,
    }: {
      id: string;
      fileDataUrl?: string;
      objectPath?: string;
      deleteAfterProcessing?: boolean;
    }) => {
      const response = await apiRequest("POST", `/api/sessions/${id}/process`, {
        fileDataUrl,
        objectPath,
        deleteAfterProcessing,
      });
      return response.json() as Promise<ProcessingSession>;
    },
  });

  useEffect(() => {
    bulkItemsRef.current = bulkItems;
  }, [bulkItems]);

  useEffect(() => {
    let active = true;
    apiRequest("GET", "/api/billing/entitlement")
      .then((response) => response.json())
      .then((data: EntitlementInfo) => {
        if (active) {
          setEntitlement(data);
        }
      })
      .catch(() => {
        if (active) {
          setEntitlement({ plan: "free" });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (filePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    const raw = window.sessionStorage.getItem(HISTORY_DRAFT_KEY);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as HistoryDraftPayload;
      if (!payload?.extractedData) {
        window.sessionStorage.removeItem(HISTORY_DRAFT_KEY);
        return;
      }
      window.sessionStorage.removeItem(HISTORY_DRAFT_KEY);
      setBulkMode(false);
      setBulkItems([]);
      setBulkActive(false);
      setStatus("completed");
      setProgress(100);
      setExtractedData(payload.extractedData);
      setEditableData(payload.extractedData);
      setOcrText("");
      setErrorCode(null);
      setErrorMessage(null);
      setErrorDetails(null);
      setFilePreviewUrl(null);
      setSessionId(payload.historyId ?? null);
      setFileInfo({
        name: payload.fileName || "history-document",
        size: payload.fileSize ?? 0,
        type: payload.fileType || "application/pdf",
      });
    } catch (error) {
      window.sessionStorage.removeItem(HISTORY_DRAFT_KEY);
    }
  }, []);

  const isPro =
    entitlement?.plan === "pro" &&
    (!entitlement.status ||
      ["active", "trialing", "past_due"].includes(entitlement.status));

  const renderDeleteToggle = (id: string) => (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          Delete immediately after processing
        </Label>
        <p className="text-xs text-muted-foreground">
          Removes the file from storage after extraction. Re-run will be disabled.
        </p>
      </div>
      <Switch
        id={id}
        checked={deleteAfterProcessing}
        onCheckedChange={setDeleteAfterProcessing}
        data-testid={`${id}-toggle`}
      />
    </div>
  );

  const applyProcessResult = useCallback(
    (result: ProcessingSession) => {
      if (result.status === "completed" && result.extractedData) {
        setExtractedData(result.extractedData);
        setEditableData(result.extractedData);
        setOcrText("");
        setErrorCode(null);
        setErrorMessage(null);
        setErrorDetails(null);
        setStatus("completed");
        return;
      }

      if (result.status === "needs_review") {
        const manualId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : String(Date.now());
        setExtractedData(null);
        setEditableData({ id: manualId, fields: [], lineItems: [] });
        setOcrText(result.ocrText || "");
        setErrorCode(result.errorCode || null);
        setErrorMessage(
          result.errorMessage ||
            "AI extraction failed. Use the OCR text to map fields manually."
        );
        setStatus("needs_review");
        return;
      }

      if (result.status === "error") {
        setStatus("error");
        setErrorMessage(result.errorMessage || "Processing failed. Please try again.");
        setErrorCode(result.errorCode || null);
      }
    },
    [],
  );

  const requestSignedUpload = useCallback(async (file: File) => {
    const response = await apiRequest("POST", "/api/uploads/request-url", {
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    });
    return (await response.json()) as {
      uploadUrl: string;
      objectPath: string;
      expiresAtMs?: number;
    };
  }, []);

  const uploadToSignedUrl = useCallback(async (file: File, uploadUrl: string) => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new Error("Secure upload failed.");
    }
  }, []);

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
    setErrorCode(null);
    setErrorDetails(null);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 30));
    }, 100);
    let processingInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const previewUrl = URL.createObjectURL(file);
      setFilePreviewUrl(previewUrl);
      setFileDataUrl(null);
      setObjectPath(null);

      const signed = await requestSignedUpload(file);
      await uploadToSignedUrl(file, signed.uploadUrl);
      setObjectPath(signed.objectPath);

      const session = await createSessionMutation.mutateAsync({
        ...info,
        objectPath: signed.objectPath,
      });
      setSessionId(session.id);
      clearInterval(progressInterval);
      setProgress(40);
      setStatus("processing");

      processingInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 150);

      const result = await processSessionMutation.mutateAsync({
        id: session.id,
        objectPath: signed.objectPath,
        deleteAfterProcessing,
      });
      clearInterval(processingInterval);
      setProgress(100);
      applyProcessResult(result);
      if (deleteAfterProcessing) {
        setObjectPath(null);
        setFileDataUrl(null);
      }
    } catch (error) {
      clearInterval(progressInterval);
      if (processingInterval) {
        clearInterval(processingInterval);
      }
      setStatus("error");
      const fallbackMessage = "There was an error processing your file. Please try again.";
      let message = fallbackMessage;
      let code: string | null = null;
      let details: unknown | null = null;

      if (error instanceof ApiError) {
        code = error.code ?? null;
        details = error.details ?? null;
        if (error.message) {
          message = error.message;
        }
        if (error.code === "AI_TIMEOUT") {
          message = "AI processing timed out. Please try again.";
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      setErrorMessage(message);
      setErrorCode(code);
      setErrorDetails(details);
      toast({
        title: "Processing Failed",
        description: message,
        variant: "destructive",
      });
    }
  }, [
    applyProcessResult,
    createSessionMutation,
    deleteAfterProcessing,
    processSessionMutation,
    requestSignedUpload,
    toast,
    uploadToSignedUrl,
  ]);

  const resetSingleState = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setFileInfo(null);
    setFilePreviewUrl(null);
    setFileDataUrl(null);
    setObjectPath(null);
    setSessionId(null);
    setExtractedData(null);
    setEditableData(null);
    setOcrText("");
    setErrorCode(null);
    setErrorMessage(null);
    setErrorDetails(null);
  }, []);

  const processBulkItem = useCallback(
    async (itemId: string) => {
      const item = bulkItemsRef.current.find((entry) => entry.id === itemId);
      if (!item) return;

      setBulkItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId
            ? { ...entry, status: "processing", errorMessage: undefined, errorCode: null }
            : entry
        )
      );

      try {
        const signed = await requestSignedUpload(item.file);
        await uploadToSignedUrl(item.file, signed.uploadUrl);
        const session = await createSessionMutation.mutateAsync({
          ...item.fileInfo,
          objectPath: signed.objectPath,
        });
        setBulkItems((prev) =>
          prev.map((entry) =>
            entry.id === itemId
              ? { ...entry, sessionId: session.id, objectPath: signed.objectPath }
              : entry
          )
        );

        const result = await processSessionMutation.mutateAsync({
          id: session.id,
          objectPath: signed.objectPath,
          deleteAfterProcessing,
        });

        if (result.status === "completed" && result.extractedData) {
          setBulkItems((prev) =>
            prev.map((entry) =>
              entry.id === itemId
                ? {
                    ...entry,
                    status: "completed",
                    extractedData: result.extractedData,
                    errorMessage: undefined,
                    errorCode: null,
                  }
                : entry
            )
          );
          return;
        }

        const failureMessage =
          result.status === "needs_review"
            ? "Needs manual review. Process individually to edit."
            : result.errorMessage || "Processing failed.";
        setBulkItems((prev) =>
          prev.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  status: "failed",
                  extractedData: null,
                  errorMessage: failureMessage,
                  errorCode: result.errorCode || null,
                }
              : entry
          )
        );
      } catch (error) {
        let message = "Processing failed.";
        let code: string | null = null;
        if (error instanceof ApiError) {
          message = error.message || message;
          code = error.code ?? null;
        } else if (error instanceof Error && error.message) {
          message = error.message;
        }
        setBulkItems((prev) =>
          prev.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  status: "failed",
                  extractedData: null,
                  errorMessage: message,
                  errorCode: code,
                }
              : entry
          )
        );
      }
    },
    [createSessionMutation, deleteAfterProcessing, processSessionMutation, requestSignedUpload, uploadToSignedUrl]
  );

  const startBulkProcessing = useCallback(async () => {
    if (bulkActive) return;
    setBulkActive(true);
    try {
      while (true) {
        const nextItem = bulkItemsRef.current.find((entry) => entry.status === "queued");
        if (!nextItem) break;
        await processBulkItem(nextItem.id);
      }
    } finally {
      setBulkActive(false);
    }
  }, [bulkActive, processBulkItem]);

  const handleBulkRetry = (itemId: string) => {
    setBulkItems((prev) =>
      prev.map((entry) =>
        entry.id === itemId
          ? { ...entry, status: "queued", errorMessage: undefined, errorCode: null }
          : entry
      )
    );
    void startBulkProcessing();
  };

  const handleBulkReset = () => {
    setBulkItems([]);
    setBulkMode(false);
    setBulkActive(false);
    resetSingleState();
  };

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const incoming = Array.from(files);
      const validFiles: File[] = [];
      const invalidType = incoming.filter((file) => !isValidFileType(file));
      const tooLarge = incoming.filter((file) => file.size > MAX_FILE_SIZE_BYTES);

      for (const file of incoming) {
        if (!isValidFileType(file)) continue;
        if (file.size > MAX_FILE_SIZE_BYTES) continue;
        validFiles.push(file);
      }

      if (invalidType.length > 0) {
        toast({
          title: "Invalid file type",
          description: "Only PDF, JPG, or PNG files are supported.",
          variant: "destructive",
        });
      }

      if (tooLarge.length > 0) {
        toast({
          title: "File too large",
          description: "Some files exceed the 10MB limit and were skipped.",
          variant: "destructive",
        });
      }

      if (validFiles.length === 0) {
        return;
      }

      const shouldUseBulk = bulkMode || validFiles.length > 1;
      if (!shouldUseBulk) {
        resetSingleState();
        processFile(validFiles[0]);
        return;
      }

      if (!isPro) {
        toast({
          title: "Upgrade required",
          description: "Bulk upload is available on the Pro plan.",
          variant: "destructive",
        });
        resetSingleState();
        processFile(validFiles[0]);
        return;
      }

      const availableSlots = MAX_BULK_FILES - bulkItemsRef.current.length;
      if (availableSlots <= 0) {
        toast({
          title: "Queue is full",
          description: `Bulk upload supports up to ${MAX_BULK_FILES} files at a time.`,
          variant: "destructive",
        });
        return;
      }

      const acceptedFiles = validFiles.slice(0, availableSlots);
      if (validFiles.length > availableSlots) {
        toast({
          title: "Some files skipped",
          description: `Only ${availableSlots} files were added to the queue.`,
        });
      }

      const newItems = acceptedFiles.map((file) => ({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        file,
        fileInfo: { name: file.name, size: file.size, type: file.type },
        status: "queued" as BulkStatus,
        extractedData: null,
      }));

      setBulkItems((prev) => [...prev, ...newItems]);
      setBulkMode(true);
      resetSingleState();
      void startBulkProcessing();
    },
    [bulkMode, isPro, processFile, resetSingleState, startBulkProcessing, toast],
  );

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }, [handleFilesSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
      e.target.value = "";
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    return validTypes.includes(file.type);
  };

  const handleFieldChange = (index: number, value: string) => {
    if (!editableData) return;
    const nextFields = editableData.fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? { ...field, value, confidence: null, issues: undefined }
        : field
    );
    setEditableData({ ...editableData, fields: nextFields });
  };

  const handleFieldLabelChange = (index: number, label: string) => {
    if (!editableData) return;
    const nextFields = editableData.fields.map((field, fieldIndex) =>
      fieldIndex === index
        ? { ...field, label, confidence: null, issues: undefined }
        : field
    );
    setEditableData({ ...editableData, fields: nextFields });
  };

  const handleAddField = () => {
    if (!editableData) return;
    setEditableData({
      ...editableData,
      fields: [...editableData.fields, { label: "", value: "", confidence: null }],
    });
  };

  const handleRemoveField = (index: number) => {
    if (!editableData) return;
    setEditableData({
      ...editableData,
      fields: editableData.fields.filter((_, fieldIndex) => fieldIndex !== index),
    });
  };

  const handleExportExcel = () => {
    if (editableData) {
      void trackEvent("export_xlsx");
      const rows = buildRowsFromExtractedData(editableData);
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = getSheetName(fileInfo?.name || "Document", new Set());
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      const blob = new Blob([data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = sanitizeBaseName(fileInfo?.name || "extracted-data");
      a.download = `${baseName}.xlsx`;
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
      void trackEvent("export_csv");
      const rows = buildRowsFromExtractedData(editableData);
      const csvContent = buildDelimitedContent(rows, ",");
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

  const handleCopyOcrText = () => {
    if (!ocrText) return;
    navigator.clipboard.writeText(ocrText);
    toast({
      title: "OCR text copied",
      description: "The OCR text is ready to paste.",
    });
  };

  const handleRerunExtraction = async () => {
    if (!sessionId) {
      toast({
        title: "No session available",
        description: "Upload a document before re-running extraction.",
        variant: "destructive",
      });
      return;
    }
    if (!objectPath && !fileDataUrl) {
      toast({
        title: "File unavailable",
        description: "The original file is no longer available. Please upload again.",
        variant: "destructive",
      });
      return;
    }

    setStatus("processing");
    setProgress(40);
    setErrorMessage(null);
    setErrorCode(null);
    setErrorDetails(null);

    const processingInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 90));
    }, 150);

    try {
      const result = await processSessionMutation.mutateAsync({
        id: sessionId,
        objectPath: objectPath || undefined,
        fileDataUrl: fileDataUrl || undefined,
        deleteAfterProcessing,
      });
      clearInterval(processingInterval);
      setProgress(100);
      applyProcessResult(result);
      if (deleteAfterProcessing) {
        setObjectPath(null);
        setFileDataUrl(null);
      }
    } catch (error) {
      clearInterval(processingInterval);
      setStatus("error");
      const fallbackMessage = "There was an error processing your file. Please try again.";
      let message = fallbackMessage;
      let code: string | null = null;
      let details: unknown | null = null;

      if (error instanceof ApiError) {
        code = error.code ?? null;
        details = error.details ?? null;
        if (error.message) {
          message = error.message;
        }
        if (error.code === "AI_TIMEOUT") {
          message = "AI processing timed out. Please try again.";
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      setErrorMessage(message);
      setErrorCode(code);
      setErrorDetails(details);
      toast({
        title: "Processing Failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(HISTORY_DRAFT_KEY);
    }
    resetSingleState();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const queuedBulkCount = bulkItems.filter((item) => item.status === "queued").length;
  const processingBulkCount = bulkItems.filter((item) => item.status === "processing").length;
  const completedBulkItems = bulkItems.filter(
    (item) => item.status === "completed" && item.extractedData
  );
  const failedBulkCount = bulkItems.filter((item) => item.status === "failed").length;
  const totalBulkCount = bulkItems.length;
  const bulkProgress =
    totalBulkCount > 0
      ? Math.round(((completedBulkItems.length + failedBulkCount) / totalBulkCount) * 100)
      : 0;

  const handleDownloadCombinedExcel = async () => {
    if (completedBulkItems.length === 0) return;
    void trackEvent("export_xlsx");
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    completedBulkItems.forEach((item, index) => {
      if (!item.extractedData) return;
      const rows = buildRowsFromExtractedData(item.extractedData);
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = getSheetName(item.fileInfo.name || `Document ${index + 1}`, usedNames);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });

    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk-extract-${Date.now()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZipCsv = async () => {
    if (completedBulkItems.length === 0) return;
    void trackEvent("export_csv");
    const zip = new JSZip();
    const usedNames = new Set<string>();

    completedBulkItems.forEach((item, index) => {
      if (!item.extractedData) return;
      const rows = buildRowsFromExtractedData(item.extractedData);
      const csvContent = buildDelimitedContent(rows, ",");
      let baseName = sanitizeBaseName(item.fileInfo.name || `document-${index + 1}`);
      let fileName = `${baseName}.csv`;
      let counter = 1;
      while (usedNames.has(fileName)) {
        fileName = `${baseName}-${counter}.csv`;
        counter += 1;
      }
      usedNames.add(fileName);
      zip.file(fileName, csvContent);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk-csv-${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lineItemColumns = editableData?.lineItems
    ? getLineItemColumns(editableData.lineItems)
    : [];
  const usageLimitDetails =
    errorDetails &&
    typeof errorDetails === "object" &&
    "limit" in errorDetails &&
    "remaining" in errorDetails
      ? (errorDetails as { limit: number; remaining: number })
      : null;

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

        {bulkMode && (
          <>
            <Card className="mt-12">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg">Bulk Upload Queue</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {totalBulkCount} file{totalBulkCount === 1 ? "" : "s"} •{" "}
                    {completedBulkItems.length} done • {failedBulkCount} failed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("bulk-file-input")?.click()}
                    disabled={!isPro || bulkItems.length >= MAX_BULK_FILES}
                  >
                    Add Files
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleBulkReset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  id="bulk-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Queued: {queuedBulkCount}</Badge>
                  <Badge variant="secondary">Processing: {processingBulkCount}</Badge>
                  <Badge variant="outline">Done: {completedBulkItems.length}</Badge>
                  <Badge variant={failedBulkCount > 0 ? "destructive" : "secondary"}>
                    Failed: {failedBulkCount}
                  </Badge>
                </div>

                <div className="mb-6">
                  <Progress value={bulkProgress} className="h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {bulkProgress}% complete
                  </p>
                </div>

                {renderDeleteToggle("delete-after-processing-bulk")}

                {bulkItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                    No files in the queue yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.fileInfo.name}
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(item.fileInfo.size)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "failed"
                                  ? "destructive"
                                  : item.status === "completed"
                                    ? "outline"
                                    : "secondary"
                              }
                            >
                              {item.status === "queued"
                                ? "Queued"
                                : item.status === "processing"
                                  ? "Processing"
                                  : item.status === "completed"
                                    ? "Done"
                                    : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.errorMessage || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.status === "failed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBulkRetry(item.id)}
                              >
                                Retry
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    onClick={startBulkProcessing}
                    disabled={bulkActive || queuedBulkCount === 0}
                  >
                    {bulkActive ? "Processing..." : "Process Queue"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadCombinedExcel}
                    disabled={completedBulkItems.length === 0}
                  >
                    Download Combined Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadZipCsv}
                    disabled={completedBulkItems.length === 0}
                  >
                    Download ZIP of CSVs
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Bulk upload supports up to {MAX_BULK_FILES} files per batch.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {!bulkMode && status === "idle" && (
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
                  multiple={isPro}
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
                  {isPro
                    ? ` • Bulk upload up to ${MAX_BULK_FILES} files`
                    : " • Bulk upload is Pro only"}
                </p>
              </div>
              {renderDeleteToggle("delete-after-processing-single")}
            </CardContent>
          </Card>
        )}

        {!bulkMode && (status === "uploading" || status === "processing") && (
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

        {!bulkMode && status === "error" && (
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
                      {errorCode && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Error code: {errorCode}
                        </p>
                      )}
                      {errorCode === "USAGE_LIMIT" && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Free plan limit reached{usageLimitDetails ? ` (${usageLimitDetails.limit} per day)` : ""}.
                        </p>
                      )}
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
                    {errorCode === "USAGE_LIMIT" && (
                      <Button asChild data-testid="button-upgrade">
                        <Link href="/pricing">Upgrade to Pro</Link>
                      </Button>
                    )}
                    {errorCode !== "USAGE_LIMIT" && (objectPath || fileDataUrl) && (
                      <Button
                        variant="outline"
                        onClick={handleRerunExtraction}
                        className="gap-2"
                        data-testid="button-rerun-extraction"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Re-run Extraction
                      </Button>
                    )}
                    <Button
                      onClick={handleReset}
                      variant={errorCode === "USAGE_LIMIT" ? "outline" : "default"}
                      data-testid="button-try-again"
                    >
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
                  {errorCode && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Error code: {errorCode}
                    </p>
                  )}
                  {errorCode === "USAGE_LIMIT" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Free plan limit reached{usageLimitDetails ? ` (${usageLimitDetails.limit} per day)` : ""}.
                    </p>
                  )}
                  {errorCode === "USAGE_LIMIT" && (
                    <Button asChild className="mt-6" data-testid="button-upgrade">
                      <Link href="/pricing">Upgrade to Pro</Link>
                    </Button>
                  )}
                  {errorCode !== "USAGE_LIMIT" && (objectPath || fileDataUrl) && (
                    <Button
                      onClick={handleRerunExtraction}
                      variant="outline"
                      className="mt-4 gap-2"
                      data-testid="button-rerun-extraction"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Re-run Extraction
                    </Button>
                  )}
                  <Button onClick={handleReset} className="mt-6" data-testid="button-try-again">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!bulkMode && status === "needs_review" && editableData && (
          <>
            <Card className="mt-12">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Manual Review Needed</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {errorMessage ||
                        "AI extraction failed. Use OCR text to map fields manually."}
                    </p>
                    {errorCode && (
                      <Badge variant="outline" className="mt-2">
                        Error code: {errorCode}
                      </Badge>
                    )}
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
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Document Preview
                      </h3>
                      {fileInfo && (
                        <span className="text-xs text-muted-foreground">
                          {fileInfo.name}
                        </span>
                      )}
                    </div>
                    <div className="relative min-h-[360px] overflow-hidden rounded-xl border bg-background">
                      {filePreviewUrl ? (
                        fileInfo?.type === "application/pdf" ? (
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
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Preview unavailable
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          OCR Text
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={handleCopyOcrText}
                          disabled={!ocrText}
                        >
                          <Copy className="h-4 w-4" />
                          Copy OCR
                        </Button>
                      </div>
                      <Textarea
                        value={ocrText}
                        readOnly
                        rows={10}
                        placeholder="OCR text will appear here."
                        className="min-h-[240px]"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Manual Mapping
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddField}>
                          Add Field
                        </Button>
                      </div>

                      {editableData.fields.length === 0 ? (
                        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          No fields yet. Add a field to start mapping the OCR text.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-1/3">Label</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead className="w-12" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editableData.fields.map((field, index) => (
                              <TableRow key={`manual-${index}`}>
                                <TableCell className="font-medium">
                                  <Input
                                    value={field.label}
                                    onChange={(e) => handleFieldLabelChange(index, e.target.value)}
                                    placeholder="Field label"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={formatFieldValue(field.value)}
                                    onChange={(e) => handleFieldChange(index, e.target.value)}
                                    placeholder="Value"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveField(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </div>
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
              <Button
                variant="outline"
                onClick={handleRerunExtraction}
                className="gap-2"
                disabled={!objectPath && !fileDataUrl}
                data-testid="button-rerun-extraction"
              >
                <RefreshCw className="h-4 w-4" />
                Re-run Extraction
              </Button>
              <Button variant="ghost" onClick={handleReset} className="gap-2" data-testid="button-new-upload">
                <Trash2 className="h-4 w-4" />
                New Upload
              </Button>
            </div>
          </>
        )}

        {!bulkMode && status === "completed" && editableData && (
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
                    {editableData.fields.map((field, index) => {
                      const fieldIssues = Array.isArray(field.issues) ? field.issues : [];
                      const fieldConfidence =
                        typeof field.confidence === "number" ? field.confidence : null;
                      const isLowConfidence =
                        fieldConfidence !== null && fieldConfidence < LOW_CONFIDENCE_THRESHOLD;
                      const needsAttention = isLowConfidence || fieldIssues.length > 0;

                      return (
                        <TableRow
                          key={`${field.label}-${index}`}
                          className={needsAttention ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{field.label}</span>
                              {needsAttention && (
                                <Badge variant="outline" className="border-amber-400 text-amber-700">
                                  Check
                                </Badge>
                              )}
                            </div>
                            {fieldIssues.length > 0 && (
                              <p className="mt-1 text-xs text-amber-700">{fieldIssues[0]}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={formatFieldValue(field.value)}
                              onChange={(e) => handleFieldChange(index, e.target.value)}
                              className={`max-w-sm ${needsAttention ? "border-amber-300" : ""}`}
                              data-testid={`input-field-${index}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
              <Button
                variant="outline"
                onClick={handleRerunExtraction}
                className="gap-2"
                disabled={!objectPath && !fileDataUrl}
                data-testid="button-rerun-extraction"
              >
                <RefreshCw className="h-4 w-4" />
                Re-run Extraction
              </Button>
              <Button variant="ghost" onClick={handleReset} className="gap-2" data-testid="button-new-upload">
                <Trash2 className="h-4 w-4" />
                New Upload
              </Button>
            </div>
          </>
        )}

        <div className="mt-12 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span data-testid="text-security-notice">
              Files are encrypted in transit and at rest.
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            We never use your documents for AI training.
          </span>
          <span className="text-xs text-muted-foreground">
            Free plan includes 3 documents per day.{" "}
            <Link href="/pricing" className="text-primary hover:underline">
              Upgrade
            </Link>
            .
          </span>
        </div>
      </div>
    </div>
  );
}
