-- 007_proposal_email_sending.sql
--
-- 목적:
--   제안서 이메일 발송 이력을 proposals 테이블에 기록.
--   PDF 첨부 자동 발송 기능(POST /api/proposals/[id]/send)에서 사용한다.
--
-- 안전성: 모두 ADD COLUMN IF NOT EXISTS — 기존 행에는 NULL 또는 0 들어감.
--         기존 동작에 영향 없음.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to    TEXT,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;

-- 발송 이력 빠른 조회용 (관리자 모니터링/통계)
CREATE INDEX IF NOT EXISTS idx_proposals_sent_at
  ON proposals(user_id, sent_at DESC)
  WHERE sent_at IS NOT NULL;
