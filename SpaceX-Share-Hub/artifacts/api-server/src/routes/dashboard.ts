import { Router, type IRouter, type Request, type Response } from "express";
import { User, Purchase, Transfer } from "../lib/models";
import { requireEnabledUser } from "../middlewares/requireAuth";
import { getSetting } from "./settings";
import { sendTransferRequestNotificationToAdmin } from "../lib/email";

const router: IRouter = Router();

router.get("/dashboard/summary", requireEnabledUser, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const sharePriceStr = await getSetting("share_price");
  const systemMode = await getSetting("system_mode");
  const sharePrice = Number(sharePriceStr ?? "130.00");
  const totalShares = user.totalSharesCredited;
  const totalUsdValue = totalShares * sharePrice;

  const purchases = await Purchase.find({ userId: user._id });

  const pendingPurchases = purchases.filter((p) => p.status === "pending_review").length;
  const confirmedPurchases = purchases.filter((p) => p.status === "confirmed").length;

  res.json({
    totalShares,
    sharePrice,
    totalUsdValue,
    systemMode: systemMode ?? "pre_ipo",
    pendingPurchases,
    confirmedPurchases,
  });
});

router.get("/dashboard/transfers", requireEnabledUser, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const transfers = await Transfer.find({ userId: user._id }).sort({ createdAt: -1 });

  res.json(
    transfers.map((t) => ({
      id: t._id.toString(),
      userId: t.userId.toString(),
      brokerageName: t.brokerageName,
      brokerageAccountNumber: t.brokerageAccountNumber,
      accountHolderName: t.accountHolderName,
      status: t.status,
      createdAt: t.createdAt,
    }))
  );
});

router.post("/dashboard/transfers", requireEnabledUser, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { brokerageName, brokerageAccountNumber, accountHolderName } = req.body as {
    brokerageName: string;
    brokerageAccountNumber: string;
    accountHolderName: string;
  };

  if (!brokerageName || !brokerageAccountNumber || !accountHolderName) {
    res.status(400).json({ error: "All transfer fields are required" });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const systemMode = await getSetting("system_mode");
  const isPostIpo = systemMode === "post_ipo";
  const status = isPostIpo ? "transfer_requested" : "queued";

  const transfer = await Transfer.create({
    userId: user._id,
    brokerageName,
    brokerageAccountNumber,
    accountHolderName,
    status,
  });

  void sendTransferRequestNotificationToAdmin({
    userFullName: user.fullName,
    userEmail: user.email,
    brokerageName,
    brokerageAccountNumber,
    accountHolderName,
    isQueued: !isPostIpo,
  });

  res.status(201).json({
    id: transfer._id.toString(),
    userId: transfer.userId.toString(),
    brokerageName: transfer.brokerageName,
    brokerageAccountNumber: transfer.brokerageAccountNumber,
    accountHolderName: transfer.accountHolderName,
    status: transfer.status,
    createdAt: transfer.createdAt,
  });
});

export default router;
