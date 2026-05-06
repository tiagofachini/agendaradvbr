-- ─── 1. Coluna auth_id na tabela Lawyer ─────────────────────────────────────
ALTER TABLE "Lawyer"
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── 2. RLS em todas as tabelas ──────────────────────────────────────────────
ALTER TABLE "Lawyer"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawyerSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"        ENABLE ROW LEVEL SECURITY;

-- ─── 3. Helper: retorna o id do Lawyer autenticado ───────────────────────────
CREATE OR REPLACE FUNCTION get_lawyer_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM "Lawyer" WHERE auth_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_lawyer_id() TO authenticated;

-- ─── 4. Policies ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS lawyer_own        ON "Lawyer";
DROP POLICY IF EXISTS settings_own      ON "LawyerSettings";
DROP POLICY IF EXISTS clients_own       ON "Client";
DROP POLICY IF EXISTS appointments_own  ON "Appointment";
DROP POLICY IF EXISTS payments_own      ON "Payment";

CREATE POLICY lawyer_own       ON "Lawyer"         FOR ALL TO authenticated USING (auth_id = auth.uid());
CREATE POLICY settings_own     ON "LawyerSettings" FOR ALL TO authenticated USING ("lawyerId" = get_lawyer_id());
CREATE POLICY clients_own      ON "Client"         FOR ALL TO authenticated USING ("lawyerId" = get_lawyer_id());
CREATE POLICY appointments_own ON "Appointment"    FOR ALL TO authenticated USING ("lawyerId" = get_lawyer_id());
CREATE POLICY payments_own     ON "Payment"        FOR ALL TO authenticated USING ("lawyerId" = get_lawyer_id());

-- ─── 5. Trigger: cria Lawyer + LawyerSettings após signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_lawyer_id TEXT;
BEGIN
  new_lawyer_id := gen_random_uuid()::text;

  INSERT INTO "Lawyer" (id, auth_id, name, email, whatsapp)
  VALUES (
    new_lawyer_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp'
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    name  = EXCLUDED.name,
    email = EXCLUDED.email
  RETURNING id INTO new_lawyer_id;

  INSERT INTO "LawyerSettings" (id, "lawyerId", "workDays")
  VALUES (gen_random_uuid()::text, new_lawyer_id, ARRAY[1,2,3,4,5])
  ON CONFLICT ("lawyerId") DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
