import { $t } from "@/plugins/i18n";

export default {
  path: "/function",
  redirect: "/function/index",
  meta: {
    icon: "ep/operation",
    title: $t("menus.pureFunction"),
    rank: 2
  },
  children: [
    {
      path: "/function/index",
      name: "FunctionIndex",
      component: () => import("@/views/function/index.vue"),
      meta: {
        title: $t("menus.pureFunction")
      }
    }
  ]
} satisfies RouteConfigsTable;