-- ============================================================
-- Melhorias V2: métricas de funil, logs de atividade,
-- segmentação de clientes e policies anon para /acompanhamento
-- Rodar no Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Novas colunas em disparo_dispatches (métricas funil)
-- -------------------------------------------------------
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS read_messages INT DEFAULT 0;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS replied_messages INT DEFAULT 0;
ALTER TABLE disparo_dispatches ADD COLUMN IF NOT EXISTS clicked_messages INT DEFAULT 0;

-- -------------------------------------------------------
-- 2. Nova tabela: disparo_activity_logs (audit trail)
-- -------------------------------------------------------
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

-- Índices para disparo_activity_logs
CREATE INDEX IF NOT EXISTS idx_disparo_activity_logs_entity ON disparo_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_disparo_activity_logs_created ON disparo_activity_logs(created_at DESC);

-- RLS para disparo_activity_logs
ALTER TABLE disparo_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    CREATE POLICY "Authenticated users can manage disparo_activity_logs"
      ON disparo_activity_logs FOR ALL
      USING (auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- -------------------------------------------------------
-- 3. Nova coluna em disparo_clients (segmentação)
-- -------------------------------------------------------
ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS segment VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_disparo_clients_segment ON disparo_clients(segment);

-- -------------------------------------------------------
-- 4. Policies anon (SELECT) para rota /acompanhamento
-- -------------------------------------------------------
DO $$
BEGIN
  BEGIN
    CREATE POLICY "Anon users can read disparo_clients"
      ON disparo_clients FOR SELECT
      USING (auth.role() = 'anon');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Anon users can read disparo_packages"
      ON disparo_packages FOR SELECT
      USING (auth.role() = 'anon');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Anon users can read disparo_dispatches"
      ON disparo_dispatches FOR SELECT
      USING (auth.role() = 'anon');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Anon users can read disparo_results"
      ON disparo_results FOR SELECT
      USING (auth.role() = 'anon');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
