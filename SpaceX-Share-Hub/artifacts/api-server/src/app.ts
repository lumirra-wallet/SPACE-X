import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built React frontend (production only)
// FRONTEND_DIST is set by server.mjs (repo root entrypoint) using import.meta.url,
// which is the most reliable way to get the correct absolute path on Vercel.
const frontendDist = process.env["FRONTEND_DIST"] ?? null;

logger.info({ frontendDist, __dirname, cwd: process.cwd() }, "Frontend dist resolution");

if (frontendDist && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/*splat", (_req, res) => {
    res.status(503).json({
      error: "Frontend not found",
      FRONTEND_DIST: frontendDist,
      __dirname,
      cwd: process.cwd(),
    });
  });
}

export default app;
