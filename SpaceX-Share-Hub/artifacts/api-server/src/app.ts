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
// Try multiple candidate roots to handle different Vercel runtime working directories
const candidateRoots = [
  path.resolve(__dirname, "../../.."),         // from artifacts/api-server/dist → repo root
  path.resolve(__dirname, "../../../.."),      // one level deeper just in case
  process.cwd(),                               // Vercel sometimes sets cwd to repo root
  "/vercel/path0/SpaceX-Share-Hub",           // Vercel build-time absolute path
];

const frontendRelative = "artifacts/spacex-platform/dist/public";
const frontendDist =
  candidateRoots
    .map((r) => path.join(r, frontendRelative))
    .find((p) => existsSync(p)) ?? null;

logger.info({ frontendDist, __dirname, cwd: process.cwd() }, "Frontend dist resolution");

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/*splat", (_req, res) => {
    res.status(503).json({
      error: "Frontend not found",
      tried: candidateRoots.map((r) => path.join(r, frontendRelative)),
      __dirname,
      cwd: process.cwd(),
    });
  });
}

export default app;
