-- Create user_language_preferences table
CREATE TABLE IF NOT EXISTS public.user_language_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    source_lang TEXT NOT NULL DEFAULT 'en',
    target_lang TEXT NOT NULL DEFAULT 'es',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_language_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own language preferences" 
    ON public.user_language_preferences FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own language preferences" 
    ON public.user_language_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own language preferences" 
    ON public.user_language_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own language preferences" 
    ON public.user_language_preferences FOR DELETE 
    USING (auth.uid() = user_id);
