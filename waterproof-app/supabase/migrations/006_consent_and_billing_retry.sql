-- 006_consent_and_billing_retry.sql
--
-- 목적:
--   (A) 회원가입 시 필수/선택 동의 시각을 영구 기록 (정보통신망법 §50, 개보법 §22 대응)
--   (B) 결제 실패 1회 즉시 락아웃을 막기 위해 재시도 카운터/시각 컬럼 추가
--   (C) Toss 영수증/세금계산서 URL 보관 (사용자에게 다운로드 제공)
--   (D) 환불 사유/취소 사유 보관
--
-- 안전성: 모두 ADD COLUMN IF NOT EXISTS — 기존 행에는 NULL 들어감.
--         기존 동작에 영향 없음 (회원가입 검증 강화는 애플리케이션 레이어에서 처리).

-- =============================================
-- (A) user_profiles — 동의 시각
-- =============================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS terms_agreed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS age14_confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent_at    TIMESTAMPTZ,  -- 광고성 정보 수신 동의 (전체)
  ADD COLUMN IF NOT EXISTS marketing_channels      TEXT[],       -- ['email','sms','kakao'] 등
  ADD COLUMN IF NOT EXISTS night_marketing_consent_at TIMESTAMPTZ, -- 21–08시 야간 광고 동의
  ADD COLUMN IF NOT EXISTS terms_version           TEXT,         -- 동의 시점의 약관 버전 (예: '2026-05-19')
  ADD COLUMN IF NOT EXISTS privacy_version         TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at          TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active
  ON user_profiles(last_active_at);

-- =============================================
-- (B) subscriptions — 결제 실패 재시도
-- =============================================
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_message TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_retry
  ON subscriptions(status, retry_at)
  WHERE status = 'failed' AND retry_at IS NOT NULL;

-- =============================================
-- (C) billing_logs — 영수증 URL + 환불 사유
-- =============================================
ALTER TABLE billing_logs
  ADD COLUMN IF NOT EXISTS receipt_url   TEXT,    -- Toss receipt.url
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_amount INTEGER;  -- 부분환불 가능

-- =============================================
-- (D) 동의 변경 감사 로그 (선택사항이나 분쟁 대응 가치)
-- =============================================
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,    -- 'terms' | 'privacy' | 'marketing' | 'night_marketing' | 'age14'
  action TEXT NOT NULL CHECK (action IN ('agree', 'withdraw')),
  version TEXT,                  -- 약관 버전 (해당 시)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_user_type
  ON consent_logs(user_id, consent_type, created_at DESC);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own consent logs" ON consent_logs;
CREATE POLICY "users can view own consent logs"
  ON consent_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 쓰기는 서버(service_role)만 — 클라이언트 위변조 방지
