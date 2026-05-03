import { $t } from "@/plugins/i18n";

export default {
  path: "/system/user",
  redirect: "/system/user/index",
  meta: {
    icon: "ep:user",
    title: $t("menus.pureUserManage"),
    rank: 3
  },
  children: [
    {
      path: "/system/user/index",
      name: "SystemUser",
      component: () => import("@/views/system/user/index.vue"),
      meta: {
        title: $t("menus.pureUserManage"),
        roles: ["admin"]
      }
    }
  ]
} satisfies RouteConfigsTable;
