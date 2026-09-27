import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { createProxyMiddleware } from "http-proxy-middleware";
import { errorHandler, notFoundHandler, requestContextMiddleware, telegramUserAuth } from "./middleware";
import assetsRouter from "./routes/assets";
import depositsRouter from "./routes/deposits";
import meRouter from "./routes/me";
import { createHealthRouter } from "./routes/health";
import paymentsRouter from "./routes/payments";
import portfolioRouter from "./routes/portfolio";
import rulesRouter from "./routes/rules";
import telegramRouter from "./routes/telegram";
import tradesRouter from "./routes/trades";
import usersRouter from "./routes/users";

interface CreateAppOptions {
  isReady: () => boolean;
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  const apiVersion = `/api/v${env.API_VERSION}`;

  app.use(requestContextMiddleware);
  // helmet only guards the API: its CSP and frame headers would break the proxied web app inside Telegram.
  app.use(apiVersion, helmet());
  app.use(cors());
  app.use(express.json());
  app.use(apiVersion, telegramUserAuth);

  app.use(apiVersion, createHealthRouter(options.isReady));
  app.use(`${apiVersion}/me`, meRouter);
  app.use(`${apiVersion}/users`, usersRouter);
  app.use(`${apiVersion}/rules`, rulesRouter);
  app.use(`${apiVersion}/assets`, assetsRouter);
  app.use(`${apiVersion}/deposits`, depositsRouter);
  app.use(`${apiVersion}/payments`, paymentsRouter);
  app.use(`${apiVersion}/portfolio`, portfolioRouter);
  app.use(`${apiVersion}/telegram`, telegramRouter);
  app.use(`${apiVersion}/trades`, tradesRouter);

  // Everything outside the API is the web app, so one public domain serves both.
  const webProxy = createProxyMiddleware({
    target: env.WEB_UPSTREAM_URL,
    changeOrigin: true,
    ws: true,
    pathFilter: (path) => !path.startsWith(apiVersion),
    on: {
      error: (_error, _req, res) => {
        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain" });
          res.end("The usetenth web app is not running.");
        }
      },
    },
  });
  app.locals.webProxy = webProxy;
  app.use(webProxy);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
