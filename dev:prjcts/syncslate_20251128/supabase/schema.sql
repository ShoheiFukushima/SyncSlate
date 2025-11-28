-- SyncSlate Database Schema
-- Supabase Realtime を使用したクロスデバイス同期

-- ============================================================
-- Tables
-- ============================================================

-- セッションテーブル
CREATE TABLE IF NOT EXISTS sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  smart_cues JSONB NOT NULL DEFAULT '[]'::jsonb,
  color_ranges JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_sync_sessions_host_id ON sync_sessions(host_id);
CREATE INDEX idx_sync_sessions_updated_at ON sync_sessions(updated_at DESC);

-- デバイステーブル
CREATE TABLE IF NOT EXISTS sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sync_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('HOST', 'CLIENT')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_devices_session_id ON sync_devices(session_id);
CREATE INDEX idx_sync_devices_device_id ON sync_devices(device_id);
CREATE INDEX idx_sync_devices_last_seen ON sync_devices(last_seen DESC);

-- 同期イベントテーブル
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sync_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CMD_START', 'CMD_STOP', 'SYNC_STATE')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_events_session_id ON sync_events(session_id, created_at DESC);
CREATE INDEX idx_sync_events_type ON sync_events(event_type);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- セッションテーブル
ALTER TABLE sync_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on sync_sessions"
  ON sync_sessions FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on sync_sessions"
  ON sync_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on sync_sessions"
  ON sync_sessions FOR UPDATE
  USING (true);

-- デバイステーブル
ALTER TABLE sync_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on sync_devices"
  ON sync_devices FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on sync_devices"
  ON sync_devices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on sync_devices"
  ON sync_devices FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on sync_devices"
  ON sync_devices FOR DELETE
  USING (true);

-- 同期イベントテーブル
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on sync_events"
  ON sync_events FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on sync_events"
  ON sync_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- updated_at 自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- sync_sessions の updated_at 自動更新トリガー
CREATE TRIGGER update_sync_sessions_updated_at
  BEFORE UPDATE ON sync_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 古いセッション削除関数（24時間以上前）
CREATE OR REPLACE FUNCTION delete_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_sessions
  WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 古いデバイス削除関数（30分以上アクティビティなし）
CREATE OR REPLACE FUNCTION delete_inactive_devices()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_devices
  WHERE last_seen < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Realtime Publication
-- ============================================================

-- Realtime を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE sync_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_events;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE sync_sessions IS 'SyncSlate synchronization sessions';
COMMENT ON TABLE sync_devices IS 'Devices connected to sessions';
COMMENT ON TABLE sync_events IS 'Synchronization events for real-time coordination';

COMMENT ON COLUMN sync_sessions.settings IS 'Session settings (JSON)';
COMMENT ON COLUMN sync_sessions.smart_cues IS 'Smart cues configuration (JSON array)';
COMMENT ON COLUMN sync_sessions.color_ranges IS 'Color ranges configuration (JSON array)';

COMMENT ON COLUMN sync_devices.device_id IS 'Client-generated device identifier';
COMMENT ON COLUMN sync_devices.role IS 'Device role: HOST or CLIENT';
COMMENT ON COLUMN sync_devices.last_seen IS 'Last heartbeat timestamp';

COMMENT ON COLUMN sync_events.event_type IS 'Event type: CMD_START, CMD_STOP, or SYNC_STATE';
COMMENT ON COLUMN sync_events.payload IS 'Event payload (JSON)';
COMMENT ON COLUMN sync_events.server_timestamp IS 'Server-recorded timestamp for precision sync';
