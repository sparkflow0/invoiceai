import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildDelimitedContent, buildRowsFromExtractedData } from "@/lib/extracted-data";
import type { ExtractedData } from "@shared/schema";
import { Download, FileText, Loader2, Search, Copy } from "lucide-react";

type EntitlementInfo = {
  plan: "free" | "pro";
  status?: string | null;
};

type HistorySummary = {
  id: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  vendorName?: string | null;
  documentDate?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  fieldsCount: number;
  lineItemsCount: number;
  createdAtMs: number;
  expiresAtMs: number;
};

type HistoryDetail = HistorySummary & { extractedData: ExtractedData };

const HISTORY_DRAFT_KEY = "invoiceai_history_draft";

function formatAmount(amount?: number | null, currency?: string | null) {
  if (amount === null || amount === undefined) return "-";
  if (currency && currency.length === 3) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
    } catch (error) {
      return `${amount} ${currency}`;
    }
  }
  return new Intl.NumberFormat().format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value;
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function sanitizeBaseName(name: string) {
  const baseName = name.replace(/\.[^/.]+$/, "") || "document";
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  return sanitized || "document";
}

export default function HistoryPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, HistoryDetail>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const isPro =
    entitlement?.plan === "pro" &&
    (!entitlement.status ||
      ["active", "trialing", "past_due"].includes(entitlement.status));

  useEffect(() => {
    let active = true;
    apiRequest("GET", "/api/billing/entitlement")
      .then((response) => response.json())
      .then((data: EntitlementInfo) => {
        if (active) {
          setEntitlement(data);
          setEntitlementLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setEntitlement({ plan: "free" });
          setEntitlementLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const loadHistory = async (queryOverride?: string) => {
    if (!isAuthenticated) return;
    if (!isPro) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const query = (queryOverride ?? search).trim();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const response = await apiRequest(
        "GET",
        `/api/history${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const data = (await response.json()) as {
        items: HistorySummary[];
        retentionDays?: number;
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      if (typeof data.retentionDays === "number") {
        setRetentionDays(data.retentionDays);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Unable to load history right now.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && isPro) {
      void loadHistory("");
    }
  }, [authLoading, isAuthenticated, isPro]);

  const fetchDetail = async (id: string) => {
    if (detailCache[id]) return detailCache[id];
    setBusyId(id);
    try {
      const response = await apiRequest("GET", `/api/history/${id}`);
      const data = (await response.json()) as HistoryDetail;
      setDetailCache((prev) => ({ ...prev, [id]: data }));
      return data;
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Unable to load document details.";
      toast({
        title: "History Error",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (item: HistorySummary, format: "csv" | "xls") => {
    const detail = await fetchDetail(item.id);
    if (!detail) return;
    const rows = buildRowsFromExtractedData(detail.extractedData);
    const delimiter = format === "csv" ? "," : "\t";
    const content = buildDelimitedContent(rows, delimiter);
    const mime =
      format === "csv" ? "text/csv" : "application/vnd.ms-excel";
    const extension = format === "csv" ? "csv" : "xls";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = sanitizeBaseName(item.fileName || "document");
    a.href = url;
    a.download = `${baseName}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicate = async (item: HistorySummary) => {
    const detail = await fetchDetail(item.id);
    if (!detail) return;
    const payload = {
      extractedData: detail.extractedData,
      fileName: item.fileName,
      fileType: item.fileType,
      fileSize: item.fileSize,
      historyId: item.id,
    };
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(HISTORY_DRAFT_KEY, JSON.stringify(payload));
    }
    setLocation("/app");
  };

  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Document History</h1>
            <p className="text-sm text-muted-foreground">
              Search previous extractions and re-export in seconds.
            </p>
          </div>
          {isPro && retentionDays && (
            <Badge variant="outline">Stored for {retentionDays} days</Badge>
          )}
        </div>

        {authLoading && (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your account...
          </div>
        )}

        {!authLoading && !isAuthenticated && (
          <Card className="mt-10">
            <CardHeader>
              <CardTitle>Log in to view history</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                History is a paid feature that keeps your extracted data available for re-export.
              </p>
              <Button asChild className="mt-4">
                <Link href="/login">Log In</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!authLoading && isAuthenticated && entitlementLoading && (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your plan...
          </div>
        )}

        {!authLoading && isAuthenticated && !entitlementLoading && !isPro && (
          <Card className="mt-10">
            <CardHeader>
              <CardTitle>Upgrade to unlock history</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pro keeps your extracted results for up to 90 days with search and re-export.
              </p>
              <Button asChild className="mt-4">
                <Link href="/pricing">Upgrade to Pro</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!authLoading && isAuthenticated && !entitlementLoading && isPro && (
          <div className="mt-10 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Search history</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadHistory();
                  }}
                  className="flex flex-col gap-3 md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search vendor, date, amount, or invoice number"
                      data-testid="input-history-search"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="gap-2" data-testid="button-history-search">
                      <Search className="h-4 w-4" />
                      Search
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        void loadHistory("");
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Your documents</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading history...
                  </div>
                ) : errorMessage ? (
                  <div className="text-sm text-destructive">{errorMessage}</div>
                ) : items.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No history yet. Process your first invoice to see it here.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.vendorName || item.fileName || "Untitled"}
                            {item.vendorName && item.fileName && (
                              <div className="text-xs text-muted-foreground">
                                {item.fileName}
                              </div>
                            )}
                            {item.invoiceNumber && (
                              <div className="text-xs text-muted-foreground">
                                #{item.invoiceNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(item.documentDate)}</TableCell>
                          <TableCell>{formatAmount(item.totalAmount, item.currency)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              <span>{formatFileSize(item.fileSize)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(item.createdAtMs).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExport(item, "xls")}
                                disabled={busyId === item.id}
                              >
                                <Download className="mr-1 h-4 w-4" />
                                Excel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExport(item, "csv")}
                                disabled={busyId === item.id}
                              >
                                <Download className="mr-1 h-4 w-4" />
                                CSV
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicate(item)}
                                disabled={busyId === item.id}
                              >
                                <Copy className="mr-1 h-4 w-4" />
                                Duplicate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
