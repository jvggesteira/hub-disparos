-- ============================================================
-- Tabelas do módulo "Gestão de Disparos" (WhatsApp)
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Clientes de Disparo
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

-- 2. Pacotes de Disparo
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

-- 3. Disparos individuais
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
  -- Planilha Excel de contatos enviada pelo cliente
  contact_file_url TEXT,
  contact_file_name VARCHAR(500),
  -- Quantidade de contatos na base recebida
  contact_count INT,
  -- Lista de números para redirecionamento (JSON array)
  redirect_numbers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Resultados de conversão por disparo
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

-- 5. Tabela de contatos por disparo (números de redirecionamento)
CREATE TABLE IF NOT EXISTS disparo_dispatch_contacts (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id BIGINT NOT NULL REFERENCES disparo_dispatches(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_disparo_dispatch_contacts_dispatch ON disparo_dispatch_contacts(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disparo_packages_client ON disparo_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_package ON disparo_dispatches(package_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_client ON disparo_dispatches(client_id);
CREATE INDEX IF NOT EXISTS idx_disparo_dispatches_date ON disparo_dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_disparo_results_dispatch ON disparo_results(dispatch_id);

-- RLS (Row Level Security) - Habilitar para segurança
ALTER TABLE disparo_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE disparo_results ENABLE ROW LEVEL SECURITY;

-- Policies: permitir acesso para usuários autenticados
CREATE POLICY "Authenticated users can manage disparo_clients" ON disparo_clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage disparo_packages" ON disparo_packages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage disparo_dispatches" ON disparo_dispatches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage disparo_results" ON disparo_results FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_disparo_clients_updated_at BEFORE UPDATE ON disparo_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disparo_packages_updated_at BEFORE UPDATE ON disparo_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disparo_dispatches_updated_at BEFORE UPDATE ON disparo_dispatches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disparo_results_updated_at BEFORE UPDATE ON disparo_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS para tabela de contatos
ALTER TABLE disparo_dispatch_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage disparo_dispatch_contacts" ON disparo_dispatch_contacts FOR ALL USING (auth.role() = 'authenticated');

-- Storage bucket para planilhas de contatos
INSERT INTO storage.buckets (id, name, public) VALUES ('disparo-files', 'disparo-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload disparo files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read disparo files" ON storage.objects
  FOR SELECT USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete disparo files" ON storage.objects
  FOR DELETE USING (bucket_id = 'disparo-files' AND auth.role() = 'authenticated');
