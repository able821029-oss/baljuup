'use server';

/**
 * 로그인 Server Action
 *
 * 사용:
 *   <form action={login}>
 *     <input name="email" />
 *     <input name="password" />
 *   </form>
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type LoginState = {
  error?: string;
} | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirect') ?? '/dashboard');

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 모두 입력해주세요.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 자주 보이는 메시지를 한국어로 매핑
    const msg = error.message;
    const friendly =
      /invalid login credentials/i.test(msg) ? '이메일 또는 비밀번호가 일치하지 않습니다.'
      : /email not confirmed/i.test(msg)     ? '이메일 인증을 완료해주세요. 받은 메일함을 확인해보세요.'
      : msg;
    return { error: friendly };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
