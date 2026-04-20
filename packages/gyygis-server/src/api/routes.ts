import { Router } from "express";

export const routesRouter = Router();

/**
 * GET /api/get-async-routes
 * pure-admin-thin 默认的动态路由接口形状：{ success, data: [] }
 *
 * 当前项目先返回空数组：仅使用前端静态路由/菜单即可完成登录后的基本访问。
 */
routesRouter.get("/", (_req, res) => {
  res.json({ success: true, data: [] });
});

