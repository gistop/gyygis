import { Router } from "express";
import { healthRouter } from "./health.js";
import { tiandituRouter } from "./tianditu.js";
import { ossRouter } from "./oss.js";
import { mapsRouter } from "./maps.js";
import { authRouter } from "./auth.js";
import { routesRouter } from "./routes.js";
import { userLayoutsRouter } from "./userLayouts.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tianditu", tiandituRouter);
apiRouter.use("/oss", ossRouter);
apiRouter.use("/maps", mapsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/user-layouts", userLayoutsRouter);
apiRouter.use("/get-async-routes", routesRouter);
