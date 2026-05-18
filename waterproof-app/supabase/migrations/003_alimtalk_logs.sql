-- 003_alimtalk_logs.sql
-- 카카오 알림톡 발송 이력 + 사용자별 발송 제어

-- 알림톡 발송 이력
CREATE TABLE IF NOT EXISTS alimtalk_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  template_code TEXT NOT NULL,                 -- 알림톡 템플릿 코드 (예: 'BID_ALERT_V1')
  phone TEXT NOT NULL,                         -- 수신 전화번호
  message TEXT NOT NULL,                       -- 발송 본문 (변수 치환 후)

  status TEXT NOT NULL,                        -- 'success' | 'failed' | 'queued'
  provider TEXT DEFAULT 'aligo',               -- 'aligo' | 'nhn' | 'lunasoft' 등
  provider_msg_id TEXT,                        -- 솔루션사 메시지 ID
  failure_code TEXT,
  failure_message TEXT,

  -- 관련 엔티티 (선택)
  bid_id UUID REFERENCES bid_announcements(id) ON DELETE SET NULL,
  complex_id UUID REFERENCES complexes(id) ON DELETE SET NULL,

  raw_response JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_user_sent
  ON alimtalk_logs(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_bid
  ON alimtalk_logs(bid_id) WHERE bid_id IS NOT NULL;

-- 사용자 알림 설정
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_bids BOOLEAN DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_score_rise BOOLEAN DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_quiet_hours_start INTEGER DEFAULT 22;  -- 22시
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_quiet_hours_end INTEGER DEFAULT 8;    -- 08시

-- RLS
ALTER TABLE alimtalk_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own alimtalk logs"
  ON alimtalk_logs FOR SELECT USING ( auth.uid() = user_id );
