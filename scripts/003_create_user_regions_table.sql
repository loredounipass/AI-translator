CREATE TABLE public.user_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    base_lang TEXT NOT NULL,
    region_code TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, base_lang)
);

ALTER TABLE public.user_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own regions"
    ON public.user_regions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own regions"
    ON public.user_regions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own regions"
    ON public.user_regions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own regions"
    ON public.user_regions FOR DELETE
    USING (auth.uid() = user_id);
