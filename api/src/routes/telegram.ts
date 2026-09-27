import { Router } from "express";
import { handleWebhook } from "../controllers/telegram";
import { telegramWebhookAuth } from "../middleware";

const router = Router();
router.post("/webhook", telegramWebhookAuth, handleWebhook);

export default router;
