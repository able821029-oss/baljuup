'use server';

/**
 * 비밀번호 재설정 메일 발송 Server Action
 *
 * 흐름:
 *   1) 사용자가 이메일 입력
 *   2) supabase.auth.resetPasswordForEmail 호출
 *   3) Supabase 가 reset 링크가 담긴 메일 전송
 *   4) 사용자가 메일 링크 클릭 → /auth/callback → /reset-password 로 이동
 *   5) /reset-password 에서 새 비밀번호 입력
 */

import { createClient } from '@/lib/supabase/server';

export type ForgotPasswordState = {
  ok?: boolean;
  error?: string;
  email?: string;
} | null;

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return { error: '이메일을 입력해주세요.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: '올바른 이메일 형식이 아닙니다.' };
  }

  const supabase = await createClient();

  // 메일 안의 링크가 돌아올 곳 — 우리 앱 origin + /auth/callback?next=/reset-password
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://baljuup.vercel.app';
  const redirectTo = `${baseUrl}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Supabase 는 보안상 "존재하지 않는 이메일" 도 성공으로 응답하는 경우가 많음.
    // 그래도 메시지가 오면 한국어로 매핑.
    const msg = error.message;
    const friendly =
      /rate.?limit/i.test(msg)
        ? '재발송 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.'
        : /invalid email/i.test(msg)
        ? '올바른 이메일 형식이 아닙니다.'
        : msg;
    return { error: friendly, email };
  }

  return { ok: true, email };
}
