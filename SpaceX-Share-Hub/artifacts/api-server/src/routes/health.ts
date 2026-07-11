import { Router, type IRouter } from "express";
import { getSmtpStatus } from "../lib/email";
import { getMongoStatus } from "../lib/mongodb";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const smtp = getSmtpStatus();
  const mongo = getMongoStatus();
  res.json({
    status: mongo.connected ? "ok" : "degraded",
    mongo: {
      connected: mongo.connected,
      host: mongo.host,
    },
    smtp: {
      status: smtp.status,
      checkedAt: smtp.checkedAt,
    },
  });
});

export default router;
