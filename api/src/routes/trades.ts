import { Router } from "express";
import { buy, quoteBuy, quoteSell, sell } from "../controllers/trades";
import { requireDemoAccess } from "../middleware";

const router = Router();
router.use(requireDemoAccess);
router.post("/quote", quoteBuy);
router.post("/buy", buy);
router.post("/sell/quote", quoteSell);
router.post("/sell", sell);

export default router;
