'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_REGIONS = ['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주'];

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Partial<Record<'companyName' | 'ownerName' | 'phone', string>>;
} | null;

export async function updateProfile(_prev: UpdateProfileState, formData: FormData): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  const companyName = String(formData.get('companyName') ?? '').trim();
  const ownerName = String(formData.get('ownerName') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const phone = phoneRaw.replace(/[^0-9]/g, '');
  const regions = formData.getAll('region').map(String).filter((r) => VALID_REGIONS.includes(r));

  const fieldErrors: NonNullable<UpdateProfileState>['fieldErrors'] = {};
  if (!companyName) fieldErrors.companyName = '사업체명을 입력해주세요.';
  if (!ownerName) fieldErrors.ownerName = '대표자명을 입력해주세요.';
  if (!phone || phone.length < 10) fieldErrors.phone = '연락처 형식이 올바르지 않습니다.';

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_profiles') as any)
    .update({
      company_name: companyName,
      owner_name: ownerName,
      phone,
      region: regions.length ? regions : null,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: true };
}

// ============================================================
// 계정 삭제 — auth.users 까지 함께 제거 (CASCADE 로 proposals, user_profiles 도 삭제됨)
// ============================================================
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  // 1) auth.users 에서 삭제 (admin 권한 필요)
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    return { ok: false, error: '계정 삭제 실패: ' + authError.message };
  }

  // 2) 로그아웃 (세션 정리)
  await supabase.auth.signOut();

  redirect('/');
}
