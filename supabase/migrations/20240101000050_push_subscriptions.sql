-- Migration: Web Push subscription storage for PWA push notifications
-- Stores PushSubscription objects per user so the server can send push
-- notifications for overdue reminders without requiring the app to be open.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint    text        NOT NULL,
    p256dh      text        NOT NULL,
    auth        text        NOT NULL,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
    ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage only their own subscriptions via authenticated client
CREATE POLICY "users manage own push subscriptions"
    ON push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE push_subscriptions IS
    'Web Push PushSubscription objects; one row per browser/device per user.';
