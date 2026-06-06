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
// __dirname = artifacts/api-server/dist — go up 3 levels to repo root, then into the frontend dist
const frontendDist = path.resolve(__dirname, "../../../artifacts/spacex-platform/dist/public");
logger.info({ frontendDist, exists: existsSync(frontendDist) }, "Frontend dist path");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — all non-API routes serve index.html
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  // Fallback so "Cannot GET /" never appears — helps diagnose path issues
  app.get("/*splat", (_req, res) => {
    res.status(503).json({
      error: "Frontend not built",
      frontendDist,
      __dirname,
    });
  });
}

export default app;
