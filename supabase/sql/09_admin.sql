CREATE TABLE IF NOT EXISTS "AdminDeletedUser" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_id      UUID,
  email        TEXT,
  name         TEXT,
  whatsapp     TEXT,
  "createdAt"  TIMESTAMPTZ,
  "lastSignInAt" TIMESTAMPTZ,
  "deletedAt"  TIMESTAMPTZ DEFAULT NOW(),
  "deletedBy"  TEXT
);

ALTER TABLE "AdminDeletedUser" ENABLE ROW LEVEL SECURITY;
