-- 002_subscriptions.sql
-- 토스페이먼츠 정기결제(구독) 관리

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  plan TEXT NOT NULL DEFAULT 'starter',        -- 'starter' | 'pro' | 'enterprise'
  amount INTEGER NOT NULL,                     -- 월 결제 금액 (원)

  -- 토스 빌링키 정보
  billing_key TEXT NOT NULL,                   -- 토스가 발급, 정기결제 시 사용
  customer_key TEXT NOT NULL,                  -- 우리가 생성, user_id 기반
  card_company TEXT,                           -- 표시용 (예: '신한카드')
  card_number_masked TEXT,                     -- '1234-****-****-5678'

  -- 상태
  status TEXT NOT NULL DEFAULT 'active',       -- 'active' | 'paused' | 'canceled' | 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,                 -- 다음 결제 예정일
  last_billed_at TIMESTAMPTZ,                  -- 마지막 성공 결제일

  -- 관리
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)                              -- 사용자당 1개의 활성 구독
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_next_billing
  ON subscriptions(status, next_billing_at)
  WHERE status = 'active';

-- 결제 이력 (정기결제 시도마다 1개 row)
CREATE TABLE IF NOT EXISTS billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  amount INTEGER NOT NULL,
  status TEXT NOT NULL,                        -- 'success' | 'failed' | 'canceled'
  payment_key TEXT,                            -- 토스 paymentKey
  order_id TEXT,                               -- 우리 측 주문 ID
  failure_code TEXT,
  failure_message TEXT,
  raw_response JSONB,                          -- 토스 응답 원문 (디버깅용)

  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_logs_user_attempted
  ON billing_logs(user_id, attempted_at DESC);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own subscription"
  ON subscriptions FOR SELECT USING ( auth.uid() = user_id );

CREATE POLICY "users can view own billing logs"
  ON billing_logs FOR SELECT USING ( auth.uid() = user_id );

-- 트리거: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
