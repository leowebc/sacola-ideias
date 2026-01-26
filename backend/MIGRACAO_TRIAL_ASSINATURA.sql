-- Adiciona controle de trial (3 dias) na tabela assinaturas
ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT now();

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS trial_expira_em TIMESTAMPTZ;

-- Preenche trial para assinaturas free existentes (3 dias a partir do criado_em)
UPDATE assinaturas
SET trial_expira_em = criado_em + interval '3 days'
WHERE plano = 'free'
  AND trial_expira_em IS NULL;