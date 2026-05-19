-- 005_sales_tracking.sql
--
-- 목적: 사용자별 "관심단지 영업 추적" 별도 관리.
--       단지 다중 선택(localStorage, CSV 다운로드용)과는 별개의 영구 데이터.
--       각 방수업체가 자신의 영업 파이프라인(관심→연락→미팅→제안→수주/실패)을
--       단지 단위로 기록.
--
-- 설계 원칙:
--   - (user_id, complex_id) UNIQUE → 같은 단지는 1행만
--   - 토글 추가/제거는 INSERT/DELETE 로 단순화
--   - 상태/메모/일정 업데이트는 같은 행을 UPDATE
--   - RLS: 본인 행만 모든 작업
--
-- 상태 enum 은 TEXT + CHECK 로 관리 (Postgres enum 은 마이그레이션 시 변경이 까다로움)

CREATE TABLE IF NOT EXISTS sales_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,

  -- 영업 단계
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'contacted', 'meeting', 'proposed', 'won', 'lost', 'on_hold')),

  -- 우선순위
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('high', 'normal', 'low')),

  -- 영업 활동 기록
  last_contact_at TIMESTAMPTZ,   -- 마지막 연락/미팅 시각
  next_action_at TIMESTAMPTZ,    -- 다음 액션 예정 시각 (리마인더용)
  memo TEXT,                     -- 자유 메모 (영업 코멘트)

  -- 수주/실패 결과 기록 (won/lost 일 때만)
  closed_at TIMESTAMPTZ,
  contract_amount BIGINT,        -- 수주 금액 (원)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, complex_id)
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_sales_tracking_user_status
  ON sales_tracking(user_id, status, priority DESC);

CREATE INDEX IF NOT EXISTS idx_sales_tracking_user_next_action
  ON sales_tracking(user_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND status NOT IN ('won', 'lost');

CREATE INDEX IF NOT EXISTS idx_sales_tracking_complex
  ON sales_tracking(complex_id);

-- =============================================
-- updated_at 자동 갱신 트리거 (002 에서 정의한 함수 재사용)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    -- 002_subscriptions.sql 이 먼저 적용되지 않은 환경 대비
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS sales_tracking_updated_at ON sales_tracking;
CREATE TRIGGER sales_tracking_updated_at
  BEFORE UPDATE ON sales_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS — 본인 행만 모든 작업
-- =============================================
ALTER TABLE sales_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own sales tracking" ON sales_tracking;
CREATE POLICY "users can manage own sales tracking"
  ON sales_tracking FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 헬퍼 뷰: 추적 + 단지 정보 JOIN
-- (Server Component 에서 두 번 쿼리 안 해도 되도록)
-- =============================================
CREATE OR REPLACE VIEW sales_tracking_with_complex AS
SELECT
  st.id,
  st.user_id,
  st.complex_id,
  st.status,
  st.priority,
  st.last_contact_at,
  st.next_action_at,
  st.memo,
  st.closed_at,
  st.contract_amount,
  st.created_at,
  st.updated_at,
  c.name           AS complex_name,
  c.address        AS complex_address,
  c.sido           AS complex_sido,
  c.sigungu        AS complex_sigungu,
  c.built_year     AS complex_built_year,
  c.households     AS complex_households,
  c.phone          AS complex_phone,
  c.management_type AS complex_management_type,
  c.prediction_score,
  c.expected_order_year
FROM sales_tracking st
JOIN complexes c ON c.id = st.complex_id;

-- 뷰는 underlying 테이블의 RLS 를 그대로 따른다.
