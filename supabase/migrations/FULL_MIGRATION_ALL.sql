-- ============================================================
-- MIGRATION COMPLETA - Hub Disparos (V1 + V2 + V3 + V4)
-- Seguro para rodar do zero ou re-rodar
-- Cole TUDO no Supabase SQL Editor e execute
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- V1: Tabelas base
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disparo_clients (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email VARCHAR(320),
  phone VARCHAR(30),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'encerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_packages (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES disparo_clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contracted_messages INT NOT NULL,
  price_per_message NUMERIC(10,4) NOT NULL,
  platform_cost_per_message NUMERIC(10,4) NOT NULL DEFAULT 0.2000,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  refunded_messages INT NOT NULL DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_dispatches (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES disparo_packages(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES disparo_clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dispatch_date TIMESTAMPTZ NOT NULL,
  sent_messages INT NOT NULL,
  delivered_messages INT NOT NULL,
  redirection_cost NUMERIC(10,2),
  notes TEXT,
  contact_file_url TEXT,
  contact_file_name VARCHAR(500),
  contact_count INT,
  redirect_numbers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_results (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id BIGINT NOT NULL UNIQUE REFERENCES disparo_dispatches(id) ON DELETE CASCADE,
  leads_count INT,
  sales_count INT,
  revenue NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disparo_dispatch_contacts (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id BIGINT NOT NULL REFERENCES disparo_dispatches(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_disparo_dispatch_contacts_dispatch ON disparo_dispatch_contacts(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disparo_packages_client ON disparo_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_package ON disparo_dispatches(package_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_client ON disparo_dispatches(client_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_date ON disparo_dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_disparo_results_dispatch ON disparo_results(dispatch_id);

-- RLS
ALTER TABLE disparo_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_dispatch_contacts ENABLE ROW LEVEL SECURITY;

-- Policies (com protecao contra duplicata)
DO $$
BEGIN
  BEGIN CREATE POLICY "Authenticated users can manage disparo_clients" ON disparo_clients FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can manage disparo_packages" ON disparo_packages FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can manage disparo_dispatches" ON disparo_dispatches FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can manage disparo_results" ON disparo_results FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can manage disparo_dispatch_contacts" ON disparo_dispatch_contacts FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  BEGIN CREATE TRIGGER update_disparo_clients_updated_at BEFORE UPDATE ON disparo_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TRIGGER update_disparo_packages_updated_at BEFORE UPDATE ON disparo_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TRIGGER update_disparo_dispatches_updated_at BEFORE UPDATE ON disparo_dispatches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TRIGGER update_disparo_results_updated_at BEFORE UPDATE ON disparo_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('disparo-files', 'disparo-files', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  BEGIN CREATE POLICY "Authenticated users can upload disparo files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'disparo-files' AND auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can read disparo files" ON storage.objects FOR SELECT USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Authenticated users can delete disparo files" ON storage.objects FOR DELETE USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- V2: Metricas de funil, logs de atividade, segmentacao, anon
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS read_messages INT DEFAULT 0;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS replied_messages INT DEFAULT 0;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS clicked_messages INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS disparo_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_email VARCHAR(320) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  entity_name VARCHAR(255),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_activity_logs_entity ON disparo_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_disparo_activity_logs_created ON disparo_activity_logs(created_at DESC);

ALTER TABLE disparo_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN CREATE POLICY "Authenticated users can manage disparo_activity_logs" ON disparo_activity_logs FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS segment VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_disparo_clients_segment ON disparo_clients(segment);

-- Policies anon para /acompanhamento
DO $$
BEGIN
  BEGIN CREATE POLICY "Anon users can read disparo_clients" ON disparo_clients FOR SELECT USING (auth.role() = 'anon'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Anon users can read disparo_packages" ON disparo_packages FOR SELECT USING (auth.role() = 'anon'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Anon users can read disparo_dispatches" ON disparo_dispatches FOR SELECT USING (auth.role() = 'anon'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Anon users can read disparo_results" ON disparo_results FOR SELECT USING (auth.role() = 'anon'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- V3: purchase_date nos pacotes
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE disparo_packages ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
-- V4: Estorno a nivel de cliente + Custo de redirecionamento
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS has_redirection_cost BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS redirection_cost_per_message NUMERIC(10,4) DEFAULT 0;

CREATE TABLE IF NOT EXISTS disparo_client_refunds (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES disparo_clients(id) ON DELETE CASCADE,
  refunded_messages INT NOT NULL,
  price_per_message NUMERIC(10,4) NOT NULL,
  platform_cost_per_message NUMERIC(10,4) NOT NULL DEFAULT 0.2000,
  refund_gross NUMERIC(12,2) NOT NULL,
  refund_company NUMERIC(12,2) NOT NULL,
  refund_partner NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disparo_client_refunds_client ON disparo_client_refunds(client_id);

ALTER TABLE disparo_client_refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN CREATE POLICY "Authenticated users can manage disparo_client_refunds" ON disparo_client_refunds FOR ALL USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE POLICY "Anon users can read disparo_client_refunds" ON disparo_client_refunds FOR SELECT USING (auth.role() = 'anon'); EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- FIM - Todas as migrations aplicadas com sucesso
-- ═══════════════════════════════════════════════════════════════
