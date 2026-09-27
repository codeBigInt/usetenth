import { Router } from "express";
import { readPortfolio } from "../controllers/portfolio";

const router = Router();
router.get("/", readPortfolio);

export default router;
