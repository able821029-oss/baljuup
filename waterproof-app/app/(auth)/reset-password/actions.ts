'use server';

/**
 * 새 비밀번호 저장 Server Action
 *
 * 흐름:
 *   - 사용자가 메일 링크를 클릭 → /auth/callback 에서 세션이 자동 생성됨
 *   - /reset-password 페이지에서 새 비밀번호 입력
 *   - supabase.auth.updateUser({ password }) 호출
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ResetPasswordState = {
  error?: string;
} | null;

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (!password || !passwordConfirm) {
    return { error: '새 비밀번호와 확인을 모두 입력해주세요.' };
  }
  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 합니다.' };
  }
  if (password !== passwordConfirm) {
    return { error: '비밀번호와 확인이 일치하지 않습니다.' };
  }

  const supabase = await createClient();

  // 세션 확인 — 메일 링크에서 도착한 경우에만 세션이 존재
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        '인증이 만료되었습니다. 비밀번호 찾기를 다시 시도해 새 링크를 받아주세요.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = error.message;
    const friendly = /same.+password|new.+password.+different/i.test(msg)
      ? '기존 비밀번호와 동일합니다. 다른 비밀번호를 사용해주세요.'
      : msg;
    return { error: friendly };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
