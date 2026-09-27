import { Router } from "express";
import { createAddress, createWire, readDeposits } from "../controllers/deposits";
import { requireDemoAccess } from "../middleware";

const router = Router();
router.use(requireDemoAccess);
router.get("/", readDeposits);
router.post("/addresses", createAddress);
router.post("/wire-instructions", createWire);

export default router;
