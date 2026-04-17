import { Router } from "express";
import { healthRouter } from "./health.js";
import { tiandituRouter } from "./tianditu.js";
import { ossRouter } from "./oss.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tianditu", tiandituRouter);
apiRouter.use("/oss", ossRouter);
