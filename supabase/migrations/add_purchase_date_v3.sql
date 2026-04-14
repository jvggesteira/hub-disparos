-- ============================================================
-- V3: Adiciona purchase_date nos pacotes + fix timezone retroativo
-- ============================================================

-- 1. Adicionar coluna purchase_date na tabela de pacotes
ALTER TABLE disparo_packages ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ;

-- 2. Preencher retroativamente com created_at (ajustado para meio-dia para evitar problemas de fuso)
UPDATE disparo_packages
SET purchase_date = date_trunc('day', created_at) + INTERVAL '12 hours'
WHERE purchase_date IS NULL;

-- 3. Corrigir dispatch_dates existentes que estão em meia-noite UTC
-- Move para 12:00 para evitar deslocamento de dia no fuso Brasil
UPDATE disparo_dispatches
SET dispatch_date = date_trunc('day', dispatch_date) + INTERVAL '12 hours'
WHERE EXTRACT(HOUR FROM dispatch_date) = 0
  AND EXTRACT(MINUTE FROM dispatch_date) = 0;
