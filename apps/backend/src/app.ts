import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware";
import { healthRouter } from "./routes/health.route";
import { authRouter } from "./routes/auth.route";
import cookieParser from "cookie-parser";
import { messageRouter } from "./routes/message.route";
import { metricsRouter } from "./routes/metric.route";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  
  app.use(cookieParser());
  app.use("/auth", authRouter);
  app.use(messageRouter);
  app.use(metricsRouter);
  app.use("/health", healthRouter);

  app.use(errorMiddleware);

  return app;
};
