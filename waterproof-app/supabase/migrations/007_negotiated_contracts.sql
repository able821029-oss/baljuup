-- 007_negotiated_contracts.sql
-- 수의계약 공지 (공공데이터 API: data.go.kr ID 15057758)
-- 입찰 없이 특정 업체와 직접 계약하는 방식 — 소규모 방수공사가 집중되어 영업 가치 큼.
-- 생성일: 2026-05-19

-- =============================================
-- 1) 테이블
-- =============================================
CREATE TABLE negotiated_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID REFERENCES complexes(id) ON DELETE CASCADE,
  announcement_no TEXT,
  title TEXT,
  work_type TEXT,
  contract_amount BIGINT,
  announced_at TIMESTAMPTZ,
  contract_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'closed'
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_no, complex_id)
);

-- =============================================
-- 2) 인덱스 (조회 성능)
-- =============================================
CREATE INDEX idx_negotiated_contracts_complex ON negotiated_contracts(complex_id);
CREATE INDEX idx_negotiated_contracts_announced ON negotiated_contracts(announced_at DESC);
CREATE INDEX idx_negotiated_contracts_unnotified ON negotiated_contracts(notified) WHERE notified = false;

-- =============================================
-- 3) RLS — bid_announcements 와 동일한 정책
--    공공 데이터: 로그인 사용자 SELECT 허용, 쓰기는 service_role 만
-- =============================================
ALTER TABLE negotiated_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read negotiated_contracts"
  ON negotiated_contracts FOR SELECT TO authenticated USING (true);
