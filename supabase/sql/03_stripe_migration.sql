-- ─── Stripe Connect fields on Lawyer ─────────────────────────────────────────
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "stripeAccountId"          TEXT;
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled"     BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Stripe fields on Payment ─────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeId"          TEXT UNIQUE;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "platformFeeCents"  INTEGER;

CREATE INDEX IF NOT EXISTS "Payment_stripeId_idx" ON "Payment"("stripeId");
