-- Create user disclaimer acceptances table
-- One row per user AND disclaimer version (disclaimer_key), so acceptances are
-- auditable ("did every user accept?") and a future disclaimer rewrite can ship
-- a new key, which re-prompts everyone exactly once.
CREATE TABLE IF NOT EXISTS public.user_disclaimer_acceptances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disclaimer_key TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, disclaimer_key)
);

-- Enable Row Level Security
ALTER TABLE public.user_disclaimer_acceptances ENABLE ROW LEVEL SECURITY;

-- Create policies (users may only read/write their own acceptance rows)
CREATE POLICY "Users can view their own disclaimer acceptances"
  ON public.user_disclaimer_acceptances
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own disclaimer acceptances"
  ON public.user_disclaimer_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own disclaimer acceptances"
  ON public.user_disclaimer_acceptances
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for the per-user lookup on app start
CREATE INDEX IF NOT EXISTS idx_user_disclaimer_acceptances_user_id
  ON public.user_disclaimer_acceptances(user_id);
