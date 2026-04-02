-- ============================================================
-- Adicionar campos de planilha Excel e lista de contatos
-- aos disparos individuais (disparo_dispatches)
-- Rodar no Supabase SQL Editor
-- ============================================================

-- Novos campos na tabela disparo_dispatches
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS contact_file_url TEXT;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS contact_file_name VARCHAR(500);
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS contact_count INT;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS redirect_numbers JSONB DEFAULT '[]'::jsonb;

-- Tabela de contatos por disparo (números de redirecionamento detalhados)
CREATE TABLE IF NOT EXISTS disparo_dispatch_contacts (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id BIGINT NOT NULL REFERENCES disparo_dispatches(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_dispatch_contacts_dispatch ON disparo_dispatch_contacts(dispatch_id);

-- RLS
ALTER TABLE disparo_dispatch_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage disparo_dispatch_contacts" ON disparo_dispatch_contacts FOR ALL USING (auth.role() = 'authenticated');

-- Storage bucket para planilhas de contatos
INSERT INTO storage.buckets (id, name, public) VALUES ('disparo-files', 'disparo-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage (usar DO $$ para ignorar se já existem)
DO $$
BEGIN
  BEGIN
    CREATE POLICY "Authenticated users can upload disparo files" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY "Authenticated users can read disparo files" ON storage.objects
      FOR SELECT USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE POLICY "Authenticated users can delete disparo files" ON storage.objects
      FOR DELETE USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
