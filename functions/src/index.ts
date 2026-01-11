import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { createApp } from "../../server/app";
import { cleanupExpiredUploads } from "../../server/uploads";

const openAiApiKey = defineSecret("AI_INTEGRATIONS_OPENAI_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripePriceId = defineSecret("STRIPE_PRICE_ID");
const adminMetricsToken = defineSecret("ADMIN_METRICS_TOKEN");
const pdfToolsCloudConvertKey = defineSecret("PDF_TOOLS_CLOUDCONVERT_API_KEY");

const appPromise = createApp();
const historyRetentionDays = defineSecret("HISTORY_RETENTION_DAYS");

export const api = onRequest(
  {
    secrets: [
      openAiApiKey,
      stripeSecretKey,
      stripeWebhookSecret,
      stripePriceId,
      adminMetricsToken,
      historyRetentionDays,
      pdfToolsCloudConvertKey,
    ],
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (req, res) => {
    const { app } = await appPromise;
    return app(req, res);
  },
);

export const cleanupUploads = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "us-central1",
  },
  async () => {
    await cleanupExpiredUploads();
  },
);
