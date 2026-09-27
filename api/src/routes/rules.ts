import { Router } from "express";
import { requireAdminKey } from "../middleware";
import { createRule } from "../controllers/rule";

const router = Router();
router.use(requireAdminKey);
router.post("/", createRule);

export default router;
