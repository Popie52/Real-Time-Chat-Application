import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware";
import { healthRouter } from "./routes/health.route";
import { authRouter } from "./routes/auth.route";
import cookieParser from "cookie-parser";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  
  app.use(cookieParser());
  app.use("/auth", authRouter);

  app.use("/health", healthRouter);

  app.use(errorMiddleware);

  return app;
};
