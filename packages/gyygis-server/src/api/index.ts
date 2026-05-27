import { Router } from "express";
import { healthRouter } from "./health.js";
import { tiandituRouter } from "./tianditu.js";
import { ossRouter } from "./oss.js";
import { mapsRouter } from "./maps.js";
import { authRouter } from "./auth.js";
import { routesRouter } from "./routes.js";
import { userLayoutsRouter } from "./userLayouts.js";
import { webMapServicesRouter } from "./webMapServices.js";
import { adminUsersRouter } from "./adminUsers.js";
import { offlineTilesRouter } from "./offlineTiles.js";
import { mapBasemapRouter } from "./mapBasemap.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tianditu", tiandituRouter);
apiRouter.use("/oss", ossRouter);
apiRouter.use("/maps", mapsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin/users", adminUsersRouter);
apiRouter.use("/user-layouts", userLayoutsRouter);
apiRouter.use("/web-map-services", webMapServicesRouter);
apiRouter.use("/offline-tiles", offlineTilesRouter);
apiRouter.use("/map-basemap", mapBasemapRouter);
apiRouter.use("/get-async-routes", routesRouter);
