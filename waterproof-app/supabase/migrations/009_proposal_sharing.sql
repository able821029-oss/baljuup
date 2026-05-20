-- 008_proposal_sharing.sql
--
-- 목적:
--   (A) proposals 테이블에 외부 공유용 컬럼 추가
--       - share_url        : 공유 가능한 URL (Supabase Storage 공개 URL)
--       - share_token      : /share/[token] 라우트 키 (랜덤 24자)
--       - share_expires_at : URL 만료 시각 (NULL = 무기한)
--       - share_created_at : 공유 링크 최초 생성 시각 (감사용)
--   (B) Supabase Storage 'proposals' 버킷 생성 (public read, owner write)
--   (C) 비로그인 사용자가 공유 토큰으로 proposals 행을 읽을 수 있도록 RLS 정책 추가
--
-- 다른 창에서 작업 중인 컬럼(sent_at / sent_to / sent_count)은 건드리지 않음.
-- 안전성: 모두 IF NOT EXISTS / DO NOTHING 가드.

-- =============================================
-- (A) proposals 테이블 컬럼 추가
-- =============================================
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS share_url        TEXT,
  ADD COLUMN IF NOT EXISTS share_token      TEXT,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;

-- 공유 토큰은 전역 유일해야 함 (충돌 방지 — 토큰 길이 자체로도 충돌 확률 거의 0)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_share_token
  ON proposals(share_token)
  WHERE share_token IS NOT NULL;

-- 토큰 조회 빠르게
CREATE INDEX IF NOT EXISTS idx_proposals_share_active
  ON proposals(share_token)
  WHERE share_token IS NOT NULL
    AND (share_expires_at IS NULL OR share_expires_at > NOW());

-- =============================================
-- (B) Supabase Storage — proposals 버킷
-- =============================================
-- public = true 이지만 INSERT/UPDATE/DELETE 는 아래 정책으로 제한.
-- SELECT(다운로드)는 누구나 가능 — 공유 링크가 곧 공개 링크.
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposals', 'proposals', true)
ON CONFLICT (id) DO NOTHING;

-- 업로드: 본인 폴더(proposals/{userId}/*) 에만 가능
DROP POLICY IF EXISTS "owner upload proposals" ON storage.objects;
CREATE POLICY "owner upload proposals"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proposals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 덮어쓰기 (재생성 시): 본인 폴더만
DROP POLICY IF EXISTS "owner update proposals" ON storage.objects;
CREATE POLICY "owner update proposals"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'proposals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 삭제: 본인 폴더만 (탈퇴/제안서 삭제 시 호출)
DROP POLICY IF EXISTS "owner delete proposals" ON storage.objects;
CREATE POLICY "owner delete proposals"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proposals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 다운로드: 누구나 (링크를 받은 사람)
DROP POLICY IF EXISTS "public read proposals" ON storage.objects;
CREATE POLICY "public read proposals"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proposals');

-- =============================================
-- (C) 비로그인 공유 뷰어용 RLS 정책
--     /share/[token] 페이지가 anon 키로 proposals 행을 읽을 수 있어야 함.
--     단, share_token 이 있고 만료되지 않은 행만.
-- =============================================
DROP POLICY IF EXISTS "anon read shared proposals" ON proposals;
CREATE POLICY "anon read shared proposals"
  ON proposals FOR SELECT
  TO anon, authenticated
  USING (
    share_token IS NOT NULL
    AND (share_expires_at IS NULL OR share_expires_at > NOW())
  );

-- 참고: 기존 "users can manage own proposals" 정책(FOR ALL)이 그대로 유지되므로
-- 본인은 자기 제안서 전체에 대한 권한이 그대로 살아 있음.
-- 새 SELECT 정책은 추가일 뿐 — 본인 권한과 OR 로 결합됨.
