-- 超级管理员 is_super_admin、删除审计表（已有 init/ensureAuthColumns 时可跳过）
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT FALSE;

UPDATE auth.users SET is_super_admin = TRUE, is_admin = TRUE WHERE username = 'admin';
UPDATE auth.users SET is_super_admin = FALSE WHERE username <> 'admin';

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_one_super_admin
  ON auth.users ((1))
  WHERE is_super_admin;

CREATE TABLE IF NOT EXISTS auth.user_delete_audit (
  id                 BIGSERIAL PRIMARY KEY,
  target_user_id     BIGINT NOT NULL,
  target_username    TEXT NOT NULL,
  actor_user_id      BIGINT NOT NULL,
  actor_username     TEXT NOT NULL,
  tenant_schema      TEXT,
  tenant_workspace   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
