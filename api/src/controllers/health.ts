import type { Request, Response } from "express";
import { env } from "../config/env";
import { sendError, sendSuccess } from "../utils/http";

export const welcome = (_req: Request, res: Response) =>
  sendSuccess(res, `Welcome to the usetenth API: v${env.API_VERSION}`, { service: "api", requestId: res.locals.requestId });

export const health = (_req: Request, res: Response) =>
  sendSuccess(res, `Healthy: ${Date.now()}`, {
    requestId: res.locals.requestId,
    status: "ok",
    mode: env.APP_MODE,
    dryRun: env.DRY_RUN,
  });

export const readiness = (isReady: () => boolean) => (_req: Request, res: Response) =>
  isReady()
    ? sendSuccess(res, "Service ready", { requestId: res.locals.requestId, status: "ready" })
    : sendError(res, "Service not ready", { requestId: res.locals.requestId, status: "degraded" }, 503);
