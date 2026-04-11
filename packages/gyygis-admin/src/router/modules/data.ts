import { $t } from "@/plugins/i18n";

export default {
  path: "/data",
  redirect: "/data/index",
  meta: {
    icon: "ep/data-line",
    title: $t("menus.pureData"),
    rank: 1
  },
  children: [
    {
      path: "/data/index",
      name: "DataIndex",
      component: () => import("@/views/data/index.vue"),
      meta: {
        title: $t("menus.pureData")
      }
    }
  ]
} satisfies RouteConfigsTable;