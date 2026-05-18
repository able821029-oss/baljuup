-- 001_initial.sql
-- 방수 SaaS MVP 초기 스키마
-- 생성일: 2026-05-18

-- =============================================
-- 1) 단지 기본 정보 (공공데이터 API 1: 아파트 단지 목록)
-- =============================================
CREATE TABLE complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kapt_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  sido TEXT,
  sigungu TEXT,
  built_year INTEGER,
  households INTEGER,
  buildings INTEGER,
  management_type TEXT, -- '위탁관리' | '자치관리'
  management_company TEXT,
  phone TEXT, -- 관리사무소 전화번호
  prediction_score INTEGER DEFAULT 0, -- 0~100
  expected_order_year INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2) 유지관리 이력 (공공데이터 API 2)
-- =============================================
CREATE TABLE maintenance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  work_type TEXT, -- '방수', '도장', '창호' 등
  work_year INTEGER,
  work_amount BIGINT, -- 공사금액 (원)
  is_waterproof BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'public_api',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3) 입찰공고 (공공데이터 API 3)
-- =============================================
CREATE TABLE bid_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  announcement_no TEXT UNIQUE,
  title TEXT,
  work_type TEXT,
  estimated_amount BIGINT,
  announced_at DATE,
  deadline_at DATE,
  status TEXT DEFAULT 'active', -- 'active' | 'closed'
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4) 장기수선충당금 (공공데이터 API 4)
-- =============================================
CREATE TABLE maintenance_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  year_month TEXT, -- '2024-11'
  fund_balance BIGINT, -- 잔액 (원)
  monthly_amount BIGINT, -- 월 적립금
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(complex_id, year_month)
);

-- =============================================
-- 5) 사용자 프로필 (방수업체)
-- =============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  owner_name TEXT,
  phone TEXT,
  region TEXT[], -- ['서울', '경기'] 관심 지역
  plan TEXT DEFAULT 'trial', -- 'trial' | 'starter' | 'pro'
  trial_ends_at TIMESTAMPTZ,
  kakao_id TEXT, -- 알림톡 수신 ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6) 제안서
-- =============================================
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  complex_id UUID REFERENCES complexes(id),
  title TEXT,
  status TEXT DEFAULT 'draft', -- 'draft' | 'sent' | 'won' | 'lost'
  content JSONB, -- AI 생성 제안서 내용
  pdf_url TEXT, -- Supabase Storage URL
  before_image_url TEXT,
  after_image_url TEXT,
  won_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7) 예측 점수 계산 뷰
-- =============================================
CREATE VIEW complex_predictions AS
SELECT
  c.id,
  c.kapt_code,
  c.name,
  c.address,
  c.built_year,
  c.households,
  c.phone,
  c.prediction_score,
  c.expected_order_year,
  COALESCE(
    (SELECT MAX(work_year) FROM maintenance_history
     WHERE complex_id = c.id AND is_waterproof = TRUE),
    c.built_year
  ) AS last_waterproof_year,
  (SELECT fund_balance FROM maintenance_funds
   WHERE complex_id = c.id
   ORDER BY year_month DESC LIMIT 1) AS latest_fund_balance,
  (SELECT COUNT(*) FROM bid_announcements
   WHERE complex_id = c.id AND status = 'active') AS active_bids
FROM complexes c;

-- =============================================
-- 8) 인덱스 (조회 성능)
-- =============================================
CREATE INDEX idx_maintenance_history_complex ON maintenance_history(complex_id);
CREATE INDEX idx_maintenance_history_waterproof ON maintenance_history(complex_id) WHERE is_waterproof = TRUE;
CREATE INDEX idx_bid_announcements_complex ON bid_announcements(complex_id);
CREATE INDEX idx_bid_announcements_active ON bid_announcements(status, deadline_at) WHERE status = 'active';
CREATE INDEX idx_maintenance_funds_complex ON maintenance_funds(complex_id, year_month DESC);
CREATE INDEX idx_proposals_user ON proposals(user_id, created_at DESC);
CREATE INDEX idx_complexes_prediction ON complexes(prediction_score DESC) WHERE prediction_score >= 60;
CREATE INDEX idx_complexes_region ON complexes(sido, sigungu);

-- =============================================
-- 9) RLS 정책
-- =============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"
  ON user_profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "users can manage own proposals"
  ON proposals FOR ALL USING (auth.uid() = user_id);

-- 공공 데이터(complexes, maintenance_history, bid_announcements, maintenance_funds)는
-- 로그인 사용자가 모두 조회 가능. 쓰기는 service_role(서버)만 수행.
ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read complexes"
  ON complexes FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read maintenance_history"
  ON maintenance_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read bid_announcements"
  ON bid_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read maintenance_funds"
  ON maintenance_funds FOR SELECT TO authenticated USING (true);
