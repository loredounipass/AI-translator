-- ============================================
-- Feedback table for user-submitted feedback
-- ============================================

CREATE TABLE IF NOT EXISTS feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
    ON feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users can read their own feedback"
    ON feedback
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Only admins can see all feedback (optional)
CREATE POLICY "Admins can read all feedback"
    ON feedback
    FOR SELECT
    TO service_role
    USING (true);

-- Create an index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
