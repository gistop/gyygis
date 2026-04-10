import { Router } from "express";
import { healthRouter } from "./health.js";
import { tiandituRouter } from "./tianditu.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tianditu", tiandituRouter);
