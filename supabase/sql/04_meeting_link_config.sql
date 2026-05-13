-- meetingLink salvo por agendamento (imutável após criação)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;

-- URL de reunião padrão configurável pelo advogado (Google Meet, Zoom, etc.)
ALTER TABLE "LawyerSettings" ADD COLUMN IF NOT EXISTS "customMeetingUrl" TEXT;
