'use server';

/**
 * 회원가입 Server Action
 *
 * 흐름:
 *   1) supabase.auth.signUp 으로 계정 생성 (이메일 인증 메일 자동 발송)
 *   2) user_profiles 테이블에 회사 정보 행 생성
 *   3) 이메일 확인 ON 이면 가입 직후 세션 없음 -> /signup/check-email 안내
 *      이메일 확인 OFF 이면 즉시 /dashboard 로 이동
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export type SignupState = {
  error?: string;
  fieldErrors?: Partial<Record<'email' | 'password' | 'companyName' | 'ownerName' | 'phone', string>>;
} | null;

const VALID_REGIONS = ['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주'];

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const companyName = String(formData.get('companyName') ?? '').trim();
  const ownerName = String(formData.get('ownerName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').replace(/[^0-9]/g, '');
  const regions = formData.getAll('region').map(String).filter((r) => VALID_REGIONS.includes(r));

  // 검증
  const fieldErrors: NonNullable<SignupState>['fieldErrors'] = {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = '올바른 이메일 주소를 입력해주세요.';
  }
  if (!password || password.length < 8) {
    fieldErrors.password = '비밀번호는 최소 8자 이상이어야 합니다.';
  }
  if (!companyName) fieldErrors.companyName = '사업체명을 입력해주세요.';
  if (!ownerName) fieldErrors.ownerName = '대표자명을 입력해주세요.';
  if (!phone || phone.length < 10) {
    fieldErrors.phone = '연락처 형식이 올바르지 않습니다.';
  }

  if (Object.keys(fieldErrors).length) {
    return { fieldErrors };
  }

  // 가입
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'}/auth/callback`,
      data: { company_name: companyName, owner_name: ownerName },
    },
  });

  if (error) {
    const msg = error.message;
    const friendly =
      /already registered/i.test(msg) ? '이미 가입된 이메일입니다. 로그인을 시도해보세요.'
      : /weak password/i.test(msg)    ? '비밀번호가 너무 단순합니다. 8자 이상, 영문/숫자 조합을 권장합니다.'
      : msg;
    return { error: friendly };
  }

  // user_profiles 행 생성 (RLS 우회 — service role).
  // supabase-js 의 Insert 타입 추론이 일부 환경에서 좁혀지지 못해 as any 로 우회 (런타임 OK).
  if (data.user) {
    const admin = createAdminClient();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const profileRow = {
      id: data.user.id,
      company_name: companyName,
      owner_name: ownerName,
      phone,
      region: regions.length ? regions : null,
      plan: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await admin.from('user_profiles').insert(profileRow as any);

    if (profileError) {
      console.error('[signup] user_profiles insert 실패:', profileError);
    }
  }

  revalidatePath('/', 'layout');

  // 이메일 확인이 켜져 있으면 세션이 없음 -> 안내 페이지
  if (!data.session) {
    redirect('/signup/check-email?email=' + encodeURIComponent(email));
  }
  redirect('/dashboard');
}
