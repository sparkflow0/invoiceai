import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { attachFirebaseUser } from "./firebase-auth";
import * as Sentry from "@sentry/node";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp(): Promise<{
  app: express.Express;
  httpServer: Server;
}> {
  const app = express();
  const httpServer = createServer(app);
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const forwardedHostHeader = req.headers["x-forwarded-host"];
    const forwardedProtoHeader = req.headers["x-forwarded-proto"];
    const forwardedHost = Array.isArray(forwardedHostHeader)
      ? forwardedHostHeader[0]
      : forwardedHostHeader;
    const forwardedProto = Array.isArray(forwardedProtoHeader)
      ? forwardedProtoHeader[0]
      : forwardedProtoHeader;
    const protocol = (forwardedProto?.split(",")[0] || req.protocol).trim();
    const host = (forwardedHost?.split(",")[0] || req.headers.host || "").trim();
    const appOrigin = host ? `${protocol}://${host}` : "";

    const allowedOrigins = new Set<string>();
    const addAllowed = (value?: string) => {
      if (!value) return;
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => allowedOrigins.add(entry.toLowerCase()));
    };
    addAllowed(process.env.APP_URL);
    addAllowed(process.env.ALLOWED_ORIGINS);

    if (origin && appOrigin) {
      const normalizedOrigin = origin.toLowerCase();
      const normalizedAppOrigin = appOrigin.toLowerCase();
      const isAllowed = normalizedOrigin === normalizedAppOrigin || allowedOrigins.has(normalizedOrigin);

      if (!isAllowed) {
        const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
        if (!safeMethods.has(req.method.toUpperCase())) {
          return res.status(403).json({ message: "Invalid origin." });
        }
      }
    }

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://firebasestorage.googleapis.com https://api.openai.com https://*.ingest.sentry.io",
      "object-src 'self' blob: data:",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });

  app.use(
    express.json({
      limit: "20mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "20mb" }));

  const ipLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? "unknown",
  });

  app.use("/api", attachFirebaseUser, ipLimiter);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (sentryDsn) {
      Sentry.captureException(err);
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  return { app, httpServer };
}
