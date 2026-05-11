import app from "./app";
import { logger } from "./lib/logger";
import { verifySmtpConnection } from "./lib/email";
import { connectMongo } from "./lib/mongodb";
import { Setting } from "./lib/models";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDefaultSettings() {
  const sharePriceSeed = process.env["SHARE_PRICE_SEED"] ?? "150.00";
  const defaults: Array<{ key: string; value: string }> = [
    { key: "share_price", value: sharePriceSeed },
    { key: "system_mode", value: "pre_ipo" },
    { key: "min_investment", value: "2000" },
  ];
  for (const { key, value } of defaults) {
    const existing = await Setting.findOne({ key });
    if (!existing) {
      await Setting.create({ key, value });
      logger.info({ key, value }, "Seeded default setting");
    }
  }
}

async function start() {
  await connectMongo();
  await seedDefaultSettings();
  verifySmtpConnection().catch((e) => logger.error({ err: e }, "SMTP verification check failed"));

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((e) => {
  logger.error({ err: e }, "Fatal startup error");
  process.exit(1);
});
