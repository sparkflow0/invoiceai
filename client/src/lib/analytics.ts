import { apiRequest } from "@/lib/queryClient";

export type AnalyticsEventName =
  | "upload_start"
  | "upload_success"
  | "process_start"
  | "process_success"
  | "process_fail"
  | "export_csv"
  | "export_xlsx"
  | "upgrade_click"
  | "checkout_success";

export async function trackEvent(
  name: AnalyticsEventName,
  metadata?: {
    docType?: string;
    durationMs?: number;
    errorCode?: string;
  },
) {
  try {
    await apiRequest("POST", "/api/analytics/event", { name, metadata });
  } catch (error) {
    return;
  }
}
