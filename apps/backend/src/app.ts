import express from "express";
import { errorMiddleware } from "./middlewares/error.middleware";
import { healthRouter } from "./routes/health.route";

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.use("/health", healthRouter);

  app.use(errorMiddleware);

  return app;
};
