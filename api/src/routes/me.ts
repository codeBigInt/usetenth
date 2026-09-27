import { Router } from "express";
import { readMe, readRule, saveRule, savePrefs } from "../controllers/me";

const router = Router();
router.get("/", readMe);
router.get("/rule", readRule);
router.put("/rule", saveRule);
router.put("/prefs", savePrefs);

export default router;
