<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { ref, reactive, toRaw } from "vue";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useEventListener } from "@vueuse/core";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { bg, avatar, illustration } from "./utils/static";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";

defineOptions({
  name: "Login"
});

const router = useRouter();
const loading = ref(false);
const disabled = ref(false);
const ruleFormRef = ref<FormInstance>();
/** 登录 / 注册 页签（注册仅为占位展示，无业务逻辑） */
const activeTab = ref<"login" | "register">("login");

const { initStorage } = useLayout();
initStorage();

const { t } = useI18n();
const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn } = useTranslationLang();

const ruleForm = reactive({
  username: "admin",
  password: "admin123"
});

/** 注册表单占位数据，仅用于界面展示 */
const registerForm = reactive({
  username: "",
  password: "",
  confirmPassword: ""
});

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: ruleForm.password
        })
        .then(res => {
          if (res.success) {
            // 获取后端路由
            return initRouter().then(() => {
              disabled.value = true;
              router
                .push(getTopMenu(true).path)
                .then(() => {
                  message(t("login.pureLoginSuccess"), { type: "success" });
                })
                .finally(() => (disabled.value = false));
            });
          } else {
            message(t("login.pureLoginFail"), { type: "error" });
          }
        })
        .finally(() => (loading.value = false));
    }
  });
};

const immediateDebounce: any = debounce(
  formRef => onLogin(formRef),
  1000,
  true
);

useEventListener(document, "keydown", ({ code }) => {
  if (
    activeTab.value === "login" &&
    ["Enter", "NumpadEnter"].includes(code) &&
    !disabled.value &&
    !loading.value
  )
    immediateDebounce(ruleFormRef.value);
});
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
      <!-- 国际化 -->
      <el-dropdown trigger="click">
        <globalization
          class="hover:text-primary hover:bg-[transparent]! w-[20px] h-[20px] ml-1.5 cursor-pointer outline-hidden duration-300"
        />
        <template #dropdown>
          <el-dropdown-menu class="translation">
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'zh')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
              @click="translationCh"
            >
              <IconifyIconOffline
                v-show="locale === 'zh'"
                class="check-zh"
                :icon="Check"
              />
              简体中文
            </el-dropdown-item>
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'en')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
              @click="translationEn"
            >
              <span v-show="locale === 'en'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              English
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="login-container">
      <div class="img">
        <component :is="toRaw(illustration)" />
      </div>
      <div class="login-box">
        <div class="login-form">
          <avatar class="avatar" />
          <Motion>
            <h2 class="outline-hidden">{{ title }}</h2>
          </Motion>

          <el-tabs v-model="activeTab" class="login-tabs" stretch>
            <el-tab-pane :label="t('login.pureLogin')" name="login">
              <el-form
                ref="ruleFormRef"
                :model="ruleForm"
                :rules="loginRules"
                size="large"
              >
                <Motion :delay="100">
                  <el-form-item
                    :rules="[
                      {
                        required: true,
                        message: transformI18n($t('login.pureUsernameReg')),
                        trigger: 'blur'
                      }
                    ]"
                    prop="username"
                  >
                    <el-input
                      v-model="ruleForm.username"
                      clearable
                      :placeholder="t('login.pureUsername')"
                      :prefix-icon="useRenderIcon(User)"
                    />
                  </el-form-item>
                </Motion>

                <Motion :delay="150">
                  <el-form-item prop="password">
                    <el-input
                      v-model="ruleForm.password"
                      clearable
                      show-password
                      :placeholder="t('login.purePassword')"
                      :prefix-icon="useRenderIcon(Lock)"
                    />
                  </el-form-item>
                </Motion>

                <Motion :delay="250">
                  <el-button
                    class="w-full mt-4!"
                    size="default"
                    type="primary"
                    :loading="loading"
                    :disabled="disabled"
                    @click="onLogin(ruleFormRef)"
                  >
                    {{ t("login.pureLogin") }}
                  </el-button>
                </Motion>
              </el-form>
            </el-tab-pane>

            <el-tab-pane :label="t('login.pureRegisterTab')" name="register">
              <el-form :model="registerForm" size="large" class="register-form">
                <Motion :delay="100">
                  <el-form-item>
                    <el-input
                      v-model="registerForm.username"
                      clearable
                      :placeholder="t('login.pureUsername')"
                      :prefix-icon="useRenderIcon(User)"
                    />
                  </el-form-item>
                </Motion>
                <Motion :delay="150">
                  <el-form-item>
                    <el-input
                      v-model="registerForm.password"
                      clearable
                      show-password
                      :placeholder="t('login.purePassword')"
                      :prefix-icon="useRenderIcon(Lock)"
                    />
                  </el-form-item>
                </Motion>
                <Motion :delay="200">
                  <el-form-item>
                    <el-input
                      v-model="registerForm.confirmPassword"
                      clearable
                      show-password
                      :placeholder="t('login.pureConfirmPassword')"
                      :prefix-icon="useRenderIcon(Lock)"
                    />
                  </el-form-item>
                </Motion>
                <Motion :delay="250">
                  <el-button
                    class="w-full mt-4!"
                    size="default"
                    type="primary"
                    native-type="button"
                  >
                    {{ t("login.pureRegister") }}
                  </el-button>
                  <p class="register-tip">{{ t("login.pureRegisterTip") }}</p>
                </Motion>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
.login-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 18px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
  }

  :deep(.el-tabs__item) {
    flex: 1;
    padding: 0 12px;
    font-size: 15px;
  }

  :deep(.el-tabs__nav) {
    width: 100%;
  }

  :deep(.el-tabs__active-bar) {
    transition: transform 0.25s ease;
  }
}

.register-form {
  text-align: left;
}

.register-tip {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.translation {
  ::v-deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
