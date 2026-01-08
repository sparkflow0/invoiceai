import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { createApp } from "../../server/app";

const openAiApiKey = defineSecret("AI_INTEGRATIONS_OPENAI_API_KEY");

const appPromise = createApp();

export const api = onRequest(
  {
    secrets: [openAiApiKey],
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (req, res) => {
    const { app } = await appPromise;
    return app(req, res);
  },
);
