
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS layer4 jsonb,
  ADD COLUMN IF NOT EXISTS risk_score numeric,
  ADD COLUMN IF NOT EXISTS boxes jsonb,
  ADD COLUMN IF NOT EXISTS news jsonb;
