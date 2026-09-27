import { Router } from "express";
import { health, readiness, welcome } from "../controllers/health";

export function createHealthRouter(isReady: () => boolean) {
  const router = Router();
  router.get("/", welcome);
  router.get("/health", health);
  router.get("/readiness", readiness(isReady));
  return router;
}
