import {
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { PageMeta } from "@/components/seo/page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileImage,
  Files,
  ImagePlus,
  Loader2,
  Minimize2,
  Scissors,
  Trash2,
} from "lucide-react";

type ToolStatus = "idle" | "uploading" | "processing" | "done" | "error";

type ToolResultFile = {
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
};

type ToolResult = {
  jobId: string;
  status: string;
  files: ToolResultFile[];
};

const MAX_FILES = 10;
const PDF_TOOL_MAX_FILE_SIZE_MB = 50;
const PDF_TOOL_MAX_PDF_PAGES = 100;

const metaDescription =
  "Merge, split, compress, and convert PDFs with secure uploads and fast processing.";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function inferContentType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (name.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

async function requestSignedUpload(file: File) {
  const contentType = inferContentType(file);
  const response = await apiRequest("POST", "/api/uploads/request-url", {
    name: file.name,
    size: file.size,
    contentType,
    scope: "pdf_tool",
  });
  return { ...(await response.json()), contentType } as {
    uploadUrl: string;
    objectPath: string;
    contentType: string;
  };
}

async function uploadToSignedUrl(uploadUrl: string, file: File, contentType: string) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error("Upload failed.");
  }
}

async function uploadFilesWithProgress(
  files: File[],
  setProgress: (value: number) => void,
) {
  const paths: string[] = [];
  const total = files.length;
  let completed = 0;
  for (const file of files) {
    const { uploadUrl, objectPath, contentType } = await requestSignedUpload(file);
    await uploadToSignedUrl(uploadUrl, file, contentType);
    paths.push(objectPath);
    completed += 1;
    setProgress(Math.round((completed / total) * 100));
  }
  return paths;
}

function ResultList({ result }: { result: ToolResult | null }) {
  if (!result || result.files.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      {result.files.map((file, index) => (
        <div
          key={`${file.fileName}-${index}`}
          className="flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">{file.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
          </div>
          <Button size="sm" asChild className="gap-2">
            <a href={file.downloadUrl} download>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}

function ReorderList({
  files,
  onMove,
  onRemove,
}: {
  files: File[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={index === files.length - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRemove(index)}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PdfTools() {
  const { toast } = useToast();
  const [deleteAfterProcessing, setDeleteAfterProcessing] = useState(true);

  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeStatus, setMergeStatus] = useState<ToolStatus>("idle");
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeResult, setMergeResult] = useState<ToolResult | null>(null);

  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitPages, setSplitPages] = useState("");
  const [splitStatus, setSplitStatus] = useState<ToolStatus>("idle");
  const [splitProgress, setSplitProgress] = useState(0);
  const [splitResult, setSplitResult] = useState<ToolResult | null>(null);

  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressQuality, setCompressQuality] = useState<"low" | "medium" | "high">("medium");
  const [compressStatus, setCompressStatus] = useState<ToolStatus>("idle");
  const [compressProgress, setCompressProgress] = useState(0);
  const [compressResult, setCompressResult] = useState<ToolResult | null>(null);

  const [pdfToJpgFile, setPdfToJpgFile] = useState<File | null>(null);
  const [pdfToJpgRange, setPdfToJpgRange] = useState("");
  const [pdfToJpgQuality, setPdfToJpgQuality] = useState(85);
  const [pdfToJpgDpi, setPdfToJpgDpi] = useState(150);
  const [pdfToJpgStatus, setPdfToJpgStatus] = useState<ToolStatus>("idle");
  const [pdfToJpgProgress, setPdfToJpgProgress] = useState(0);
  const [pdfToJpgResult, setPdfToJpgResult] = useState<ToolResult | null>(null);

  const [jpgToPdfFiles, setJpgToPdfFiles] = useState<File[]>([]);
  const [jpgToPdfStatus, setJpgToPdfStatus] = useState<ToolStatus>("idle");
  const [jpgToPdfProgress, setJpgToPdfProgress] = useState(0);
  const [jpgToPdfResult, setJpgToPdfResult] = useState<ToolResult | null>(null);

  const [pdfToWordFile, setPdfToWordFile] = useState<File | null>(null);
  const [pdfToWordStatus, setPdfToWordStatus] = useState<ToolStatus>("idle");
  const [pdfToWordProgress, setPdfToWordProgress] = useState(0);
  const [pdfToWordResult, setPdfToWordResult] = useState<ToolResult | null>(null);

  const [pdfToPowerPointFile, setPdfToPowerPointFile] = useState<File | null>(null);
  const [pdfToPowerPointStatus, setPdfToPowerPointStatus] = useState<ToolStatus>("idle");
  const [pdfToPowerPointProgress, setPdfToPowerPointProgress] = useState(0);
  const [pdfToPowerPointResult, setPdfToPowerPointResult] = useState<ToolResult | null>(null);

  const [pdfToExcelFile, setPdfToExcelFile] = useState<File | null>(null);
  const [pdfToExcelStatus, setPdfToExcelStatus] = useState<ToolStatus>("idle");
  const [pdfToExcelProgress, setPdfToExcelProgress] = useState(0);
  const [pdfToExcelResult, setPdfToExcelResult] = useState<ToolResult | null>(null);

  const [wordToPdfFile, setWordToPdfFile] = useState<File | null>(null);
  const [wordToPdfStatus, setWordToPdfStatus] = useState<ToolStatus>("idle");
  const [wordToPdfProgress, setWordToPdfProgress] = useState(0);
  const [wordToPdfResult, setWordToPdfResult] = useState<ToolResult | null>(null);

  const [powerPointToPdfFile, setPowerPointToPdfFile] = useState<File | null>(null);
  const [powerPointToPdfStatus, setPowerPointToPdfStatus] = useState<ToolStatus>("idle");
  const [powerPointToPdfProgress, setPowerPointToPdfProgress] = useState(0);
  const [powerPointToPdfResult, setPowerPointToPdfResult] = useState<ToolResult | null>(null);

  const mergeBusy = mergeStatus === "uploading" || mergeStatus === "processing";
  const splitBusy = splitStatus === "uploading" || splitStatus === "processing";
  const compressBusy = compressStatus === "uploading" || compressStatus === "processing";
  const pdfToJpgBusy = pdfToJpgStatus === "uploading" || pdfToJpgStatus === "processing";
  const jpgToPdfBusy = jpgToPdfStatus === "uploading" || jpgToPdfStatus === "processing";
  const pdfToWordBusy = pdfToWordStatus === "uploading" || pdfToWordStatus === "processing";
  const pdfToPowerPointBusy =
    pdfToPowerPointStatus === "uploading" || pdfToPowerPointStatus === "processing";
  const pdfToExcelBusy = pdfToExcelStatus === "uploading" || pdfToExcelStatus === "processing";
  const wordToPdfBusy = wordToPdfStatus === "uploading" || wordToPdfStatus === "processing";
  const powerPointToPdfBusy =
    powerPointToPdfStatus === "uploading" || powerPointToPdfStatus === "processing";

  const canMerge = mergeFiles.length >= 2 && !mergeBusy;
  const canSplit = Boolean(splitFile) && !splitBusy;
  const canCompress = Boolean(compressFile) && !compressBusy;
  const canPdfToJpg = Boolean(pdfToJpgFile) && !pdfToJpgBusy;
  const canJpgToPdf = jpgToPdfFiles.length >= 1 && !jpgToPdfBusy;
  const canPdfToWord = Boolean(pdfToWordFile) && !pdfToWordBusy;
  const canPdfToPowerPoint = Boolean(pdfToPowerPointFile) && !pdfToPowerPointBusy;
  const canPdfToExcel = Boolean(pdfToExcelFile) && !pdfToExcelBusy;
  const canWordToPdf = Boolean(wordToPdfFile) && !wordToPdfBusy;
  const canPowerPointToPdf = Boolean(powerPointToPdfFile) && !powerPointToPdfBusy;

  const mergeHint = useMemo(() => {
    if (mergeFiles.length < 2) return "Select at least two PDFs.";
    if (mergeFiles.length > MAX_FILES) return `Max ${MAX_FILES} files per merge.`;
    return "Drag files here and reorder them.";
  }, [mergeFiles.length]);

  const handleError = (error: unknown, fallback: string) => {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : fallback;
    toast({ title: "PDF tool error", description: message, variant: "destructive" });
  };

  const handleMerge = async () => {
    if (!canMerge) return;
    setMergeStatus("uploading");
    setMergeProgress(0);
    try {
      const objectPaths = await uploadFilesWithProgress(mergeFiles, setMergeProgress);
      setMergeStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/merge", {
        objectPaths,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setMergeResult(data);
      setMergeStatus("done");
    } catch (error) {
      setMergeStatus("error");
      handleError(error, "Unable to merge PDFs.");
    }
  };

  const handleSplit = async () => {
    if (!splitFile || !canSplit) return;
    setSplitStatus("uploading");
    setSplitProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([splitFile], setSplitProgress);
      setSplitStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/split", {
        objectPath,
        pages: splitPages || undefined,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setSplitResult(data);
      setSplitStatus("done");
    } catch (error) {
      setSplitStatus("error");
      handleError(error, "Unable to split PDF.");
    }
  };

  const handleCompress = async () => {
    if (!compressFile || !canCompress) return;
    setCompressStatus("uploading");
    setCompressProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([compressFile], setCompressProgress);
      setCompressStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/compress", {
        objectPath,
        quality: compressQuality,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setCompressResult(data);
      setCompressStatus("done");
    } catch (error) {
      setCompressStatus("error");
      handleError(error, "Unable to compress PDF.");
    }
  };

  const handlePdfToJpg = async () => {
    if (!pdfToJpgFile || !canPdfToJpg) return;
    setPdfToJpgStatus("uploading");
    setPdfToJpgProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([pdfToJpgFile], setPdfToJpgProgress);
      setPdfToJpgStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/pdf-to-jpg", {
        objectPath,
        pageRange: pdfToJpgRange || undefined,
        quality: pdfToJpgQuality,
        dpi: pdfToJpgDpi,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setPdfToJpgResult(data);
      setPdfToJpgStatus("done");
    } catch (error) {
      setPdfToJpgStatus("error");
      handleError(error, "Unable to convert PDF to JPG.");
    }
  };

  const handleJpgToPdf = async () => {
    if (!canJpgToPdf) return;
    setJpgToPdfStatus("uploading");
    setJpgToPdfProgress(0);
    try {
      const objectPaths = await uploadFilesWithProgress(jpgToPdfFiles, setJpgToPdfProgress);
      setJpgToPdfStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/jpg-to-pdf", {
        objectPaths,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setJpgToPdfResult(data);
      setJpgToPdfStatus("done");
    } catch (error) {
      setJpgToPdfStatus("error");
      handleError(error, "Unable to convert JPG to PDF.");
    }
  };

  const handlePdfToWord = async () => {
    if (!pdfToWordFile || !canPdfToWord) return;
    setPdfToWordStatus("uploading");
    setPdfToWordProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([pdfToWordFile], setPdfToWordProgress);
      setPdfToWordStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/pdf-to-word", {
        objectPath,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setPdfToWordResult(data);
      setPdfToWordStatus("done");
    } catch (error) {
      setPdfToWordStatus("error");
      handleError(error, "Unable to convert PDF to Word.");
    }
  };

  const handlePdfToPowerPoint = async () => {
    if (!pdfToPowerPointFile || !canPdfToPowerPoint) return;
    setPdfToPowerPointStatus("uploading");
    setPdfToPowerPointProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress(
        [pdfToPowerPointFile],
        setPdfToPowerPointProgress,
      );
      setPdfToPowerPointStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/pdf-to-powerpoint", {
        objectPath,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setPdfToPowerPointResult(data);
      setPdfToPowerPointStatus("done");
    } catch (error) {
      setPdfToPowerPointStatus("error");
      handleError(error, "Unable to convert PDF to PowerPoint.");
    }
  };

  const handlePdfToExcel = async () => {
    if (!pdfToExcelFile || !canPdfToExcel) return;
    setPdfToExcelStatus("uploading");
    setPdfToExcelProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([pdfToExcelFile], setPdfToExcelProgress);
      setPdfToExcelStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/pdf-to-excel", {
        objectPath,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setPdfToExcelResult(data);
      setPdfToExcelStatus("done");
    } catch (error) {
      setPdfToExcelStatus("error");
      handleError(error, "Unable to convert PDF to Excel.");
    }
  };

  const handleWordToPdf = async () => {
    if (!wordToPdfFile || !canWordToPdf) return;
    setWordToPdfStatus("uploading");
    setWordToPdfProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress([wordToPdfFile], setWordToPdfProgress);
      setWordToPdfStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/word-to-pdf", {
        objectPath,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setWordToPdfResult(data);
      setWordToPdfStatus("done");
    } catch (error) {
      setWordToPdfStatus("error");
      handleError(error, "Unable to convert Word to PDF.");
    }
  };

  const handlePowerPointToPdf = async () => {
    if (!powerPointToPdfFile || !canPowerPointToPdf) return;
    setPowerPointToPdfStatus("uploading");
    setPowerPointToPdfProgress(0);
    try {
      const [objectPath] = await uploadFilesWithProgress(
        [powerPointToPdfFile],
        setPowerPointToPdfProgress,
      );
      setPowerPointToPdfStatus("processing");
      const response = await apiRequest("POST", "/api/pdf-tools/powerpoint-to-pdf", {
        objectPath,
        deleteAfterProcessing,
      });
      const data = (await response.json()) as ToolResult;
      setPowerPointToPdfResult(data);
      setPowerPointToPdfStatus("done");
    } catch (error) {
      setPowerPointToPdfStatus("error");
      handleError(error, "Unable to convert PowerPoint to PDF.");
    }
  };

  const handleReorder = (
    files: File[],
    from: number,
    to: number,
    setter: Dispatch<SetStateAction<File[]>>,
  ) => {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setter(next);
  };

  const handleAddFiles = (
    event: ChangeEvent<HTMLInputElement>,
    setter: Dispatch<SetStateAction<File[]>>,
  ) => {
    const next = Array.from(event.target.files ?? []);
    setter((prev) => [...prev, ...next].slice(0, MAX_FILES));
    event.target.value = "";
  };

  return (
    <div className="py-16 md:py-24">
      <PageMeta title="PDF Tools | InvoiceAI" description={metaDescription} />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold md:text-5xl">PDF Tools</h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Merge, split, compress, and convert PDFs in seconds. Files are processed securely
            and auto-deleted after completion.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Switch
            id="delete-after-processing"
            checked={deleteAfterProcessing}
            onCheckedChange={setDeleteAfterProcessing}
          />
          <Label htmlFor="delete-after-processing" className="text-sm font-medium">
            Delete source files after processing
          </Label>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Supports PDF, JPG, PNG, DOCX, PPTX up to {PDF_TOOL_MAX_FILE_SIZE_MB}MB.
          PDF files are limited to {PDF_TOOL_MAX_PDF_PAGES} pages.
        </p>

        <Tabs defaultValue="merge" className="mt-10">
        <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="merge" className="gap-2">
            <Files className="h-4 w-4" />
            Merge
          </TabsTrigger>
            <TabsTrigger value="split" className="gap-2">
              <Scissors className="h-4 w-4" />
              Split
            </TabsTrigger>
            <TabsTrigger value="compress" className="gap-2">
              <Minimize2 className="h-4 w-4" />
              Compress
            </TabsTrigger>
            <TabsTrigger value="pdf-to-jpg" className="gap-2">
              <FileImage className="h-4 w-4" />
              PDF to JPG
            </TabsTrigger>
          <TabsTrigger value="jpg-to-pdf" className="gap-2">
            <ImagePlus className="h-4 w-4" />
            JPG to PDF
          </TabsTrigger>
          <TabsTrigger value="pdf-to-word" className="gap-2">
            PDF to Word
          </TabsTrigger>
          <TabsTrigger value="pdf-to-powerpoint" className="gap-2">
            PDF to PowerPoint
          </TabsTrigger>
          <TabsTrigger value="pdf-to-excel" className="gap-2">
            PDF to Excel
          </TabsTrigger>
          <TabsTrigger value="word-to-pdf" className="gap-2">
            Word to PDF
          </TabsTrigger>
          <TabsTrigger value="powerpoint-to-pdf" className="gap-2">
            PowerPoint to PDF
          </TabsTrigger>
        </TabsList>

          <TabsContent value="merge" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Merge PDFs</CardTitle>
                <CardDescription>
                  Combine multiple PDFs in any order. Use the arrows to rearrange pages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select PDF files</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(event) => handleAddFiles(event, setMergeFiles)}
                />
                <p className="mt-2 text-xs text-muted-foreground">{mergeHint}</p>
                <ReorderList
                  files={mergeFiles}
                  onMove={(from, to) => handleReorder(mergeFiles, from, to, setMergeFiles)}
                  onRemove={(index) =>
                    setMergeFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                />
                {mergeStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={mergeProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {mergeStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing merge...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handleMerge}
                  disabled={!canMerge}
                >
                  Merge PDFs
                </Button>
                <ResultList result={mergeResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="split" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Split PDF</CardTitle>
                <CardDescription>
                  Extract selected pages as individual PDFs. Provide a range like 1-3,5.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setSplitFile(event.target.files?.[0] ?? null)}
                />
                <Label className="mt-4 text-sm font-medium" htmlFor="split-pages">
                  Pages to extract (optional)
                </Label>
                <Input
                  id="split-pages"
                  placeholder="1-3,5"
                  value={splitPages}
                  onChange={(event) => setSplitPages(event.target.value)}
                />
                {splitStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={splitProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {splitStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing split...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handleSplit}
                  disabled={!canSplit}
                >
                  Split PDF
                </Button>
                <ResultList result={splitResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compress" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Compress PDF</CardTitle>
                <CardDescription>
                  Reduce file size while keeping documents readable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setCompressFile(event.target.files?.[0] ?? null)}
                />
                <Label className="mt-4 text-sm font-medium" htmlFor="compress-quality">
                  Quality
                </Label>
                <select
                  id="compress-quality"
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={compressQuality}
                  onChange={(event) =>
                    setCompressQuality(event.target.value as "low" | "medium" | "high")
                  }
                >
                  <option value="low">Low (smallest size)</option>
                  <option value="medium">Medium (balanced)</option>
                  <option value="high">High (best quality)</option>
                </select>
                {compressStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={compressProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {compressStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compressing PDF...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handleCompress}
                  disabled={!canCompress}
                >
                  Compress PDF
                </Button>
                <ResultList result={compressResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf-to-jpg" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>PDF to JPG</CardTitle>
                <CardDescription>
                  Convert PDF pages to JPG images. Use a page range to limit output.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setPdfToJpgFile(event.target.files?.[0] ?? null)}
                />
                <Label className="mt-4 text-sm font-medium" htmlFor="pdf-to-jpg-pages">
                  Page range (optional)
                </Label>
                <Input
                  id="pdf-to-jpg-pages"
                  placeholder="1-3,5"
                  value={pdfToJpgRange}
                  onChange={(event) => setPdfToJpgRange(event.target.value)}
                />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium" htmlFor="pdf-to-jpg-quality">
                      JPG quality
                    </Label>
                    <Input
                      id="pdf-to-jpg-quality"
                      type="number"
                      min={30}
                      max={100}
                      value={pdfToJpgQuality}
                      onChange={(event) => setPdfToJpgQuality(Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium" htmlFor="pdf-to-jpg-dpi">
                      DPI
                    </Label>
                    <Input
                      id="pdf-to-jpg-dpi"
                      type="number"
                      min={72}
                      max={300}
                      value={pdfToJpgDpi}
                      onChange={(event) => setPdfToJpgDpi(Number(event.target.value))}
                    />
                  </div>
                </div>
                {pdfToJpgStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={pdfToJpgProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {pdfToJpgStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting PDF to JPG...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handlePdfToJpg}
                  disabled={!canPdfToJpg}
                >
                  Convert to JPG
                </Button>
                <ResultList result={pdfToJpgResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jpg-to-pdf" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>JPG to PDF</CardTitle>
                <CardDescription>
                  Combine JPG or PNG images into a single PDF document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select image files</Label>
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  onChange={(event) => handleAddFiles(event, setJpgToPdfFiles)}
                />
                <ReorderList
                  files={jpgToPdfFiles}
                  onMove={(from, to) => handleReorder(jpgToPdfFiles, from, to, setJpgToPdfFiles)}
                  onRemove={(index) =>
                    setJpgToPdfFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                />
                {jpgToPdfStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={jpgToPdfProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {jpgToPdfStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting images to PDF...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handleJpgToPdf}
                  disabled={!canJpgToPdf}
                >
                  Convert to PDF
                </Button>
                <ResultList result={jpgToPdfResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf-to-word" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>PDF to Word</CardTitle>
                <CardDescription>
                  Convert PDF files into editable Word documents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setPdfToWordFile(event.target.files?.[0] ?? null)}
                />
                {pdfToWordStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={pdfToWordProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {pdfToWordStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting PDF to Word...
                  </div>
                )}
                <Button className="mt-6 gap-2" onClick={handlePdfToWord} disabled={!canPdfToWord}>
                  Convert to Word
                </Button>
                <ResultList result={pdfToWordResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf-to-powerpoint" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>PDF to PowerPoint</CardTitle>
                <CardDescription>
                  Turn PDF pages into editable PowerPoint slides.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setPdfToPowerPointFile(event.target.files?.[0] ?? null)}
                />
                {pdfToPowerPointStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={pdfToPowerPointProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {pdfToPowerPointStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting PDF to PowerPoint...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handlePdfToPowerPoint}
                  disabled={!canPdfToPowerPoint}
                >
                  Convert to PowerPoint
                </Button>
                <ResultList result={pdfToPowerPointResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf-to-excel" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>PDF to Excel</CardTitle>
                <CardDescription>
                  Extract tables and structured data into Excel format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PDF file</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setPdfToExcelFile(event.target.files?.[0] ?? null)}
                />
                {pdfToExcelStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={pdfToExcelProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {pdfToExcelStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting PDF to Excel...
                  </div>
                )}
                <Button className="mt-6 gap-2" onClick={handlePdfToExcel} disabled={!canPdfToExcel}>
                  Convert to Excel
                </Button>
                <ResultList result={pdfToExcelResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="word-to-pdf" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Word to PDF</CardTitle>
                <CardDescription>
                  Convert DOC or DOCX files to PDF format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a Word file</Label>
                <Input
                  type="file"
                  accept=".doc,.docx"
                  onChange={(event) => setWordToPdfFile(event.target.files?.[0] ?? null)}
                />
                {wordToPdfStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={wordToPdfProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {wordToPdfStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting Word to PDF...
                  </div>
                )}
                <Button className="mt-6 gap-2" onClick={handleWordToPdf} disabled={!canWordToPdf}>
                  Convert to PDF
                </Button>
                <ResultList result={wordToPdfResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="powerpoint-to-pdf" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>PowerPoint to PDF</CardTitle>
                <CardDescription>
                  Convert PPT or PPTX files into a PDF document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium">Select a PowerPoint file</Label>
                <Input
                  type="file"
                  accept=".ppt,.pptx"
                  onChange={(event) => setPowerPointToPdfFile(event.target.files?.[0] ?? null)}
                />
                {powerPointToPdfStatus === "uploading" && (
                  <div className="mt-4">
                    <Progress value={powerPointToPdfProgress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
                  </div>
                )}
                {powerPointToPdfStatus === "processing" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting PowerPoint to PDF...
                  </div>
                )}
                <Button
                  className="mt-6 gap-2"
                  onClick={handlePowerPointToPdf}
                  disabled={!canPowerPointToPdf}
                >
                  Convert to PDF
                </Button>
                <ResultList result={powerPointToPdfResult} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
