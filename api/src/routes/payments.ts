import { Router } from "express";
import { requireAdminKey } from "../middleware";
import { recordPayment } from "../controllers/payment";

const router = Router();
router.use(requireAdminKey);
router.post("/", recordPayment);

export default router;
