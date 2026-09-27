import { Router } from "express";
import { readMe, readRule, saveRule } from "../controllers/me";

const router = Router();
router.get("/", readMe);
router.get("/rule", readRule);
router.put("/rule", saveRule);

export default router;
