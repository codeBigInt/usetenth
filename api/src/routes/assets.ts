import { Router } from "express";
import { getInvestableAssets } from "../controllers/asset";

const router = Router();
router.get("/investable", getInvestableAssets);

export default router;
