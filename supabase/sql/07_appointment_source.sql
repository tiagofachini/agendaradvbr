-- Origem do agendamento: MANUAL (advogado) ou SCHEDULER (cliente final)
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';
