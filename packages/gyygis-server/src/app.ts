import express from "express";
import { apiRouter } from "./api/index.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter);
  return app;
}
