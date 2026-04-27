-- ============================================================
-- V4: Estorno a nivel de cliente + Custo de redirecionamento
-- ============================================================

-- 1. Novas colunas em disparo_clients: controle de redirecionamento
ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS has_redirection_cost BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE disparo_clients ADD COLUMN IF NOT EXISTS redirection_cost_per_message NUMERIC(10,4) DEFAULT 0;

-- 2. Tabela de estornos a nivel de cliente
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

-- RLS
ALTER TABLE disparo_client_refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    CREATE POLICY "Authenticated users can manage disparo_client_refunds"
      ON disparo_client_refunds FOR ALL
      USING (auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Anon users can read disparo_client_refunds"
      ON disparo_client_refunds FOR SELECT
      USING (auth.role() = 'anon');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
