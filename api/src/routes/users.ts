import { Router } from "express";
import { requireAdminKey } from "../middleware";
import { upsertUser } from "../controllers/user";

const router = Router();
router.use(requireAdminKey);
router.post("/", upsertUser);

export default router;
