import OpenAI from "openai";

export const DEFAULT_CONFIDENCE = 0.82;
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const AI_TIMEOUT_MS = 45_000;

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(apiKey: string): OpenAI {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
    }
    return openaiClient;
}

export function clampConfidence(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.min(1, Math.max(0, value));
}

export async function withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fn(controller.signal);
    } catch (error) {
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            if (attempt >= retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 800 * Math.pow(2, attempt)));
            attempt += 1;
        }
    }
}

export function toAppError(error: any, code: string, status: number) {
    return error; // Placeholder
}

export class AppError extends Error {
    constructor(public code: string, message: string, public status: number, public details?: any) {
        super(message);
    }
}
