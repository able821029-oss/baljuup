/**
 * GET /auth/callback
 *
 * Supabase 가 이메일 확인 / 비밀번호 재설정 / OAuth 콜백 시 리다이렉트하는 엔드포인트.
 *
 * 흐름:
 *   1) URL 의 ?code=... 를 받아 supabase.auth.exchangeCodeForSession 호출
 *   2) 세션 쿠키가 자동으로 설정됨
 *   3) ?next=... 또는 /dashboard 로 리다이렉트
 *
 * Supabase Email Template 의 `{{ .ConfirmationURL }}` 가 이 경로를 가리키도록 설정하면 동작:
 *   https://your-domain.com/auth/callback?code=...&next=/dashboard
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchange 실패:', error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // 정상: next 경로로 이동
  return NextResponse.redirect(`${origin}${next}`);
}
